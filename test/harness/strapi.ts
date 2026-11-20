import { existsSync } from "node:fs"
import fs from "node:fs/promises"

import type { Core } from "@strapi/strapi"

import { installConfigSpy } from "./config"
import { appDir, compileStrapi, createStrapi, distDir } from "./runtime"

let instance: Core.Strapi | undefined
let booting: Promise<Core.Strapi> | undefined
let teardownRegistered = false

const boot = async (): Promise<Core.Strapi> => {
  process.env.STRAPI_TELEMETRY_DISABLED = "1"

  const options = {
    appDir,
    distDir,
    autoReload: false,
    serveAdminPanel: false,
  }

  await compileStrapi(options)

  const app = await createStrapi(options).load()
  app.server.mount()

  instance = app
  installConfigSpy()
  registerTeardown()

  return app
}

/**
 * Boot the shared Strapi instance for the integration/memory workers.
 *
 * Lazy and idempotent: the first call compiles the playground and boots the
 * app, every later call (in every suite of the single worker) returns the same
 * instance. Suites call this in `beforeAll`; they must not tear it down per
 * suite, the harness owns the lifecycle.
 */
export const setupStrapi = async (): Promise<Core.Strapi> => {
  if (instance) return instance
  if (!booting) {
    booting = boot().catch((error) => {
      booting = undefined
      throw error
    })
  }
  return booting
}

/**
 * Tear the shared instance down once, in the order that avoids the known
 * sqlite/node-schedule shutdown hangs. Always clears the instance reference,
 * even if a step throws, so a later call cannot reuse a half-dead app.
 */
export const teardownStrapi = async (): Promise<void> => {
  const app = instance
  if (!app) return
  instance = undefined
  // Drop the memoized boot promise too, so a later setupStrapi() re-boots
  // instead of resolving to this torn-down app.
  booting = undefined

  // Cancel every node-schedule job, even though the playground disables cron.
  try {
    const schedule = await import("node-schedule")
    const jobs = schedule.scheduledJobs as Record<string, { cancel: (force: boolean) => void }>
    for (const name of Object.keys(jobs)) {
      jobs[name].cancel(true)
      delete jobs[name]
    }
    schedule.gracefulShutdown?.()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    schedule.destroy()
  } catch {
    /* node-schedule may not be installed outside the playground */
  }

  try {
    if (app.server?.httpServer) {
      await new Promise<void>((resolve) => {
        app.server.httpServer.close(() => resolve())
      })
    }
  } catch {
    /* server may already be closed */
  }

  try {
    await app.server?.destroy?.()
  } catch {
    /* ignore */
  }

  try {
    await app.db?.connection?.destroy?.()
  } catch {
    /* ignore */
  }

  try {
    await app.db?.destroy?.()
  } catch {
    /* ignore */
  }

  const tmpDbFile = process.env.DATABASE_FILENAME
  try {
    if (tmpDbFile && existsSync(tmpDbFile)) await fs.unlink(tmpDbFile)
  } catch {
    /* the global-setup teardown removes the whole temp dir anyway */
  }
}

const registerTeardown = (): void => {
  if (teardownRegistered) return
  teardownRegistered = true

  // Best-effort async teardown when the process drains naturally (e.g. watch
  // mode). Vitest normally force-exits the worker, which skips `beforeExit`, so
  // the durable cleanup is `global-setup.ts` removing the temp dir; the `exit`
  // handler below drops the listening socket as a last, synchronous resort.
  process.once("beforeExit", () => {
    void teardownStrapi()
  })
  process.once("exit", () => {
    try {
      instance?.server?.httpServer?.close()
    } catch {
      /* ignore */
    }
  })
}

export { instance as strapi }

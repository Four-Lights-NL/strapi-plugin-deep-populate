import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Config } from "@fourlights/strapi-plugin-deep-populate/dist/server/src/config/index"
import { type Core, compileStrapi, createStrapi } from "@strapi/strapi"
import { isEmpty, merge } from "lodash"
import { vi } from 'vitest'

let instance: Core.Strapi
let tmpDir: string
let tmpDbFile: string

const resolve = (basePath: string, ...paths: string[]) => {
  const pathStr = path.join(...paths)
  return path.resolve(basePath.replace(pathStr, ""), pathStr)
}

export const setupStrapi = async (pluginConfig: Partial<Config> = {}) => {
  if (!instance) {
    process.env.STRAPI_TELEMETRY_DISABLED = "1"
    const systemTempDir = process.env.RUNNER_TEMP ?? tmpdir()
    tmpDir = await fs.mkdtemp(path.join(systemTempDir, "strapi-plugin-deep-populate"))
    tmpDbFile = resolve(tmpDir, "test.db")

    process.env.DATABASE_FILENAME = tmpDbFile
    const options = {
      appDir: resolve(process.cwd(), "playground"),
      distDir: resolve(process.cwd(), "playground", "dist"),
      autoReload: false,
      serveAdminPanel: false,
    }
    await compileStrapi(options)

    instance = await createStrapi(options).load()
    instance.server.mount()
  }

  // Allow overriding the plugin config per test
  if (!isEmpty(pluginConfig)) {
    const originalConfigGet = strapi.config.get
    const configSpy = vi.spyOn(strapi.config, "get")
    configSpy.mockImplementation((key, defaultValue) => {
      const config = originalConfigGet.call(strapi.config, key, defaultValue)
      if (key === "plugin::deep-populate") {
        return merge({}, config, pluginConfig)
      }
      return config
    })
    return { instance, configSpy }
  }
  return { instance }
}

export const teardownStrapi = async () => {
  if (!instance) return

  // 0. Cancel ALL node-schedule jobs aggressively
  try {
    const schedule = require("node-schedule")
    const jobs = schedule.scheduledJobs
    Object.keys(jobs).forEach((name) => {
      jobs[name].cancel(true) // Force cancel
      delete jobs[name]
    })
    schedule.gracefulShutdown?.()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    schedule.destroy()
  } catch (_e) {
    /* noop */
  }

  try {
    // 1. Stop HTTP server first (promisify the callback)
    if (instance.server?.httpServer) {
      await new Promise<void>((resolve) => {
        instance.server.httpServer.close(() => {
          resolve()
        })
      })
    }

    // 2. Destroy Strapi server components
    if (instance.server?.destroy) {
      await instance.server.destroy()
    }

    // 3. Close database connections
    if (instance.db?.connection) {
      await instance.db.connection.destroy()
    }

    // 4. Destroy database instance
    if (instance.db?.destroy) {
      await instance.db.destroy()
    }

    // 5. Clean up temp files
    if (existsSync(tmpDbFile)) {
      await fs.unlink(tmpDbFile)
    }

    // 6. Clear instance reference
    instance = null
  } catch (_error) {
    // Still clear the instance to prevent reuse
    instance = null
  }
}

export { instance as strapi }

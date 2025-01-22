import fs from "node:fs/promises"
import path from "node:path"
import { type Core, compileStrapi, createStrapi } from "@strapi/strapi"
import type { Knex } from "knex"

type DbConfigSqlite3 = Knex.Config & { connection: Knex.BetterSqlite3ConnectionConfig }

let instance: Core.Strapi

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const resolve = (basePath: string, ...paths: string[]) => {
  const pathStr = path.join(...paths)
  return path.resolve(basePath.replace(pathStr, ""), pathStr)
}

export const setupStrapi = async () => {
  if (!instance) {
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
  return instance
}

export const teardownStrapi = async () => {
  if (!instance) return

  const dbSettings = strapi.config.get<DbConfigSqlite3>("database.connection")

  instance.server.httpServer.close()
  await instance.destroy()

  if (instance.db?.connection) {
    await instance.db.connection.destroy()

    if (dbSettings?.connection?.filename) {
      const tmpDbFile = dbSettings.connection.filename
      if (await fileExists(tmpDbFile)) {
        await fs.unlink(tmpDbFile)
      }
    }
  }
}

export { instance as strapi }

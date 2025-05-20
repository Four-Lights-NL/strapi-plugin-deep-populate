import fs from "node:fs/promises"
import path from "node:path"
import { type Core, compileStrapi, createStrapi } from "@strapi/strapi"
import { tmpdir } from "node:os"

let instance: Core.Strapi
let tmpDir: string
let tmpDbFile: string

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
    tmpDir = await fs.mkdtemp(path.join(tmpdir(), "strapi-plugin-deep-populate"))
    tmpDbFile = resolve(tmpDir, 'test.db')

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
  return instance
}

export const teardownStrapi = async () => {
  if (!instance) return

  instance.server.httpServer.close()

  if (instance.db?.connection) {
    await instance.db.connection.destroy()

    if (await fileExists(tmpDbFile)) {
      await fs.unlink(tmpDbFile)
    }
  }

  instance = null
}

export { instance as strapi }

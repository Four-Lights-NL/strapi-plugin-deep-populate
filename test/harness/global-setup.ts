import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { cleanTestUploads } from "./upload-cleanup"

/**
 * Vitest `globalSetup`. Runs in the main process, before the worker pool is
 * created, so the environment it sets is inherited by every worker. It only
 * prepares the environment and cleans it up afterwards; it never boots Strapi.
 */
export default async function setup(): Promise<() => Promise<void>> {
  process.env.STRAPI_TELEMETRY_DISABLED = "1"
  process.env.NODE_NO_WARNINGS = "1"

  const baseDir = process.env.RUNNER_TEMP ?? os.tmpdir()
  const tmpDir = await fs.mkdtemp(path.join(baseDir, "strapi-deep-populate-"))
  const dbFile = path.join(tmpDir, "test.db")

  process.env.DATABASE_FILENAME = dbFile
  process.env.TEST_TMP_DIR = tmpDir

  return async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
    await cleanTestUploads()
  }
}

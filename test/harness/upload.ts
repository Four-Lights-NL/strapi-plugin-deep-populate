import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { Core } from "@strapi/strapi"

import { File } from "formidable"

import { cleanTestUploads, TEST_FILE_PREFIX } from "./upload-cleanup"

// A valid 1x1 transparent PNG, used for media-relation tests.
const PNG_BASE64 = "data:image/png;base64,[redacted]=="

const createFormidableFile = async (base64Image: string): Promise<File> => {
  const base64Data = base64Image.replace(/^data:image\/png;base64,/, "")
  const buffer = Buffer.from(base64Data, "base64")

  const tmpFilePath = path.join(
    os.tmpdir(),
    `${TEST_FILE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  )
  await fs.writeFile(tmpFilePath, buffer)

  return new File({
    filepath: tmpFilePath,
    originalFilename: "test.png",
    newFilename: path.basename(tmpFilePath),
    mimetype: "image/png",
    size: buffer.length,
    hashAlgorithm: false,
    toJSON: () => ({
      size: 0,
      length: 0,
      filepath: tmpFilePath,
      newFilename: path.basename(tmpFilePath),
      mimetype: "image/png",
      mtime: new Date(),
      originalFilename: "test.png",
      hash: "",
    }),
  } as never) as unknown as File
}

/** Upload the built-in test PNG through the real upload service. */
export const uploadImage = async (app: Core.Strapi): Promise<unknown> => {
  const file = await createFormidableFile(PNG_BASE64)
  try {
    return await app
      .plugin("upload")
      .service("upload")
      .upload({ data: {}, files: [file] })
  } finally {
    await fs.rm(file.filepath, { force: true })
  }
}

/** Remove every uploaded test file from the playground uploads directory. */
export const cleanImages = cleanTestUploads

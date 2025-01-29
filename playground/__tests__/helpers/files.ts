import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { Core } from "@strapi/strapi"
import { File } from "formidable"

const createFormidableFile = async (base64Image: string): Promise<File> => {
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/png;base64,/, "")

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, "base64")

  // Create temporary file path
  const tmpFilePath = path.join(os.tmpdir(), `test-${Date.now()}.png`)

  // Write buffer to temp file
  await fs.promises.writeFile(tmpFilePath, buffer)

  // Create Formidable File instance
  const file = new File({
    filepath: tmpFilePath,
    originalFilename: "test.png",
    newFilename: path.basename(tmpFilePath),
    mimetype: "image/png",
    size: buffer.length,
    hashAlgorithm: false,
    toJSON: () => ({
      size: file.size,
      length: file.size,
      filepath: file.filepath,
      newFilename: file.newFilename,
      mimetype: file.mimetype,
      mtime: file.mtime,
      originalFilename: file.originalFilename,
      hash: file.hash,
    }),
  })

  return file
}

export const uploadImage = async (strapi: Core.Strapi) => {
  const imageBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII="
  const file = await createFormidableFile(imageBase64)

  const uploadedFile = await strapi
    .plugin("upload")
    .service("upload")
    .upload({ data: {}, files: [file] })

  await fs.promises.unlink(file.filepath)
  return uploadedFile
}

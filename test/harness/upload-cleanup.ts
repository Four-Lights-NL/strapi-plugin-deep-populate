import fs from "node:fs/promises"
import path from "node:path"

/** Temp-file prefix for uploads created by the harness. */
export const TEST_FILE_PREFIX = "test-"

// Strapi stores uploads as `test_<hash>.<ext>`; match both separators so the
// temp-file and stored-upload prefixes are both cleaned up.
export const TEST_UPLOAD_PATTERN = /^test[_-]/i

const uploadDir = () => path.resolve(process.cwd(), "playground", "public", "uploads")

/** Remove every uploaded test file from the playground uploads directory. */
export const cleanTestUploads = async (): Promise<void> => {
  const uploadPath = uploadDir()
  try {
    const uploads = await fs.readdir(uploadPath)
    await Promise.all(
      uploads
        .filter((file) => TEST_UPLOAD_PATTERN.test(file))
        .map((file) => fs.rm(path.join(uploadPath, file), { force: true })),
    )
  } catch {
    /* uploads directory does not exist yet */
  }
}

import { isNil } from "lodash"

export const sanitizeObject = (obj: unknown) => {
  if (obj === null || typeof obj !== "object") return obj

  // Remove dangerous properties
  const dangerousProps = ["__proto__", "constructor", "prototype"]
  const sanitized = {}
  for (const key in obj) {
    if (dangerousProps.includes(key)) continue

    if (typeof obj[key] === "object" && isNil(obj[key])) {
      sanitized[key] = sanitizeObject(obj[key])
    } else {
      sanitized[key] = obj[key]
    }
  }

  return sanitized
}

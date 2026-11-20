let counter = 0

/** A process-wide monotonically increasing counter, for unique test values. */
export const nextId = (): number => {
  counter += 1
  return counter
}

/** `${prefix}-${n}` with a globally unique `n`. */
export const uniqueValue = (prefix: string): string => `${prefix}-${nextId()}`

/** URL-safe slug used to fill the required `page.slug` uid field. */
export const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || uniqueValue("page")
}

export function asBoolean(
  value: string | boolean | null | undefined,
): value is Exclude<string | boolean, "" | "false" | "0" | false> {
  if (typeof value === "boolean") return value
  if (!value) return false
  const normalized = value.toLowerCase().trim()
  return normalized !== "false" && normalized !== "0"
}

import { describe, expect, it } from "vitest"

import { sanitizeObject } from "../../server/src/utils/sanitizeObject"

describe("sanitizeObject", () => {
  it("returns primitives and nullish values unchanged", () => {
    expect(sanitizeObject(null)).toBeNull()
    expect(sanitizeObject(undefined)).toBeUndefined()
    expect(sanitizeObject("value")).toBe("value")
    expect(sanitizeObject(42)).toBe(42)
    expect(sanitizeObject(true)).toBe(true)
  })

  it("returns an empty object for an empty object", () => {
    expect(sanitizeObject({})).toEqual({})
  })

  it("keeps safe keys", () => {
    expect(sanitizeObject({ safe: 1, nested: "x" })).toEqual({ safe: 1, nested: "x" })
  })

  it("strips prototype-pollution keys", () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"constructor":"x","prototype":"y","safe":1}') as Record<
      string,
      unknown
    >

    const output = sanitizeObject(input)

    expect(output).toEqual({ safe: 1 })
    expect(Object.keys(output as object)).toEqual(["safe"])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it("does not mutate the source object", () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"safe":1}') as Record<string, unknown>
    sanitizeObject(input)
    expect(Object.keys(input)).toContain("safe")
  })

  it("copies nested non-null objects by reference (only the top level is sanitized)", () => {
    const child = { value: 1 }
    const output = sanitizeObject({ child }) as Record<string, unknown>
    expect(output.child).toBe(child)
  })

  it("preserves explicit null values", () => {
    expect(sanitizeObject({ child: null })).toEqual({ child: null })
  })

  // Characterizes current behavior: arrays are objects, so the key loop turns them
  // into plain objects. The function is only ever used on populate/config objects.
  it("turns arrays into plain objects", () => {
    expect(sanitizeObject([1, 2, 3])).toEqual({ 0: 1, 1: 2, 2: 3 })
  })
})

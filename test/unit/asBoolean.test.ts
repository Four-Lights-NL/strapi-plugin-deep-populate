import { describe, expect, it } from "vitest"

import { asBoolean } from "../../server/src/utils/asBoolean"

describe("asBoolean", () => {
  it("returns booleans unchanged", () => {
    expect(asBoolean(true)).toBe(true)
    expect(asBoolean(false)).toBe(false)
  })

  it("treats the strings 'false' and '0' as false", () => {
    expect(asBoolean("false")).toBe(false)
    expect(asBoolean("0")).toBe(false)
  })

  it("is case-insensitive and trims whitespace", () => {
    expect(asBoolean("FALSE")).toBe(false)
    expect(asBoolean("  false  ")).toBe(false)
    expect(asBoolean("TRUE")).toBe(true)
    expect(asBoolean(" True ")).toBe(true)
    expect(asBoolean("  0 ")).toBe(false)
  })

  it("treats any other non-empty string as true", () => {
    expect(asBoolean("true")).toBe(true)
    expect(asBoolean("1")).toBe(true)
    expect(asBoolean("yes")).toBe(true)
    expect(asBoolean("no")).toBe(true)
    expect(asBoolean("on")).toBe(true)
  })

  it("treats empty and nullish values as false", () => {
    expect(asBoolean("")).toBe(false)
    expect(asBoolean(null)).toBe(false)
    expect(asBoolean(undefined)).toBe(false)
  })
})

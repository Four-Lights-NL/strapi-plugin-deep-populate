import { describe, expect, it } from "vitest"

import { isUniqueConstraintError } from "../../server/src/utils/isUniqueConstraintError"

describe("isUniqueConstraintError", () => {
  describe("driver error codes", () => {
    it("recognises the PostgreSQL unique violation code", () => {
      expect(isUniqueConstraintError({ code: "23505" })).toBe(true)
    })

    it("recognises MySQL duplicate entry errno", () => {
      expect(isUniqueConstraintError({ errno: 1062 })).toBe(true)
    })

    it("recognises the SQLite constraint errnos", () => {
      expect(isUniqueConstraintError({ errno: 19 })).toBe(true)
      expect(isUniqueConstraintError({ errno: 2067 })).toBe(true)
    })

    it("recognises the SQL Server duplicate key numbers", () => {
      expect(isUniqueConstraintError({ number: 2601 })).toBe(true)
      expect(isUniqueConstraintError({ number: 2627 })).toBe(true)
    })

    it("recognises SQLite driver code strings", () => {
      expect(isUniqueConstraintError({ code: "SQLITE_CONSTRAINT" })).toBe(true)
      expect(isUniqueConstraintError({ code: "SQLITE_CONSTRAINT_UNIQUE" })).toBe(true)
    })
  })

  describe("wrapped errors", () => {
    it("looks at cause", () => {
      expect(isUniqueConstraintError({ cause: { errno: 1062 } })).toBe(true)
    })

    it("looks at originalError", () => {
      expect(isUniqueConstraintError({ originalError: { code: "23505" } })).toBe(true)
    })

    it("looks at parent", () => {
      expect(isUniqueConstraintError({ parent: { errno: 19 } })).toBe(true)
    })

    it("prefers the top-level code/errno/number over the wrapped one", () => {
      expect(isUniqueConstraintError({ errno: 1, cause: { errno: 1062 } })).toBe(false)
      expect(isUniqueConstraintError({ code: "SOMETHING_ELSE", cause: { code: "23505" } })).toBe(false)
    })
  })

  describe("non unique-constraint errors", () => {
    it("returns false for unrelated codes and errnos", () => {
      expect(isUniqueConstraintError({ code: "ECONNREFUSED" })).toBe(false)
      expect(isUniqueConstraintError({ errno: 12345 })).toBe(false)
      expect(isUniqueConstraintError({ number: 12345 })).toBe(false)
    })

    it("returns false for an empty error object", () => {
      expect(isUniqueConstraintError({})).toBe(false)
      expect(isUniqueConstraintError({ message: "boom" })).toBe(false)
    })
  })

  // Known defect (out of scope to fix): the first clause compares `code` against
  // `Object.keys(UniqueConstraintErrorCodes)`, i.e. the constant *names*, instead of
  // `Object.values(...)`, i.e. the actual driver codes. A driver never reports a name
  // like "POSTGRES_UNIQUE_VIOLATION", so this clause is effectively dead weight and the
  // real detection happens through the explicit value/errno/number comparisons below.
  it.todo("should compare code against the numeric/literal values, not the constant names")
})

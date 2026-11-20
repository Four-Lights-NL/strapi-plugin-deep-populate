import { describe, expect, it } from "vitest"

import { version } from "../../package.json"
import { majorMinorVersion } from "../../server/src/utils/version"

describe("majorMinorVersion", () => {
  it("is the plugin package version without the patch segment", () => {
    const expected = version.split(".").slice(0, -1).join(".")
    expect(majorMinorVersion).toBe(expected)
  })

  it("has the shape <major>.<minor>", () => {
    expect(majorMinorVersion).toMatch(/^\d+\.\d+$/)
  })

  it("drops the patch and any prerelease suffix", () => {
    const [major, minor] = version.split(".")
    expect(majorMinorVersion).toBe(`${major}.${minor}`)
    expect(majorMinorVersion).not.toContain("-")
  })
})

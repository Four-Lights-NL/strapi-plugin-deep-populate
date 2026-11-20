import { describe, expect, it } from "vitest"

import { version } from "../../package.json"
import { majorMinorVersion } from "../../server/src/utils/version"

/**
 * `majorMinorVersion` backs the populate cache namespace. It strips the package
 * version's last dot-segment, so a stable `x.y.z` becomes `x.y`. For a
 * prerelease like `x.y.z-beta.n` it keeps the prerelease tag (`x.y.z-beta`) —
 * characterised rather than changed here, because #160 is test-only and the
 * version is owned by the stack. See "Documented bugs" in test/README.md.
 */
describe("majorMinorVersion", () => {
  it("is the package version without its last dot-segment", () => {
    expect(majorMinorVersion).toBe(version.split(".").slice(0, -1).join("."))
  })

  it("keeps the <major>.<minor> prefix of the package version", () => {
    const [major, minor] = version.split(".")
    expect(majorMinorVersion.startsWith(`${major}.${minor}`)).toBe(true)
  })
})

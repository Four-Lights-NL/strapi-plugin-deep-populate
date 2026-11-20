import { setupStrapi, strapi, strapiVersion } from "@test/harness"
import { beforeAll, describe, expect, test } from "vitest"

describe("global app", () => {
  beforeAll(async () => {
    await setupStrapi()
  })

  test("strapi is defined", () => {
    expect(strapi).toBeDefined()
    expect(strapi.server.httpServer).toBeDefined()
  })

  test("runs the Strapi version requested by the harness", () => {
    expect(strapiVersion).toMatch(/^5\./)

    // The compatibility matrix sets EXPECTED_STRAPI_VERSION to the injected
    // version; assert the app that actually booted matches it.
    const expected = process.env.EXPECTED_STRAPI_VERSION
    if (expected) expect(strapiVersion).toBe(expected)
  })
})

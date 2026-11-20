import { describe, expect, it } from "vitest"

import configModule from "../../server/src/config"

const { default: defaultConfig, validator } = configModule

describe("config default", () => {
  it("returns the documented defaults", () => {
    expect(defaultConfig({ env: (() => undefined) as never })).toEqual({
      useCache: true,
      replaceWildcard: true,
      contentTypes: {},
    })
  })
})

describe("config validator", () => {
  const base = { useCache: true, replaceWildcard: true } as const

  it("accepts an empty contentTypes object", () => {
    expect(() => validator({ ...base, contentTypes: {} })).not.toThrow()
  })

  it("accepts a well-formed content type config", () => {
    expect(() =>
      validator({
        ...base,
        contentTypes: {
          "*": { allow: { relations: ["api::section.section"], components: ["cms.cool-component"] } },
          "api::page.page": { deny: { relations: [], components: [] } },
        },
      }),
    ).not.toThrow()
  })

  it("rejects a non-object contentTypes", () => {
    expect(() => validator({ ...base, contentTypes: "nope" as never })).toThrow(/contentTypes must be an object/)
  })

  it("rejects a non-object content type entry", () => {
    expect(() => validator({ ...base, contentTypes: { "api::page.page": "nope" as never } })).toThrow(
      /contentTypes.api::page.page must be an object/,
    )
  })

  it("rejects an entry without allow or deny", () => {
    expect(() => validator({ ...base, contentTypes: { "api::page.page": { omitEmpty: true } } })).toThrow(
      /must have an "allow" or "deny"/,
    )
  })

  it("rejects non-array allow/deny lists", () => {
    expect(() =>
      validator({
        ...base,
        contentTypes: { "api::page.page": { allow: { relations: "not-an-array" as never } } },
      }),
    ).toThrow(/allow.relations must be an array/)

    expect(() =>
      validator({
        ...base,
        contentTypes: { "api::page.page": { deny: { components: "not-an-array" as never } } },
      }),
    ).toThrow(/deny.components must be an array/)
  })
})

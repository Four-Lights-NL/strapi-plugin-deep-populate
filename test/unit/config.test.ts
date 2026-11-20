import { describe, expect, it } from "vitest"

import configModule, {
  isPlainObject,
  parseAttributePluginOptions,
  parseCacheOptions,
  parseGlobalSettings,
  parseSchemaPluginOptions,
  resolveGlobalConfig,
} from "../../server/src/config"

const { default: defaultConfig, validator } = configModule

describe("config default", () => {
  it("returns the documented defaults", () => {
    expect(defaultConfig()).toEqual({
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

describe("isPlainObject", () => {
  it("accepts plain objects only", () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it("rejects arrays, null and scalars", () => {
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject("x")).toBe(false)
    expect(isPlainObject(1)).toBe(false)
  })
})

describe("parseSchemaPluginOptions", () => {
  it("returns {} for non-objects", () => {
    expect(parseSchemaPluginOptions(undefined)).toEqual({})
    expect(parseSchemaPluginOptions("nope")).toEqual({})
    expect(parseSchemaPluginOptions([])).toEqual({})
  })

  it("keeps the supported keys and drops unknown ones", () => {
    expect(
      parseSchemaPluginOptions({
        omitEmpty: true,
        localizations: false,
        selfReferencing: true,
        allow: { relations: ["api::section.section"] },
        deny: { components: ["cms.cool-component"] },
        unknown: "ignored",
      }),
    ).toEqual({
      omitEmpty: true,
      localizations: false,
      selfReferencing: true,
      allow: { relations: ["api::section.section"] },
      deny: { components: ["cms.cool-component"] },
    })
  })

  it("coerces malformed values by omitting them", () => {
    expect(parseSchemaPluginOptions({ omitEmpty: "yes", allow: "nope" })).toEqual({})
    expect(parseSchemaPluginOptions({ allow: { relations: ["api::x.x", 1, null] } })).toEqual({
      allow: { relations: ["api::x.x"] },
    })
  })
})

describe("parseAttributePluginOptions", () => {
  it("only supports allow/deny", () => {
    expect(parseAttributePluginOptions({ omitEmpty: true, deny: { relations: ["api::page.page"] } })).toEqual({
      deny: { relations: ["api::page.page"] },
    })
    expect(parseAttributePluginOptions(undefined)).toEqual({})
  })
})

describe("parseCacheOptions", () => {
  it("returns undefined when nothing supported is present", () => {
    expect(parseCacheOptions(undefined)).toBeUndefined()
    expect(parseCacheOptions({ other: true })).toBeUndefined()
  })

  it("keeps the supported booleans", () => {
    expect(parseCacheOptions({ clearCacheOnStartup: true, warmOnWrite: false })).toEqual({
      clearCacheOnStartup: true,
      warmOnWrite: false,
    })
    expect(parseCacheOptions({ clearCacheOnStartup: true, junk: 1 })).toEqual({ clearCacheOnStartup: true })
  })
})

describe("parseGlobalSettings", () => {
  it("returns {} for non-objects", () => {
    expect(parseGlobalSettings(undefined)).toEqual({})
    expect(parseGlobalSettings([])).toEqual({})
  })

  it("keeps the supported keys and parses nested cacheOptions", () => {
    expect(
      parseGlobalSettings({
        useCache: false,
        replaceWildcard: true,
        omitEmpty: true,
        localizations: false,
        cacheOptions: { warmOnWrite: true },
        unknown: 1,
      }),
    ).toEqual({
      useCache: false,
      replaceWildcard: true,
      omitEmpty: true,
      localizations: false,
      cacheOptions: { warmOnWrite: true },
    })
  })
})

describe("resolveGlobalConfig", () => {
  it("falls back to the built-in defaults", () => {
    expect(resolveGlobalConfig({}, {})).toEqual({
      useCache: true,
      replaceWildcard: true,
      omitEmpty: undefined,
      localizations: undefined,
      cacheOptions: {},
    })
  })

  it("prefers the store over config/plugins.js over the defaults", () => {
    const resolved = resolveGlobalConfig(
      { useCache: false, omitEmpty: true, cacheOptions: { warmOnWrite: false } },
      {
        useCache: true,
        replaceWildcard: false,
        omitEmpty: false,
        cacheOptions: { clearCacheOnStartup: true, warmOnWrite: true },
      },
    )

    expect(resolved).toEqual({
      useCache: false,
      replaceWildcard: false,
      omitEmpty: true,
      localizations: undefined,
      cacheOptions: { clearCacheOnStartup: true, warmOnWrite: false },
    })
  })
})

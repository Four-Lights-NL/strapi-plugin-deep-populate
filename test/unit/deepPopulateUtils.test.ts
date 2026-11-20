import { afterEach, describe, expect, it } from "vitest"

import { getConfig, getRelations, hasValue, isEmpty } from "../../server/src/services/deep-populate/utils"

const globalScope = globalThis as unknown as { strapi?: unknown }
const previousStrapi = globalScope.strapi

const setStrapiConfig = (config: Record<string, unknown>) => {
  globalScope.strapi = {
    config: { get: (key: string) => (key === "plugin::deep-populate" ? config : undefined) },
    // `getConfig` now reads the schema's `pluginOptions['deep-populate']`, and `getGlobalConfig`
    // falls back to `config/plugins.js` when the settings service is unavailable (as here).
    getModel: () => ({ pluginOptions: {} }),
  }
}

describe("isEmpty / hasValue", () => {
  it("isEmpty treats undefined and empty objects as empty", () => {
    expect(isEmpty(undefined as unknown as object)).toBe(true)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty({ a: 1 })).toBe(false)
  })

  it("hasValue rejects nullish, empty arrays and empty objects", () => {
    expect(hasValue(null)).toBe(false)
    expect(hasValue(undefined)).toBe(false)
    expect(hasValue([])).toBe(false)
    expect(hasValue({})).toBe(false)
  })

  it("hasValue accepts non-empty values including falsy scalars", () => {
    expect(hasValue("x")).toBe(true)
    expect(hasValue(0)).toBe(true)
    expect(hasValue(false)).toBe(true)
    expect(hasValue([1])).toBe(true)
    expect(hasValue({ a: 1 })).toBe(true)
  })
})

describe("getRelations", () => {
  it("returns relational, component, dynamic-zone and media attributes only", () => {
    const model = {
      uid: "api::section.section",
      options: {},
      pluginOptions: {},
      attributes: {
        name: { type: "string" },
        rel: { type: "relation", relation: "oneToMany", target: "api::section.section" },
        comp: { type: "component", component: "cms.cool-component" },
        dz: { type: "dynamiczone", components: ["cms.cool-component"] },
        img: { type: "media", multiple: false },
        createdBy: { type: "relation", relation: "oneToOne", target: "admin::user" },
      },
    }

    const relations = getRelations(model as never)
    expect(relations.map(([attrName]) => attrName)).toEqual(["rel", "comp", "dz", "img"])
  })

  it("honours populateCreatorFields", () => {
    const model = {
      uid: "api::x.x",
      options: { populateCreatorFields: true },
      pluginOptions: {},
      attributes: {
        createdBy: { type: "relation", relation: "oneToOne", target: "admin::user" },
        plain: { type: "string" },
      },
    }

    expect(getRelations(model as never).map(([attrName]) => attrName)).toEqual(["createdBy"])
  })

  it("filters locale/localizations for non-localized content types", () => {
    const model = {
      uid: "api::x.x",
      options: {},
      pluginOptions: {},
      attributes: {
        locale: { type: "string" },
        localizations: { type: "relation", relation: "oneToMany", target: "api::x.x" },
        rel: { type: "relation", relation: "oneToMany", target: "api::x.x" },
      },
    }

    expect(getRelations(model as never).map(([attrName]) => attrName)).toEqual(["rel"])
  })
})

describe("getConfig", () => {
  afterEach(() => {
    // Restore whatever was there before (the booted app in a combined run) so the
    // harness's global `beforeEach` — which resets the settings store — never runs
    // against a stubbed `strapi`. `setStrapiConfig` is called inside each test body,
    // so the stub exists only for the duration of the test.
    if (previousStrapi === undefined) delete globalScope.strapi
    else globalScope.strapi = previousStrapi
  })

  it("falls back to the global omitEmpty/localizations", () => {
    setStrapiConfig({ useCache: true, replaceWildcard: true, contentTypes: {}, omitEmpty: false, localizations: false })
    expect(getConfig({ contentType: "api::page.page", documentId: "x" })).toEqual({
      allow: undefined,
      deny: undefined,
      omitEmpty: false,
      localizations: false,
    })
  })

  it("applies the wildcard content type as a base", () => {
    setStrapiConfig({
      useCache: true,
      replaceWildcard: true,
      contentTypes: { "*": { omitEmpty: true } },
    })
    expect(getConfig({ contentType: "api::page.page", documentId: "x" }).omitEmpty).toBe(true)
  })

  it("merges the wildcard base with the content type entry", () => {
    setStrapiConfig({
      useCache: true,
      replaceWildcard: true,
      contentTypes: {
        "*": { allow: { relations: ["api::section.section"] }, omitEmpty: true },
        "api::page.page": { deny: { relations: ["api::page.page"] } },
      },
    })

    const config = getConfig({ contentType: "api::page.page", documentId: "x" })
    expect(config.allow).toEqual({ relations: ["api::section.section"] })
    expect(config.deny).toEqual({ relations: ["api::page.page"] })
    expect(config.omitEmpty).toBe(true)
  })

  it("lets per-call params win over content type and global config", () => {
    setStrapiConfig({
      useCache: true,
      replaceWildcard: true,
      omitEmpty: false,
      localizations: false,
      contentTypes: { "api::page.page": { omitEmpty: false, localizations: false } },
    })

    expect(
      getConfig({ contentType: "api::page.page", documentId: "x", omitEmpty: true, localizations: true }),
    ).toMatchObject({
      omitEmpty: true,
      localizations: true,
    })
  })
})

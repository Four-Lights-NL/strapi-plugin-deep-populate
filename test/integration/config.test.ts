import { createPage, pageWithLink, type StandardGraph, seedStandardGraph } from "@test/factories"
import { setPluginConfig, setupStrapi, strapi } from "@test/harness"
import { beforeAll, describe, expect, test } from "vitest"

type ConfigContext = StandardGraph & Awaited<ReturnType<typeof pageWithLink>>

describe("config", () => {
  let context: ConfigContext
  const contentType = "api::page.page"
  let service: { get: (params: Record<string, unknown>) => Promise<Record<string, unknown>> }

  beforeAll(async () => {
    await setupStrapi()
    const graph = await seedStandardGraph()
    const link = await pageWithLink(graph.page)
    context = { ...graph, ...link } as ConfigContext
    service = strapi.plugin("deep-populate").service("populate") as unknown as typeof service
  })

  describe("deny", () => {
    const expectedBlocks = () => [
      { ...(context.sectionWithLink.doc.blocks as Record<string, unknown>[])[0], page: context.shallowTargetPage.doc },
    ]

    it("should not deeply populate denied relations", async () => {
      setPluginConfig({
        useCache: false,
        contentTypes: { [contentType]: { deny: { relations: [contentType] } } },
      })

      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.pageWithLink.documentId, populate: "*" })

      expect(document).toEqual({
        ...context.pageWithLink.doc,
        sections: [{ ...context.sectionWithLink.doc, blocks: expectedBlocks() }],
      })
    })

    it("should not populate denied components", async () => {
      setPluginConfig({
        useCache: false,
        contentTypes: { [contentType]: { deny: { components: ["shared.link"] } } },
      })

      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.pageWithLink.documentId, populate: "*" })

      expect(document).toEqual({
        ...context.pageWithLink.doc,
        sections: [{ ...context.sectionWithLink.doc, blocks: expectedBlocks() }],
      })
    })

    it("should not populate denied contenttypes from wildcard configuration", async () => {
      setPluginConfig({ useCache: false, contentTypes: { "*": { deny: { components: ["shared.link"] } } } })

      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.pageWithLink.documentId, populate: "*" })

      const section = await strapi
        .documents("api::section.section")
        .findOne({ documentId: context.sectionWithLink.documentId, populate: "*" })

      expect(document).toEqual({
        ...context.pageWithLink.doc,
        sections: [{ ...context.sectionWithLink.doc, blocks: expectedBlocks() }],
      })

      expect(section).toEqual({
        ...context.sectionWithLink.doc,
        blocks: expectedBlocks(),
      })
    })
  })

  describe("omitEmpty", () => {
    const sections: Record<string, unknown>[] = []

    beforeAll(async () => {
      sections.push((await createPage({ title: "relations-one" })).doc)
    })

    test("should not omitEmpty attributes when false", async () => {
      setPluginConfig({ useCache: false, omitEmpty: false })

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: undefined,
          omitEmpty: false,
        },
        image: true,
        localizations: true,
        members: true,
        sections: true,
      })
    })

    test("should omitEmpty attributes when true", async () => {
      setPluginConfig({ useCache: false, omitEmpty: true })

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: undefined,
          omitEmpty: true,
        },
      })
    })

    test("should be overridden by function params", async () => {
      setPluginConfig({ useCache: false, omitEmpty: false })

      const populate = await service.get({ contentType, documentId: sections[0].documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: undefined,
          omitEmpty: true,
        },
      })
    })

    test("should be overridden by content type omitEmpty", async () => {
      setPluginConfig({ useCache: false, omitEmpty: false, contentTypes: { [contentType]: { omitEmpty: true } } })

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: undefined,
          omitEmpty: true,
        },
      })
    })
  })

  describe("localizations", () => {
    let sections: Record<string, unknown>[]

    beforeAll(async () => {
      sections = [(await createPage({ title: "localizations" })).doc]
    })

    test("should exclude localizations when false", async () => {
      setPluginConfig({ useCache: false, localizations: false })

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: false,
          omitEmpty: undefined,
        },
        image: true,
        members: true,
        sections: true,
      })
    })

    test("should include localizations when true", async () => {
      setPluginConfig({ useCache: false, localizations: true })

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: true,
          omitEmpty: undefined,
        },
        localizations: true,
        image: true,
        members: true,
        sections: true,
      })
    })

    test("should be overridden by function param", async () => {
      setPluginConfig({ useCache: false, localizations: false })

      const populate = await service.get({ contentType, documentId: sections[0].documentId, localizations: true })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: true,
          omitEmpty: undefined,
        },
        localizations: true,
        image: true,
        members: true,
        sections: true,
      })
    })

    test("should be overridden by content type localizations configuration", async () => {
      setPluginConfig({
        useCache: false,
        localizations: false,
        contentTypes: { [contentType]: { localizations: true } },
      })

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: true,
          omitEmpty: undefined,
        },
        localizations: true,
        image: true,
        members: true,
        sections: true,
      })
    })

    test("should include localizations when true, regardless of omitEmpty", async () => {
      setPluginConfig({ useCache: false, localizations: true, omitEmpty: true })

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateSchemaConfig: {
          "api::page.page": { options: { selfReferencing: false } },
        },
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: true,
          omitEmpty: true,
        },
        localizations: true,
      })
    })
  })
})

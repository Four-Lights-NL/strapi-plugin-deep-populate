import { circularPair, createPage, createSection, uniqueValue } from "@test/factories"
import { clearCache, countCache, resetDatabase, setPluginConfig, setupStrapi, strapi } from "@test/harness"
import { beforeAll, describe, expect, test } from "vitest"

const SECTION = "api::section.section"
const PAGE = "api::page.page"
const CACHE = "plugin::deep-populate.cache"

describe("regression", () => {
  let service: { get: (params: Record<string, unknown>) => Promise<Record<string, unknown>> }

  beforeAll(async () => {
    await setupStrapi()
    service = strapi.plugin("deep-populate").service("populate") as unknown as typeof service
  })

  describe("circular & self-referential relations", () => {
    test("a section that references itself terminates", async () => {
      const section = await createSection({ name: uniqueValue("self-ref") })
      await section.update({ sections: { connect: [section.documentId] } })

      const populate = await service.get({ contentType: SECTION, documentId: section.documentId, omitEmpty: true })

      // The self-relation is already resolved, so it collapses to `true`.
      expect(populate.sections).toBe(true)
    })

    test("two sections referencing each other terminate", async () => {
      const { a, b } = await circularPair()

      const populateA = await service.get({ contentType: SECTION, documentId: a.documentId, omitEmpty: true })
      expect(populateA.sections).toStrictEqual({ populate: { sections: true } })

      const populateB = await service.get({ contentType: SECTION, documentId: b.documentId, omitEmpty: true })
      expect(populateB.sections).toStrictEqual({ populate: { sections: true } })
    })
  })

  describe("shared components in a dynamic zone", () => {
    test("merges the populate of multiple instances of the same component", async () => {
      const { documentId } = await createSection({
        name: uniqueValue("shared-blocks"),
        blocks: [
          {
            __component: "cms.cool-component",
            title: "with single",
            specialSingle: { isSpecial: true, name: "the single" },
          },
          {
            __component: "cms.cool-component",
            title: "with repeatable",
            specialRepeatable: [{ isSpecial: false, name: "the repeatable" }],
          },
        ],
      })

      const populate = await service.get({ contentType: SECTION, documentId, omitEmpty: true })
      expect(populate.blocks).toStrictEqual({
        on: {
          "cms.cool-component": {
            populate: {
              specialSingle: true,
              specialRepeatable: true,
            },
          },
        },
      })
    })
  })

  describe("published status via wildcard", () => {
    test("deeply populates a published document", async () => {
      const child = await createSection({ name: uniqueValue("published-child") })
      const parent = await createSection({ name: uniqueValue("published-parent"), sections: [child.documentId] })

      await child.publish()
      await parent.publish()

      const document = await strapi.documents(SECTION).findOne({
        documentId: parent.documentId,
        populate: "*",
        status: "published",
      })

      expect(document.publishedAt).toBeTruthy()
      expect(document.sections).toHaveLength(1)
      expect(document.sections[0].documentId).toBe(child.documentId)
    })
  })

  describe("i18n localizations", () => {
    test("includes localizations when requested", async () => {
      const page = await createPage({ title: uniqueValue("i18n-en") })
      await page.localize("fr", { title: uniqueValue("i18n-fr") })

      setPluginConfig({ useCache: false, localizations: true })

      const populate = await service.get({ contentType: PAGE, documentId: page.documentId })
      expect(populate.localizations).toBe(true)

      const document = await strapi.documents(PAGE).findOne({
        documentId: page.documentId,
        populate: "*",
      })
      expect(Array.isArray(document.localizations)).toBe(true)
      expect(document.localizations.length).toBeGreaterThan(0)
    })
  })

  describe("findMany wildcard with filters and pagination", () => {
    test("keeps filters and pagination while deep populating", async () => {
      const prefix = uniqueValue("findmany")
      const pages = [0, 1, 2].map(() => createPage({ title: uniqueValue(prefix) }))
      await Promise.all(pages)

      const documents = await strapi.documents(PAGE).findMany({
        filters: { title: { $startsWith: prefix } },
        sort: "title:asc",
        limit: 2,
        populate: "*",
      })

      expect(documents).toHaveLength(2)
      for (const document of documents) {
        expect(Array.isArray(document.sections)).toBe(true)
      }
    })
  })

  describe("delete clears the cache", () => {
    test("removing a document removes its cached populate", async () => {
      await resetDatabase()
      await clearCache()

      const section = await createSection({ name: uniqueValue("delete-me") })
      await strapi.documents(SECTION).findOne({ documentId: section.documentId, populate: "*" })
      expect(await countCache()).toBe(1)

      await strapi.documents(SECTION).delete({ documentId: section.documentId })
      expect(await countCache()).toBe(0)
    })
  })

  describe("useCache: false", () => {
    test("does not write to the cache", async () => {
      await clearCache()
      setPluginConfig({ useCache: false })

      const section = await createSection({ name: uniqueValue("no-cache") })
      const document = await strapi.documents(SECTION).findOne({
        documentId: section.documentId,
        populate: "*",
      })

      expect(document).toBeDefined()
      expect(await countCache()).toBe(0)
    })
  })

  describe("dependent invalidation", () => {
    test("updating a grandchild invalidates the grandparent cache", async () => {
      await resetDatabase()
      setPluginConfig({ useCache: true })

      const grandchild = await createSection({ name: uniqueValue("grandchild") })
      const child = await createSection({ name: uniqueValue("child"), sections: [grandchild.documentId] })
      const parent = await createSection({ name: uniqueValue("parent"), sections: [child.documentId] })

      const before = await strapi.documents(SECTION).findOne({
        documentId: parent.documentId,
        populate: "*",
      })
      expect(before.sections[0].sections[0].name).toBe(grandchild.doc.name)

      await grandchild.update({ name: uniqueValue("grandchild-updated") })

      const after = await strapi.documents(SECTION).findOne({
        documentId: parent.documentId,
        populate: "*",
      })
      expect(after.sections[0].sections[0].name).not.toBe(grandchild.doc.name)
    })
  })

  describe("allow wildcard", () => {
    test("shallow-populates relations and components not on the wildcard allow list", async () => {
      setPluginConfig({ useCache: false, contentTypes: { "*": { allow: { relations: [], components: [] } } } })

      const child = await createSection({ name: uniqueValue("allow-child") })
      const parent = await createSection({
        name: uniqueValue("allow-parent"),
        sections: [child.documentId],
        singleCoolComponent: { title: "allowed?", isCool: true },
      })

      const populate = await service.get({
        contentType: SECTION,
        documentId: parent.documentId,
        omitEmpty: true,
      })

      expect(populate.sections).toBe(true)
      expect(populate.singleCoolComponent).toBe(true)
    })
  })

  describe("cache hash uniqueness", () => {
    test("caches each document separately", async () => {
      await resetDatabase()
      const a = await createSection({ name: uniqueValue("hash-a") })
      const b = await createSection({ name: uniqueValue("hash-b") })

      await strapi.documents(SECTION).findOne({ documentId: a.documentId, populate: "*" })
      await strapi.documents(SECTION).findOne({ documentId: b.documentId, populate: "*" })

      const entries = await strapi.documents(CACHE).findMany({})
      expect(entries).toHaveLength(2)
    })
  })
})

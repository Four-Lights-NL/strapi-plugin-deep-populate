import type { Core, Modules } from "@strapi/strapi"

import { createSection } from "@test/factories"
import { resetDatabase, setPluginConfig, setupStrapi, strapi } from "@test/harness"
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest"

const mockDate = "2025-01-01T12:00:00.000Z"

const getNonPopulated = ({ id, documentId, name }: { id: unknown; documentId: unknown; name?: unknown }) => ({
  documentId,
  id,
  name,
  content: null,
  locale: "en",
  publishedAt: null,
  createdAt: mockDate,
  updatedAt: mockDate,
})

const getDeeplyPopulated = ({
  id,
  documentId,
  name,
  sections = [],
}: {
  id: unknown
  documentId: unknown
  name?: unknown
  sections?: unknown[]
}) => ({
  documentId,
  id,
  name,
  sections,
  content: null,
  locale: "en",
  publishedAt: null,
  singleCoolComponent: null,
  target: null,
  blocks: [],
  coolitems: [],
  localizations: [],
  createdAt: mockDate,
  updatedAt: mockDate,
})

describe("lifecycle", () => {
  const contentType = "api::section.section" as const
  const OriginalDate = Date

  const sections: Record<string, Modules.Documents.AnyDocument> = {}
  const expected: Record<string, object> = {}

  beforeAll(async () => {
    await setupStrapi()

    global.Date = class extends OriginalDate {
      constructor() {
        super(mockDate)
      }

      static now() {
        return new OriginalDate(mockDate).getTime()
      }
    } as DateConstructor

    // A clean slate so `findMany` only sees this suite's sections.
    await resetDatabase()

    sections.third = (await createSection({ name: "level-three" })).doc as unknown as Modules.Documents.AnyDocument
    sections.second = (await createSection({ name: "level-two", sections: { connect: [sections.third.documentId] } }))
      .doc as unknown as Modules.Documents.AnyDocument
    sections.first = (await createSection({ name: "level-one", sections: { connect: [sections.second.documentId] } }))
      .doc as unknown as Modules.Documents.AnyDocument

    expected.thirdNonPopulated = getNonPopulated(sections.third)
    expected.secondNonPopulated = getNonPopulated(sections.second)
    expected.firstNonPopulated = getNonPopulated(sections.first)

    expected.thirdDeeplyPopulated = getDeeplyPopulated(sections.third)
    expected.secondDeeplyPopulated = getDeeplyPopulated({
      ...sections.second,
      sections: [expected.thirdDeeplyPopulated],
    })
    expected.firstDeeplyPopulated = getDeeplyPopulated({
      ...sections.first,
      sections: [expected.secondDeeplyPopulated],
    })
  })

  afterAll(() => {
    global.Date = OriginalDate
  })

  describe("find", () => {
    describe("findOne", () => {
      test("should fallback to strapi default when populate is not `*`", async () => {
        const document = await strapi.documents(contentType).findOne({
          documentId: sections.first.documentId,
        })

        expect(document).toEqual(expected.firstNonPopulated)
      })

      test("should return deeply nested object when populate is `*`", async () => {
        const document = await strapi.documents(contentType).findOne({
          documentId: sections.first.documentId,
          populate: "*",
        })

        expect(document).toEqual(expected.firstDeeplyPopulated)
      })
    })

    describe("findFirst", () => {
      test("should fallback to strapi default when populate is not `*`", async () => {
        const document = await strapi.documents(contentType).findFirst({ filters: { name: { $eq: "level-one" } } })

        expect(document).toEqual(expected.firstNonPopulated)
      })

      test("should return deeply populated results when populate is `*`", async () => {
        const document = await strapi
          .documents(contentType)
          .findFirst({ filters: { name: { $eq: "level-one" } }, populate: "*" })
        expect(document).toEqual(expected.firstDeeplyPopulated)
      })
    })

    describe("findMany", () => {
      test("should fallback to strapi default when populate is not `*`", async () => {
        const documents = await strapi.documents(contentType).findMany({ locale: null, sort: "id:desc" })
        expect(documents).toEqual([expected.firstNonPopulated, expected.secondNonPopulated, expected.thirdNonPopulated])
      })

      test("should return deeply populated results when populate is `*`", async () => {
        const documents = await strapi.documents(contentType).findMany({ locale: null, sort: "id:desc", populate: "*" })
        expect(documents).toEqual([
          expected.firstDeeplyPopulated,
          expected.secondDeeplyPopulated,
          expected.thirdDeeplyPopulated,
        ])
      })
    })
  })

  describe("cache with no warmOnWrite", () => {
    let cacheService: Core.Service
    let getCacheSpy: ReturnType<typeof vi.spyOn>
    let setCacheSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      cacheService = strapi.service("plugin::deep-populate.cache")
      getCacheSpy = vi.spyOn(cacheService, "get")
      setCacheSpy = vi.spyOn(cacheService, "set")
    })

    test("create should not warm the cache in lazy mode", async () => {
      const created = await createSection({ name: "cached" })

      expect(getCacheSpy).toHaveBeenCalledTimes(0)
      expect(setCacheSpy).toHaveBeenCalledTimes(0)

      // Next read should populate the cache via the cache-miss path
      const document = await strapi.documents(contentType).findOne({
        documentId: created.documentId,
        populate: "*",
      })

      expect(document).toBeDefined()
      expect(getCacheSpy).toHaveBeenCalledTimes(1)
      expect(setCacheSpy).toHaveBeenCalledTimes(1)
    })

    test("should retrieve the cached result", async () => {
      const document = await strapi.documents(contentType).findOne({
        documentId: sections.first.documentId,
        populate: "*",
      })

      expect(document).toEqual(expected.firstDeeplyPopulated)
      expect(getCacheSpy).toHaveBeenCalledTimes(1)
      expect(setCacheSpy).toHaveBeenCalledTimes(0)
    })

    test("clear should delete the cached entry", async () => {
      const params = {
        contentType: contentType,
        documentId: sections.first.documentId,
        locale: null,
      }

      const cachedResult = await cacheService.get(params)
      expect(cachedResult).toBeDefined()

      await strapi.service("plugin::deep-populate.cache").clear(params)

      const clearedResult = await cacheService.get(params)
      expect(clearedResult).toBeNull()
    })

    test("should invalidate cached entry for updated dependants", async () => {
      const clearCacheSpy = vi.spyOn(cacheService, "clear")
      const refreshDependentsCacheSpy = vi.spyOn(cacheService, "refreshDependents")

      const nestedSection = await createSection({ name: "nestedSection" })
      const parentSection = await createSection({ name: "parentSection", sections: [nestedSection.documentId] })

      await strapi.documents(contentType).findOne({ documentId: nestedSection.documentId, populate: "*" })
      await strapi.documents(contentType).findOne({ documentId: parentSection.documentId, populate: "*" })

      setCacheSpy.mockReset()

      await strapi.documents(contentType).update({
        documentId: nestedSection.documentId,
        locale: nestedSection.doc.locale as string,
        status: nestedSection.doc.status as "draft" | "published" | undefined,
        data: { name: "nestedSectionUpdated" } as Partial<Modules.Documents.Params.Data.Input<typeof contentType>>,
      })

      expect(clearCacheSpy).toHaveBeenCalledTimes(1)
      expect(refreshDependentsCacheSpy).toHaveBeenCalledTimes(1)
      expect(setCacheSpy).toHaveBeenCalledTimes(0)
    })

    test("should return fresh data after dependent invalidation", async () => {
      const nestedSection = await createSection({ name: "staleCheck" })
      const parentSection = await createSection({ name: "staleCheckParent", sections: [nestedSection.documentId] })

      const before = await strapi.documents(contentType).findOne({
        documentId: parentSection.documentId,
        populate: "*",
      })
      expect(before.sections[0].name).toBe("staleCheck")

      await strapi.documents(contentType).update({
        documentId: nestedSection.documentId,
        data: { name: "staleCheckUpdated" } as Partial<Modules.Documents.Params.Data.Input<typeof contentType>>,
      })

      const after = await strapi.documents(contentType).findOne({
        documentId: parentSection.documentId,
        populate: "*",
      })
      expect(after.sections[0].name).toBe("staleCheckUpdated")
    })

    test("should update cache when bustCache is true", async () => {
      const nestedSection = await createSection({ name: "bustNested" })
      const parentSection = await createSection({ name: "bustParent", sections: [nestedSection.documentId] })

      await strapi.documents(contentType).findOne({ documentId: parentSection.documentId, populate: "*" })
      expect(setCacheSpy).toHaveBeenCalledTimes(1)
      setCacheSpy.mockReset()

      await strapi.documents(contentType).findOne({ documentId: parentSection.documentId, populate: "*" })
      expect(setCacheSpy).toHaveBeenCalledTimes(0)

      await strapi
        .documents(contentType)
        .findOne({ documentId: parentSection.documentId, populate: "*", bustCache: true })

      expect(setCacheSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("cache with warmOnWrite", () => {
    let cacheService: Core.Service
    let getCacheSpy: ReturnType<typeof vi.spyOn>
    let setCacheSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      cacheService = strapi.service("plugin::deep-populate.cache")
      getCacheSpy = vi.spyOn(cacheService, "get")
      setCacheSpy = vi.spyOn(cacheService, "set")
      setPluginConfig({ useCache: true, cacheOptions: { warmOnWrite: true } })
    })

    test("create should warm the cache", async () => {
      await createSection({ name: "eagerCached" })

      expect(getCacheSpy).toHaveBeenCalledTimes(1)
      expect(setCacheSpy).toHaveBeenCalledTimes(1)
    })

    test("should re-warm cache for updated dependants", async () => {
      const clearCacheSpy = vi.spyOn(cacheService, "clear")
      const refreshDependentsCacheSpy = vi.spyOn(cacheService, "refreshDependents")

      const nestedSection = await createSection({ name: "eagerNested" })
      const _parentSection = await createSection({ name: "eagerParent", sections: [nestedSection.documentId] })

      expect(setCacheSpy).toHaveBeenCalledTimes(2)
      setCacheSpy.mockReset()
      clearCacheSpy.mockReset()
      refreshDependentsCacheSpy.mockReset()

      await strapi.documents(contentType).update({
        documentId: nestedSection.documentId,
        locale: nestedSection.doc.locale as string,
        status: nestedSection.doc.status as "draft" | "published" | undefined,
        data: { name: "eagerNestedUpdated" } as Partial<Modules.Documents.Params.Data.Input<typeof contentType>>,
      })

      expect(clearCacheSpy).toHaveBeenCalledTimes(1)
      expect(refreshDependentsCacheSpy).toHaveBeenCalledTimes(1)
      expect(setCacheSpy).toHaveBeenCalledTimes(2)
    })
  })
})

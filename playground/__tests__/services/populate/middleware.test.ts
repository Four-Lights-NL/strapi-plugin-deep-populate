import type { Core, Data, Modules } from "@strapi/strapi"

import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"

const mockDate = "2025-01-01T12:00:00.000Z"

const getNonPopulated = ({ id, documentId, name }) => ({
  documentId,
  id,
  name,
  content: null,
  locale: "en",
  publishedAt: null,
  createdAt: mockDate,
  updatedAt: mockDate,
})

const getDeeplyPopulated = ({ id, documentId, name, sections = [] }) => ({
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

    // Make sure the relevant objects exist
    sections.third = await strapi.documents(contentType).create({ data: { name: "level-three" } })
    sections.second = await strapi.documents(contentType).create({
      data: { name: "level-two", sections: { connect: [sections.third.documentId] } },
    })
    sections.first = await strapi.documents(contentType).create({
      data: { name: "level-one", sections: { connect: [sections.second.documentId] } },
    })

    // Re-usable expectations for cleaner tests
    // non-populated
    expected.thirdNonPopulated = getNonPopulated(sections.third as Data.Entity<typeof contentType>)
    expected.secondNonPopulated = getNonPopulated(sections.second as Data.Entity<typeof contentType>)
    expected.firstNonPopulated = getNonPopulated(sections.first as Data.Entity<typeof contentType>)

    // deeply populated
    expected.thirdDeeplyPopulated = getDeeplyPopulated(sections.third as Data.Entity<typeof contentType>)
    expected.secondDeeplyPopulated = getDeeplyPopulated({
      ...sections.second,
      sections: [expected.thirdDeeplyPopulated],
    } as Data.Entity<typeof contentType>)
    expected.firstDeeplyPopulated = getDeeplyPopulated({
      ...sections.first,
      sections: [expected.secondDeeplyPopulated],
    } as Data.Entity<typeof contentType>)
  })

  afterAll(async () => {
    await teardownStrapi()
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
    let getCacheSpy: ReturnType<typeof vitest.spyOn>
    let setCacheSpy: ReturnType<typeof vitest.spyOn>

    beforeAll(() => {
      cacheService = strapi.service("plugin::deep-populate.cache")
      getCacheSpy = vitest.spyOn(cacheService, "get")
      setCacheSpy = vitest.spyOn(cacheService, "set")
    })

    beforeEach(() => {
      getCacheSpy.mockReset()
      setCacheSpy.mockReset()
    })

    test("create should not warm the cache in lazy mode", async () => {
      const created = await strapi.documents(contentType).create({ data: { name: "cached" } })

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

      // Check to see if the cache is populated
      const cachedResult = await cacheService.get(params)
      expect(cachedResult).toBeDefined()

      // Clear the cache
      await strapi.service("plugin::deep-populate.cache").clear(params)

      // Try to get the cache
      const clearedResult = await cacheService.get(params)
      expect(clearedResult).toBeNull()
    })

    test("should invalidate cached entry for updated dependants", async () => {
      const clearCacheSpy = vitest.spyOn(cacheService, "clear")
      const refreshDependentsCacheSpy = vitest.spyOn(cacheService, "refreshDependents")

      // Create nested + parent and populate their caches via reads
      const nestedSection = await strapi.documents(contentType).create({
        data: { name: "nestedSection" },
      })
      const parentSection = await strapi.documents(contentType).create({
        data: { name: "parentSection", sections: [nestedSection.documentId] },
      })

      // Populate cache for both via read path
      await strapi.documents(contentType).findOne({ documentId: nestedSection.documentId, populate: "*" })
      await strapi.documents(contentType).findOne({ documentId: parentSection.documentId, populate: "*" })

      setCacheSpy.mockReset()

      await strapi.documents(contentType).update({
        documentId: nestedSection.documentId,
        locale: nestedSection.locale,
        status: nestedSection.status,
        data: { name: "nestedSectionUpdated" } as Partial<Modules.Documents.Params.Data.Input<typeof contentType>>,
      })

      expect(clearCacheSpy).toHaveBeenCalledTimes(1)
      expect(refreshDependentsCacheSpy).toHaveBeenCalledTimes(1)
      expect(setCacheSpy).toHaveBeenCalledTimes(0)

      clearCacheSpy.mockClear()
      refreshDependentsCacheSpy.mockClear()
    })

    test("should return fresh data after dependent invalidation", async () => {
      // Create nested + parent and populate their caches via reads
      const nestedSection = await strapi.documents(contentType).create({
        data: { name: "staleCheck" },
      })
      const parentSection = await strapi.documents(contentType).create({
        data: { name: "staleCheckParent", sections: [nestedSection.documentId] },
      })

      // Populate cache for the parent via read
      const before = await strapi.documents(contentType).findOne({
        documentId: parentSection.documentId,
        populate: "*",
      })
      expect(before.sections[0].name).toBe("staleCheck")

      // Update the nested document
      await strapi.documents(contentType).update({
        documentId: nestedSection.documentId,
        data: { name: "staleCheckUpdated" } as Partial<Modules.Documents.Params.Data.Input<typeof contentType>>,
      })

      // The parent's cache entry should have been invalidated; next read returns fresh data
      const after = await strapi.documents(contentType).findOne({
        documentId: parentSection.documentId,
        populate: "*",
      })
      expect(after.sections[0].name).toBe("staleCheckUpdated")
    })

    test("should update cache when bustCache is true", async () => {
      const nestedSection = await strapi.documents(contentType).create({
        data: { name: "nestedSection" },
      })

      const parentSection = await strapi.documents(contentType).create({
        data: { name: "parentSection", sections: [nestedSection.documentId] },
      })

      // Populate cache for parent via read
      await strapi.documents(contentType).findOne({ documentId: parentSection.documentId, populate: "*" })
      expect(setCacheSpy).toHaveBeenCalledTimes(1)
      setCacheSpy.mockReset()

      // Cached, so no set
      await strapi.documents(contentType).findOne({ documentId: parentSection.documentId, populate: "*" })
      expect(setCacheSpy).toHaveBeenCalledTimes(0)

      // bustCache forces re-computation
      await strapi
        .documents(contentType)
        .findOne({ documentId: parentSection.documentId, populate: "*", bustCache: true })

      expect(setCacheSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("cache with warmOnWrite", () => {
    let cacheService: Core.Service
    let getCacheSpy: ReturnType<typeof vitest.spyOn>
    let setCacheSpy: ReturnType<typeof vitest.spyOn>
    let originalConfigGet: typeof strapi.config.get
    let configSpy: ReturnType<typeof vitest.spyOn>

    beforeAll(() => {
      cacheService = strapi.service("plugin::deep-populate.cache")
      getCacheSpy = vitest.spyOn(cacheService, "get")
      setCacheSpy = vitest.spyOn(cacheService, "set")

      originalConfigGet = strapi.config.get
      configSpy = vitest.spyOn(strapi.config, "get")
      configSpy.mockImplementation((key) => {
        const config = originalConfigGet.call(strapi.config, key)
        if (key === "plugin::deep-populate") {
          return {
            ...(config as object),
            useCache: true,
            cacheOptions: { warmOnWrite: true },
          }
        }
        return config
      })
    })

    afterAll(() => {
      configSpy.mockRestore()
    })

    beforeEach(() => {
      getCacheSpy.mockReset()
      setCacheSpy.mockReset()
    })

    test("create should warm the cache", async () => {
      await strapi.documents(contentType).create({ data: { name: "eagerCached" } })

      expect(getCacheSpy).toHaveBeenCalledTimes(1)
      expect(setCacheSpy).toHaveBeenCalledTimes(1)
    })

    test("should re-warm cache for updated dependants", async () => {
      const clearCacheSpy = vitest.spyOn(cacheService, "clear")
      const refreshDependentsCacheSpy = vitest.spyOn(cacheService, "refreshDependents")

      const nestedSection = await strapi.documents(contentType).create({
        data: { name: "eagerNested" },
      })
      const _parentSection = await strapi.documents(contentType).create({
        data: { name: "eagerParent", sections: [nestedSection.documentId] },
      })

      // Both creates warm the cache
      expect(setCacheSpy).toHaveBeenCalledTimes(2)
      setCacheSpy.mockReset()
      clearCacheSpy.mockReset()
      refreshDependentsCacheSpy.mockReset()

      // Update nested
      await strapi.documents(contentType).update({
        documentId: nestedSection.documentId,
        locale: nestedSection.locale,
        status: nestedSection.status,
        data: { name: "eagerNestedUpdated" } as Partial<Modules.Documents.Params.Data.Input<typeof contentType>>,
      })

      expect(clearCacheSpy).toHaveBeenCalledTimes(1)
      expect(refreshDependentsCacheSpy).toHaveBeenCalledTimes(1)
      // Should have rewarmed: 1 for the updated doc + 1 for the dependent parent
      expect(setCacheSpy).toHaveBeenCalledTimes(2)

      clearCacheSpy.mockClear()
      refreshDependentsCacheSpy.mockClear()
    })
  })
})

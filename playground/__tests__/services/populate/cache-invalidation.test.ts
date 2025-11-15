import type { UID } from "@strapi/strapi"
import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"
import type { UnwrapPromise } from "../../helpers/unwrapPromise"

describe("cache invalidation", () => {
  const contentType = "api::page.page" as const
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>>

  let originalConfigGet: typeof strapi.config.get
  let configSpy: ReturnType<typeof vitest.spyOn>
  let configContentTypes: Partial<Record<UID.ContentType | "*", any>>
  let omitEmpty: boolean | undefined
  let localizations: boolean | undefined

  beforeAll(async () => {
    await setupStrapi()

    // Setup config mocking
    originalConfigGet = strapi.config.get
    configSpy = vitest.spyOn(strapi.config, "get")
    configContentTypes = {}
    omitEmpty = false
    localizations = false

    configSpy.mockImplementation((key) => {
      const config = {
        ...originalConfigGet.call(strapi.config, key),
        useCache: true,
        replaceWildcard: true,
        localizations,
        omitEmpty,
      }
      if (key === "plugin::deep-populate") {
        return {
          ...(config as object),
          contentTypes: configContentTypes,
        }
      }
      return config
    })

    // Setup test data
    context = await setupDocuments()
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  beforeEach(async () => {
    configSpy.mockClear()
    // Reset config
    Object.keys(configContentTypes).map((k) => delete configContentTypes[k])
    omitEmpty = false
    localizations = false
  })

  it("should invalidate cache when omitEmpty changes from false to true", async () => {
    // Initial config: omitEmpty = false
    omitEmpty = false

    // First request - populate cache with empty relations included
    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify the document has the expected structure with empty relations
    expect(doc1).toHaveProperty("image", null)
    expect(doc1).toHaveProperty("members", [])
    expect(doc1).toHaveProperty("sections")

    // Change config: omitEmpty = true
    omitEmpty = true

    // Second request - should invalidate cache and return new populate without empty relations
    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify sections is still populated (has actual data) but empty relations are omitted
    expect(doc2).toHaveProperty("sections")
    // The document should not have image and members fields when omitEmpty is true
    expect(doc2).not.toHaveProperty("image")
    expect(doc2).not.toHaveProperty("members")
  })

  it("should invalidate cache when omitEmpty changes from true to false", async () => {
    // Initial config: omitEmpty = true
    omitEmpty = true

    // First request - populate cache without empty relations
    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify empty relations are omitted
    expect(doc1).toHaveProperty("sections")
    expect(doc1).not.toHaveProperty("image")
    expect(doc1).not.toHaveProperty("members")

    // Change config: omitEmpty = false
    omitEmpty = false

    // Second request - should invalidate cache and return new populate with empty relations
    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify empty relations are now included
    expect(doc2).toHaveProperty("image", null)
    expect(doc2).toHaveProperty("members", [])
    expect(doc2).toHaveProperty("sections")
  })

  it("should invalidate cache when allow relations changes", async () => {
    omitEmpty = true
    configContentTypes[contentType] = {
      allow: { relations: ["api::section.section"] },
    }

    // First request - should only populate sections
    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify sections is populated but other relations are not
    expect(doc1).toHaveProperty("sections")
    for (const section of doc1.sections) {
      expect(section).toHaveProperty("sections")
    }
    expect(doc1).not.toHaveProperty("image")
    expect(doc1).not.toHaveProperty("members")

    // Change config: empty allow list (no relations)
    configContentTypes[contentType] = {
      allow: {},
      deny: { relations: ["api::section.section"] },
    }

    // Second request - should invalidate cache and return no relations
    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify no relations are populated
    expect(doc2).toHaveProperty("sections")
    for (const section of doc2.sections) {
      expect(section).not.toHaveProperty("sections")
    }
    expect(doc2).not.toHaveProperty("image")
    expect(doc2).not.toHaveProperty("members")
  })

  it("should invalidate cache when deny relations changes", async () => {
    omitEmpty = false
    configContentTypes[contentType] = {
      deny: { relations: [] },
    }

    // First request - should populate all relations
    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify all relations are populated
    expect(doc1).toHaveProperty("sections")

    for (const section of doc1.sections) {
      expect(section).toHaveProperty("sections")
    }

    expect(doc1).toHaveProperty("image", null) // image is empty but should be populated
    expect(doc1).toHaveProperty("members", []) // members is empty but should be populated

    // Change config: deny sections relation
    configContentTypes[contentType] = {
      deny: { relations: ["api::section.section"] },
    }

    // Second request - should invalidate cache and exclude denied relation
    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify sections is not populated but other relations are
    expect(doc2).toHaveProperty("sections")

    for (const section of doc2.sections) {
      expect(section).not.toHaveProperty("sections")
    }
    expect(doc2).toHaveProperty("image", null)
    expect(doc2).toHaveProperty("members", [])
  })

  it("should invalidate cache when localizations changes from false to true", async () => {
    // Initial config: localizations = false
    localizations = false

    // First request - should not include localizations
    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify localizations is not populated
    expect(doc1).not.toHaveProperty("localizations")
    expect(doc1).toHaveProperty("image", null)

    // Change config: localizations = true
    localizations = true

    // Second request - should invalidate cache and include localizations
    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify localizations is now populated
    expect(doc2).toHaveProperty("localizations")
    expect(doc2).toHaveProperty("image", null)
  })

  it("should invalidate cache when localizations changes from true to false", async () => {
    // Initial config: localizations = true
    localizations = true

    // First request - should include localizations
    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify localizations is populated
    expect(doc1).toHaveProperty("localizations")
    expect(doc1).toHaveProperty("image", null)

    // Change config: localizations = false
    localizations = false

    // Second request - should invalidate cache and exclude localizations
    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    // Verify localizations is not populated
    expect(doc2).not.toHaveProperty("localizations")
    expect(doc2).toHaveProperty("image", null)
  })
})

import type { Core, Data, Modules, UID } from "@strapi/strapi"
import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"
import type { UnwrapPromise } from "../../helpers/unwrapPromise"

describe("config", () => {
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>> & {
    sectionWithLink: Data.Entity
    pageWithLink: Data.Entity
    shallowPopulatedTargetPage: Data.Entity
  }
  const contentType = "api::page.page"

  let originalConfigGet: typeof strapi.config.get
  let configSpy: ReturnType<typeof vitest.spyOn>

  const configContentTypes: Record<UID.ContentType, any> = {}
  let omitEmpty: boolean | undefined
  let localizations: boolean | undefined

  beforeAll(async () => {
    await setupStrapi()

    originalConfigGet = strapi.config.get
    configSpy = vitest.spyOn(strapi.config, "get")
    configSpy.mockImplementation((key) => {
      const config = { ...originalConfigGet.call(strapi.config, key), useCache: false, localizations, omitEmpty }
      if (key === "plugin::deep-populate") {
        return {
          ...(config as object),
          contentTypes: configContentTypes,
        }
      }
      return config
    })

    context = (await setupDocuments()) as unknown as typeof context

    context.sectionWithLink = await strapi.documents("api::section.section").create({
      data: {
        blocks: [
          {
            __component: "shared.link",
            label: "to main page",
            page: context.page.documentId,
          },
        ],
      },
      populate: ["localizations", "target", "singleCoolComponent", "sections", "coolitems", "blocks"],
    })

    context.pageWithLink = await strapi.documents(contentType).create({
      data: {
        title: "page with link",
        sections: [context.sectionWithLink.documentId],
      },
      populate: ["image", "localizations", "members"],
    })

    context.shallowPopulatedTargetPage = await strapi
      .documents(contentType)
      .findOne({ documentId: context.page.documentId })
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  beforeEach(async () => {
    configSpy.mockClear()
  })

  describe("deny", () => {
    it("should not populate denied relations", async () => {
      configContentTypes[contentType] = {
        deny: { relations: [contentType] },
      }

      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.pageWithLink.documentId, populate: "*" })

      expect(document).toEqual({
        ...context.pageWithLink,
        sections: [
          {
            ...context.sectionWithLink,
            blocks: [{ ...context.sectionWithLink.blocks[0], page: context.shallowPopulatedTargetPage }],
          },
        ],
      })
    })

    it("should not populate denied components", async () => {
      configContentTypes[contentType] = {
        deny: { components: ["shared.link"] },
      }

      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.pageWithLink.documentId, populate: "*" })

      expect(document).toEqual({
        ...context.pageWithLink,
        sections: [
          {
            ...context.sectionWithLink,
            blocks: [{ ...context.sectionWithLink.blocks[0], page: context.shallowPopulatedTargetPage }],
          },
        ],
      })
    })

    it("should not populate denied contenttypes from wildcard configuration", async () => {
      configContentTypes["*"] = {
        deny: { components: ["shared.link"] },
      }

      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.pageWithLink.documentId, populate: "*" })

      const section = await strapi
        .documents("api::section.section")
        .findOne({ documentId: context.sectionWithLink.documentId, populate: "*" })

      expect(document).toEqual({
        ...context.pageWithLink,
        sections: [
          {
            ...context.sectionWithLink,
            blocks: [{ ...context.sectionWithLink.blocks[0], page: context.shallowPopulatedTargetPage }],
          },
        ],
      })

      expect(section).toEqual({
        ...context.sectionWithLink,
        blocks: [{ ...context.sectionWithLink.blocks[0], page: context.shallowPopulatedTargetPage }],
      })
    })
  })

  describe("omitEmpty", async () => {
    let service: Core.Service
    const sections: Modules.Documents.AnyDocument[] = []

    beforeAll(async () => {
      sections.push(await strapi.documents(contentType).create({ data: { name: "relations-one" } }))
      service = strapi.plugin("deep-populate").service("populate")
    })

    beforeEach(() => {
      localizations = undefined
      omitEmpty = undefined

      Object.keys(configContentTypes).map((k) => delete configContentTypes[k])
    })

    test("should not omitEmpty attributes when false", async () => {
      omitEmpty = false

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        image: true,
        localizations: true,
        members: true,
        sections: true,
      })
    })

    test("should omitEmpty attributes when true", async () => {
      omitEmpty = true

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({ __deepPopulated: true })
    })

    test("should be overriden by function params", async () => {
      omitEmpty = false

      const populate = await service.get({ contentType, documentId: sections[0].documentId, omitEmpty: true })
      expect(populate).toStrictEqual({ __deepPopulated: true })
    })

    test("should be overriden by content type omitEmpty", async () => {
      omitEmpty = false
      configContentTypes[contentType] = { omitEmpty: true }

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({ __deepPopulated: true })
    })
  })

  describe("localizations", async () => {
    let service: Core.Service
    const sections: Modules.Documents.AnyDocument[] = []

    beforeAll(async () => {
      sections.push(await strapi.documents(contentType).create({ data: { name: "relations-one" } }))
      service = strapi.plugin("deep-populate").service("populate")
    })

    beforeEach(() => {
      localizations = undefined
      omitEmpty = undefined

      Object.keys(configContentTypes).map((k) => delete configContentTypes[k])
    })

    test("should exclude localizations when false", async () => {
      localizations = false

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({ __deepPopulated: true, image: true, members: true, sections: true })
    })

    test("should include localizations when true", async () => {
      localizations = true

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        localizations: true,
        image: true,
        members: true,
        sections: true,
      })
    })

    test("should be overriden by function param", async () => {
      localizations = false

      const populate = await service.get({ contentType, documentId: sections[0].documentId, localizations: true })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        localizations: true,
        image: true,
        members: true,
        sections: true,
      })
    })

    test("should be overriden by content type localizations configuration", async () => {
      localizations = false
      configContentTypes[contentType] = { localizations: true }

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        localizations: true,
        image: true,
        members: true,
        sections: true,
      })
    })

    test("should include localizations when true, regardless of omitEmpty", async () => {
      localizations = true
      omitEmpty = true

      const populate = await service.get({ contentType, documentId: sections[0].documentId })
      expect(populate).toStrictEqual({ __deepPopulated: true, localizations: true })
    })
  })
})

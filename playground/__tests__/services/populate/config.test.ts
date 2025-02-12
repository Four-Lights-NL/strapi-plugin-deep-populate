import type { Data, UID } from "@strapi/strapi"
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

  const configContentTypes: Record<UID.ContentType, unknown> = {}

  beforeAll(async () => {
    await setupStrapi()

    originalConfigGet = strapi.config.get
    configSpy = vitest.spyOn(strapi.config, "get")
    configSpy.mockImplementation((key) => {
      const config = { ...originalConfigGet.call(strapi.config, key), useCache: false }
      if (key === "plugin::deep-populate")
        return {
          ...(config as object),
          contentTypes: configContentTypes,
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

  describe("blacklist", () => {
    test("should not populate blacklisted relations", async () => {
      configContentTypes[contentType] = {
        blacklist: { relations: [contentType] },
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

    test("should not populate blacklisted components", async () => {
      configContentTypes[contentType] = {
        blacklist: { components: ["shared.link"] },
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
  })
})

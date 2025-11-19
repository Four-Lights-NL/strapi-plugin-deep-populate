import get from "lodash/get"

import type { UnwrapPromise } from "../../helpers/unwrapPromise"

import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"

describe("documents", () => {
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>>
  const contentType = "api::page.page"

  beforeAll(async () => {
    await setupStrapi()
    context = await setupDocuments()
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  describe("findOne", () => {
    test("should return fully populated document when provided with `*`", async () => {
      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.page.documentId, populate: "*" })

      const expected: Record<string, object> = {}
      expected.nestedSection = context.nestedSection
      expected.primarySection = {
        ...context.primarySection,
        sections: [expected.nestedSection],
      }
      expected.page = {
        ...context.page,
        sections: [expected.primarySection],
      }

      expect(get(document, "sections.0.sections.0")).toEqual(expected.nestedSection)
      expect(get(document, "sections.0")).toEqual(expected.primarySection)
      expect(document).toEqual(expected.page)
    })

    test("should keep supplied populate intact", async () => {
      const { findOne } = strapi.documents(contentType)
      const documentWithoutCreatedBy = await findOne({ documentId: context.page.documentId })
      const documentWithCreatedBy = await findOne({ documentId: context.page.documentId, populate: ["createdBy"] })

      expect(documentWithoutCreatedBy.createdBy).toBeUndefined()
      expect(documentWithCreatedBy.createdBy).toBeDefined()
    })
  })
})

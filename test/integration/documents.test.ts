import { type StandardGraph, seedStandardGraph } from "@test/factories"
import { setupStrapi, strapi } from "@test/harness"
import get from "lodash/get"
import { beforeAll, describe, expect, test } from "vitest"

describe("documents", () => {
  const contentType = "api::page.page"
  let context: StandardGraph

  beforeAll(async () => {
    await setupStrapi()
    context = await seedStandardGraph()
  })

  describe("findOne", () => {
    test("should return fully populated document when provided with `*`", async () => {
      const document = await strapi
        .documents(contentType)
        .findOne({ documentId: context.page.documentId, populate: "*" })

      const expected: Record<string, object> = {}
      expected.nestedSection = context.nestedSection.doc
      expected.primarySection = {
        ...context.primarySection.doc,
        sections: [expected.nestedSection],
      }
      expected.page = {
        ...context.page.doc,
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

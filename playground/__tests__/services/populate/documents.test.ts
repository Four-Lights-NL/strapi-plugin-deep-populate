import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"
import type { UnwrapPromise } from "../../helpers/unwrapPromise"

describe("documents", () => {
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>>

  beforeAll(async () => {
    await setupStrapi()
    context = await setupDocuments()
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  describe("findOne", () => {
    test("should return fully populated document when provided with `*`", async () => {
      const { page, primarySection, nestedSection } = context

      const { findOne } = strapi.plugin("deep-populate").service("populate").documents("api::page.page")
      const document = await findOne({ documentId: page.output.documentId, populate: "*" })

      const expected = {
        ...page.output,
        sections: [{ ...primarySection.output, sections: [{ ...nestedSection.output }] }],
      }

      // Compare implicitly using the setupDocuments helper
      expect(document).toEqual(
        expect.objectContaining({
          ...expected,
          sections: expect.arrayContaining([
            expect.objectContaining({
              ...primarySection.output,
              sections: expect.arrayContaining([
                expect.objectContaining({
                  ...nestedSection.output,
                }),
              ]),
            }),
          ]),
        }),
      )

      // Explicitly test the deepest nested known attribute
      expect(document.sections[0].sections[0].blocks[0].specialRepeatable[0]).toStrictEqual({
        id: 3,
        isSpecial: false,
        name: "a nested non-special component, in a nested section",
        users: null,
      })
    })

    test("should keep supplied populate intact", async () => {
      const { page } = context

      const { findOne } = strapi.plugin("deep-populate").service("populate").documents("api::page.page")
      const documentWithoutCreatedBy = await findOne({ documentId: page.output.documentId })
      const documentWithCreatedBy = await findOne({ documentId: page.output.documentId, populate: ["createdBy"] })

      expect(documentWithoutCreatedBy.createdBy).toBeUndefined()
      expect(documentWithCreatedBy.createdBy).toBeDefined()
    })

    test("should allow overriding the populate", async () => {
      const { page } = context

      const { findOne } = strapi.plugin("deep-populate").service("populate").documents("api::page.page")
      const documentWithoutSections = await findOne({
        documentId: page.output.documentId,
        populate: { sections: false },
      })
      const documentWithSections = await findOne({ documentId: page.output.documentId })

      expect(documentWithSections.sections.length).toBe(1)
      expect(documentWithoutSections.sections).toBeUndefined()
    })
  })
})

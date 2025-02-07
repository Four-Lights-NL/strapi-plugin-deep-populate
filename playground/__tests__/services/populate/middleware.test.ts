import type { Data, Modules } from "@strapi/strapi"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"

const mockDate = "2025-01-01T12:00:00.000Z"

const getNonPopulated = ({ id, documentId, name }) => ({
  documentId,
  id,
  name,
  content: null,
  locale: null,
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
  locale: null,
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
  })

  afterAll(async () => {
    await teardownStrapi()
    global.Date = OriginalDate
  })

  describe("find", () => {
    const sections: Record<string, Modules.Documents.AnyDocument> = {}
    const expected: Record<string, object> = {}

    beforeAll(async () => {
      // Make sure the relevant objects exist
      sections.third = await strapi.documents(contentType).create({ data: { name: "level-three" } })
      sections.second = await strapi.documents(contentType).create({
        data: { name: "level-two", sections: { connect: [sections.third.documentId] } },
      })
      sections.first = await strapi.documents(contentType).create({
        data: { name: "level-one", sections: { connect: [sections.second.documentId] } },
      })

      // Re-usable expectations for cleaner tests
      // non populated
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
})

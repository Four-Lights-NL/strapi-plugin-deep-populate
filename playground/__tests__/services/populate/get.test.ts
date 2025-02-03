import type { Core, Modules } from "@strapi/strapi"
import { cleanImages, uploadImage } from "../../helpers/files"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"

describe("get", () => {
  let service: Core.Service
  const contentType = "api::section.section" as const

  beforeAll(async () => {
    await setupStrapi()

    service = strapi.plugin("deep-populate").service("populate")
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  describe("relations", () => {
    const sections: Modules.Documents.AnyDocument[] = []

    beforeAll(async () => {
      sections.push(await strapi.documents(contentType).create({ data: { name: "relations-one" } }))
      sections.push(
        await strapi.documents(contentType).create({
          data: { name: "relations-two", sections: { connect: [sections[0].documentId] } },
        }),
      )
      sections.push(
        await strapi.documents(contentType).create({
          data: { name: "relations-three", sections: { connect: [sections[1].documentId] } },
        }),
      )
    })

    test("no relation", async () => {
      const populate = await service.get({ contentType, documentId: sections[0].documentId, omitEmpty: true })
      expect(populate).toStrictEqual({})
    })

    test("relation one level deep", async () => {
      const populate = await service.get({ contentType, documentId: sections[1].documentId, omitEmpty: true })
      expect(populate).toStrictEqual({ sections: true })
    })

    test("relation two levels deep", async () => {
      const populate = await service.get({ contentType, documentId: sections[2].documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        sections: { populate: { sections: true } },
      })
    })

    test("should not traverse circular relations", async () => {
      // create sections
      const sectionA = await strapi.documents(contentType).create({ data: { name: "section-a", sections: [] } })
      const sectionB = await strapi.documents(contentType).create({ data: { name: "section-b", sections: [] } })

      // point sectionA to B and vice versa
      const upa = await strapi
        .documents(contentType)
        // @ts-ignore Generated types are incorrect
        .update({ documentId: sectionA.documentId, data: { sections: { connect: [sectionB.documentId] } } })
      const upb = await strapi
        .documents(contentType)
        // @ts-ignore Generated types are incorrect
        .update({ documentId: sectionB.documentId, data: { sections: { connect: [sectionA.documentId] } } })

      const populate = await service.get({ contentType, documentId: sectionA.documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        sections: { populate: { sections: true } },
      })
    })
  })

  describe("components & dynamiczone", () => {
    const components = {
      single: {
        title: "single",
        isCool: true,
        text: "single component without specialRepeatable",
      },
      singleWithNestedRepeatable: {
        title: "singleWithNestedRepeatable",
        isCool: true,
        text: "single component with nested repeatable component",
        specialRepeatable: [{ isSpecial: false, name: "a nested component" }],
      },
      singleWithNestedSingle: {
        title: "singleWithNestedSingle",
        isCool: true,
        text: "single component with nested single component",
        specialSingle: { isSpecial: true, name: "a non repeatable special component" },
      },
    }

    test("repeatable component", async () => {
      const { documentId } = await strapi.documents(contentType).create({
        data: {
          name: "repeatable-components",
          coolitems: [components.single, components.singleWithNestedRepeatable],
        },
      })

      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        coolitems: {
          populate: {
            specialRepeatable: true,
          },
        },
      })
    })

    test("single component", async () => {
      const { documentId } = await strapi.documents(contentType).create({
        data: {
          name: "single-component",
          singleCoolComponent: components.single,
        },
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        singleCoolComponent: true,
      })
    })

    test("single component with nested single component", async () => {
      const { documentId } = await strapi.documents(contentType).create({
        data: {
          name: "single-component-with-nested-single",
          singleCoolComponent: components.singleWithNestedSingle,
        },
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        singleCoolComponent: {
          populate: { specialSingle: true },
        },
      })
    })

    test("single component with nested repeatable component", async () => {
      const { documentId } = await strapi.documents(contentType).create({
        data: {
          name: "single-component-with-nested-repeatable",
          singleCoolComponent: components.singleWithNestedRepeatable,
        },
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        singleCoolComponent: {
          populate: { specialRepeatable: true },
        },
      })
    })

    test("dynamiczone", async () => {
      const { documentId } = await strapi.documents(contentType).create({
        data: {
          name: "dynamiczone",
          blocks: [
            {
              __component: "cms.cool-component" as const,
              ...components.single,
            },
            {
              __component: "cms.cool-component" as const,
              ...components.singleWithNestedRepeatable,
            },
            {
              __component: "cms.cool-component" as const,
              ...components.singleWithNestedSingle,
            },
            {
              __component: "cms.special" as const,
              name: "special component",
            },
          ],
        },
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        blocks: {
          on: {
            "cms.cool-component": {
              populate: {
                specialSingle: true,
                specialRepeatable: true,
              },
            },
            "cms.special": true,
          },
        },
      })
    })
  })

  describe("media", () => {
    const contentType = "api::page.page"

    afterAll(async () => {
      await cleanImages()
    })

    test("should populate", async () => {
      const image = await uploadImage(strapi)
      const { documentId } = await strapi.documents(contentType).create({
        data: {
          image,
        },
      })

      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        image: true,
      })
    })

    test("should populate in deeply nested components", async () => {
      const image = await uploadImage(strapi)
      const { documentId, ...rest } = await strapi.documents("api::section.section").create({
        data: {
          name: "dynamiczone",
          blocks: [
            {
              __component: "cms.slider" as const,
              items: [
                {
                  image,
                  enabled: true,
                },
              ],
            },
          ],
        },
      })
      const populate = await service.get({ contentType: "api::section.section", documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        blocks: {
          on: {
            "cms.slider": {
              populate: {
                items: { populate: { image: true } },
              },
            },
          },
        },
      })
    })
  })
})

import type { Modules } from "@strapi/strapi"

import { createPage, createSection } from "@test/factories"
import { cleanImages, setupStrapi, strapi, uploadImage } from "@test/harness"
import { afterAll, beforeAll, describe, expect, test } from "vitest"

describe("get", () => {
  let service: { get: (params: Record<string, unknown>) => Promise<Record<string, unknown>> }
  const contentType = "api::section.section" as const

  beforeAll(async () => {
    await setupStrapi()
    service = strapi.plugin("deep-populate").service("populate") as unknown as typeof service
  })

  describe("relations", () => {
    const sections: Record<string, unknown>[] = []

    beforeAll(async () => {
      sections.push((await createSection({ name: "relations-one" })).doc)
      sections.push(
        (await createSection({ name: "relations-two", sections: { connect: [sections[0].documentId] } })).doc,
      )
      sections.push(
        (await createSection({ name: "relations-three", sections: { connect: [sections[1].documentId] } })).doc,
      )
    })

    test("no relation", async () => {
      const populate = await service.get({ contentType, documentId: sections[0].documentId, omitEmpty: true })
      expect(populate).toStrictEqual({
        __deepPopulated: true,
        __deepPopulateConfig: {
          allow: undefined,
          deny: undefined,
          localizations: undefined,
          omitEmpty: true,
        },
        __deepPopulateSchemaConfig: {
          "api::section.section": { options: { selfReferencing: true } },
        },
      })
    })

    test("relation one level deep", async () => {
      const populate = await service.get({ contentType, documentId: sections[1].documentId, omitEmpty: true })
      expect(populate.sections).toBeTruthy()
    })

    test("relation two levels deep", async () => {
      const populate = await service.get({ contentType, documentId: sections[2].documentId, omitEmpty: true })
      expect(populate.sections).toStrictEqual({
        populate: { sections: true },
      })
    })

    test("should not traverse circular relations", async () => {
      const sectionA = await createSection({ name: "section-a", sections: [] })
      const sectionB = await createSection({ name: "section-b", sections: [] })

      await strapi.documents(contentType).update({
        documentId: sectionA.documentId,
        data: { sections: { connect: [sectionB.documentId] } } as Partial<
          Modules.Documents.Params.Data.Input<typeof contentType>
        >,
      })
      await strapi.documents(contentType).update({
        documentId: sectionB.documentId,
        data: { sections: { connect: [sectionA.documentId] } } as Partial<
          Modules.Documents.Params.Data.Input<typeof contentType>
        >,
      })

      const populate = await service.get({ contentType, documentId: sectionA.documentId, omitEmpty: true })
      expect(populate.sections).toStrictEqual({ populate: { sections: true } })
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
      const { documentId } = await createSection({
        name: "repeatable-components",
        coolitems: [components.single, components.singleWithNestedRepeatable],
      })

      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate.coolitems).toStrictEqual({
        populate: {
          specialRepeatable: true,
        },
      })
    })

    test("single component", async () => {
      const { documentId } = await createSection({
        name: "single-component",
        singleCoolComponent: components.single,
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate.singleCoolComponent).toBeTruthy()
    })

    test("single component with nested single component", async () => {
      const { documentId } = await createSection({
        name: "single-component-with-nested-single",
        singleCoolComponent: components.singleWithNestedSingle,
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate.singleCoolComponent).toStrictEqual({
        populate: { specialSingle: true },
      })
    })

    test("single component with nested repeatable component", async () => {
      const { documentId } = await createSection({
        name: "single-component-with-nested-repeatable",
        singleCoolComponent: components.singleWithNestedRepeatable,
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate.singleCoolComponent).toStrictEqual({
        populate: { specialRepeatable: true },
      })
    })

    test("repeatable component with a to-many relation, multiple instances", async () => {
      const linkedSectionOne = await createSection({ name: "linked-section-one" })
      const linkedSectionTwo = await createSection({ name: "linked-section-two" })

      const { documentId } = await createSection({
        name: "repeatable-component-with-to-many-relation",
        singleCoolComponent: {
          title: "single",
          isCool: true,
          text: "single component with a repeatable sub-component holding a to-many relation",
          specialRepeatable: [
            { isSpecial: false, name: "first", linkedSections: { connect: [linkedSectionOne.documentId] } },
            { isSpecial: true, name: "second", linkedSections: { connect: [linkedSectionTwo.documentId] } },
          ],
        },
      })

      // Regression test: when a to-many relation (oneToMany/manyToMany) lives on a component that
      // is itself repeatable, and there are 2+ instances of that component, `_resolveValue` used to
      // produce an array of arrays instead of a flat array, which crashed `_populateRelation`.
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate.singleCoolComponent).toStrictEqual({
        populate: { specialRepeatable: { populate: { linkedSections: true } } },
      })
    })

    test("dynamiczone", async () => {
      const { documentId } = await createSection({
        name: "dynamiczone",
        blocks: [
          { __component: "cms.cool-component" as const, ...components.single },
          { __component: "cms.cool-component" as const, ...components.singleWithNestedRepeatable },
          { __component: "cms.cool-component" as const, ...components.singleWithNestedSingle },
          { __component: "cms.special" as const, name: "special component" },
        ],
      })
      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate.blocks).toStrictEqual({
        on: {
          "cms.cool-component": {
            populate: {
              specialSingle: true,
              specialRepeatable: true,
            },
          },
          "cms.special": true,
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
      const { documentId } = await createPage({ image })

      const populate = await service.get({ contentType, documentId, omitEmpty: true })
      expect(populate.image).toBeTruthy()
    })

    test("should populate in deeply nested components", async () => {
      const image = await uploadImage(strapi)
      const { documentId } = await createSection({
        name: "dynamiczone",
        blocks: [
          {
            __component: "cms.slider" as const,
            items: [{ image, enabled: true }],
          },
        ],
      })
      const populate = await service.get({ contentType: "api::section.section", documentId, omitEmpty: true })
      expect(populate.blocks).toStrictEqual({
        on: {
          "cms.slider": {
            populate: {
              items: { populate: { image: true } },
            },
          },
        },
      })
    })
  })
})

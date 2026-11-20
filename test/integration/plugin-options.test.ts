import { asBlock, connect, createPage, createSection, type Handle, link } from "@test/factories"
import { getGlobal, setSettings, setupStrapi, strapi, withAttributeOptions, withSchemaOptions } from "@test/harness"
import { beforeAll, beforeEach, describe, expect, test } from "vitest"

const populateService = () =>
  strapi.plugin("deep-populate").service("populate") as unknown as {
    get: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  }

const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>

/**
 * The populate node for the page behind the `shared.link` dynamic-zone entry of
 * `pageWithLink`: `page.sections.populate.blocks.on["shared.link"].populate.page`.
 */
const linkPageOf = (populated: Record<string, unknown>): unknown => {
  const sections = asRecord(populated.sections)
  const blocks = asRecord(asRecord(sections.populate).blocks)
  const link = asRecord(asRecord(blocks.on)["shared.link"])
  return asRecord(link.populate).page
}

describe("plugin options", () => {
  const sectionType = "api::section.section"
  const pageType = "api::page.page"

  let emptyPage: Handle
  let pageWithSection: Handle
  let pageWithLink: Handle
  let cachedRootSection: Handle

  beforeAll(async () => {
    await setupStrapi()

    emptyPage = await createPage({ title: "plugin-options-empty" })

    const leaf = await createSection({ name: "plugin-options-leaf" })
    const middle = await createSection({ name: "plugin-options-middle", sections: connect(leaf) })
    const root = await createSection({ name: "plugin-options-root", sections: connect(middle) })
    cachedRootSection = await createSection({ name: "plugin-options-cached-root", sections: connect(middle) })

    pageWithSection = await createPage({ title: "plugin-options-with-section", sections: connect(root) })

    const targetSection = await createSection({ name: "plugin-options-link-target-section" })
    const targetPage = await createPage({
      title: "plugin-options-link-target",
      sections: connect(targetSection),
    })
    const sectionWithLink = await createSection({
      name: "plugin-options-section-with-link",
      blocks: [asBlock("shared.link", link({ label: "link", page: targetPage }))],
    })
    pageWithLink = await createPage({
      title: "plugin-options-with-link",
      sections: connect(sectionWithLink),
    })
  })

  beforeEach(async () => {
    await setSettings({})
  })

  describe("global settings", () => {
    test("default to the built-in values and can be overridden by the store", async () => {
      const defaults = getGlobal()
      expect(defaults).toMatchObject({ useCache: true, replaceWildcard: true })
      expect(defaults.omitEmpty).toBeUndefined()
      expect(defaults.localizations).toBeUndefined()

      await setSettings({ omitEmpty: true, localizations: true, replaceWildcard: false })
      expect(getGlobal()).toMatchObject({
        omitEmpty: true,
        localizations: true,
        replaceWildcard: false,
      })
    })

    test("applies omitEmpty to the root populate", async () => {
      await setSettings({ omitEmpty: true })

      const populated = await populateService().get({
        contentType: pageType,
        documentId: emptyPage.documentId,
        bustCache: true,
      })

      expect(populated).not.toHaveProperty("sections")
      expect(populated).not.toHaveProperty("members")
    })

    test("function parameters take precedence over the store", async () => {
      await setSettings({ omitEmpty: true })

      const populated = await populateService().get({
        contentType: pageType,
        documentId: emptyPage.documentId,
        omitEmpty: false,
        bustCache: true,
      })

      expect(populated.sections).toBe(true)
    })
  })

  describe("schema plugin options", () => {
    test("override global defaults at the root", async () => {
      await setSettings({ omitEmpty: true })

      const populated = await withSchemaOptions(pageType, { selfReferencing: false, omitEmpty: false }, async () =>
        populateService().get({
          contentType: pageType,
          documentId: emptyPage.documentId,
          bustCache: true,
        }),
      )

      expect(populated.sections).toBe(true)
    })

    test("can force omitEmpty at the root", async () => {
      await setSettings({ omitEmpty: false })

      const populated = await withSchemaOptions(pageType, { selfReferencing: false, omitEmpty: true }, async () =>
        populateService().get({
          contentType: pageType,
          documentId: emptyPage.documentId,
          bustCache: true,
        }),
      )

      expect(populated).not.toHaveProperty("sections")
    })

    test("are resolved per level during recursion", async () => {
      const populated = await withSchemaOptions(
        sectionType,
        { selfReferencing: true, allow: { relations: [] } },
        async () =>
          populateService().get({
            contentType: pageType,
            documentId: pageWithSection.documentId,
            bustCache: true,
          }),
      )

      const sectionPopulate = asRecord(asRecord(populated.sections).populate)
      expect(sectionPopulate.sections).toBe(true)
    })

    test("root allow restrictions still apply to the whole traversal", async () => {
      const populated = await withSchemaOptions(
        pageType,
        { selfReferencing: true, allow: { relations: [] } },
        async () =>
          populateService().get({
            contentType: pageType,
            documentId: pageWithSection.documentId,
            bustCache: true,
          }),
      )

      expect(populated.sections).toBe(true)
    })
  })

  describe("attribute plugin options", () => {
    test("apply to the attribute subtree after the target was included", async () => {
      const populated = await withSchemaOptions(pageType, { selfReferencing: true }, async () =>
        populateService().get({
          contentType: pageType,
          documentId: pageWithLink.documentId,
          bustCache: true,
        }),
      )

      const linkPage = linkPageOf(populated)
      // The linked page itself is populated (the target is not denied by its own options)...
      expect(typeof linkPage).toBe("object")
      // ...but its relations are stopped by the attribute's `allow.relations: []`.
      expect(asRecord(asRecord(linkPage).populate).sections).toBe(true)
    })

    test("deny on a subtree does not deny the attribute's own target", async () => {
      const populated = await withSchemaOptions(pageType, { selfReferencing: true }, async () =>
        withAttributeOptions("shared.link", "page", { deny: { relations: [pageType] } }, async () =>
          populateService().get({
            contentType: pageType,
            documentId: pageWithLink.documentId,
            bustCache: true,
          }),
        ),
      )

      const linkPage = linkPageOf(populated)
      expect(typeof linkPage).toBe("object")
      expect(asRecord(asRecord(asRecord(linkPage).populate).sections).populate).toBeDefined()
    })
  })

  describe("selfReferencing", () => {
    test("false stops self-referential relations after one level", async () => {
      const populated = await withSchemaOptions(sectionType, { selfReferencing: false }, async () =>
        populateService().get({
          contentType: pageType,
          documentId: pageWithSection.documentId,
          bustCache: true,
        }),
      )

      const sectionPopulate = asRecord(asRecord(populated.sections).populate)
      expect(sectionPopulate.sections).toBe(true)
    })

    test("true keeps traversing self-referential relations", async () => {
      const populated = await withSchemaOptions(sectionType, { selfReferencing: true }, async () =>
        populateService().get({
          contentType: pageType,
          documentId: pageWithSection.documentId,
          bustCache: true,
        }),
      )

      const sectionPopulate = asRecord(asRecord(populated.sections).populate)
      expect(asRecord(sectionPopulate.sections).populate).toBeDefined()
    })

    test("true allows indirect self references through components", async () => {
      const populated = await withSchemaOptions(pageType, { selfReferencing: true }, async () =>
        withAttributeOptions("shared.link", "page", undefined, async () =>
          populateService().get({
            contentType: pageType,
            documentId: pageWithLink.documentId,
            bustCache: true,
          }),
        ),
      )

      const linkPage = asRecord(
        asRecord(asRecord(asRecord(asRecord(populated.sections).populate).blocks).on)["shared.link"],
      ).populate
      expect(typeof linkPage).toBe("object")
    })

    test("false marks the content type as resolved", async () => {
      const populated = await withSchemaOptions(pageType, { selfReferencing: false }, async () =>
        withAttributeOptions("shared.link", "page", undefined, async () =>
          populateService().get({
            contentType: pageType,
            documentId: pageWithLink.documentId,
            bustCache: true,
          }),
        ),
      )

      const linkPage = linkPageOf(populated)
      expect(linkPage).toBe(true)
    })
  })

  describe("cache", () => {
    test("is invalidated when a nested schema's plugin options change", async () => {
      await setSettings({ useCache: true })

      const before = await populateService().get({
        contentType: sectionType,
        documentId: cachedRootSection.documentId,
      })
      expect(asRecord(before.sections).populate).toBeDefined()

      const after = await withSchemaOptions(sectionType, { selfReferencing: false }, async () =>
        populateService().get({
          contentType: sectionType,
          documentId: cachedRootSection.documentId,
        }),
      )

      expect(after.sections).toBe(true)
    })

    test("is invalidated when an attribute's plugin options change", async () => {
      await setSettings({ useCache: true })

      await withSchemaOptions(pageType, { selfReferencing: true }, async () => {
        const before = await populateService().get({
          contentType: pageType,
          documentId: pageWithLink.documentId,
          bustCache: true,
        })
        const beforeLinkPage = linkPageOf(before)
        expect(asRecord(asRecord(beforeLinkPage).populate).sections).toBe(true)

        const after = await withAttributeOptions("shared.link", "page", undefined, async () =>
          populateService().get({
            contentType: pageType,
            documentId: pageWithLink.documentId,
          }),
        )
        const afterLinkPage = linkPageOf(after)
        expect(asRecord(asRecord(asRecord(afterLinkPage).populate).sections).populate).toBeDefined()
      })
    })
  })
})

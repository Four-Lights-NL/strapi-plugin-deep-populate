import type { Core } from "@strapi/strapi"

import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"

const settingsService = () =>
  strapi.plugin("deep-populate").service("settings") as Core.Service & {
    getSettings: () => Promise<Record<string, unknown>>
    setSettings: (value: Record<string, unknown>) => Promise<unknown>
    getGlobal: () => Record<string, unknown>
  }

const populateService = () => strapi.plugin("deep-populate").service("populate") as Core.Service

const getModel = (uid: string) =>
  strapi.getModel(uid as never) as unknown as {
    pluginOptions?: Record<string, unknown>
  }

const withSchemaOptions = async <T>(
  uid: string,
  options: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
) => {
  const model = getModel(uid)
  const pluginOptions = { ...(model.pluginOptions ?? {}) }
  const hadOptions = Object.hasOwn(pluginOptions, "deep-populate")
  const previous = pluginOptions["deep-populate"]

  model.pluginOptions = pluginOptions
  if (options === undefined) delete model.pluginOptions["deep-populate"]
  else model.pluginOptions["deep-populate"] = options

  try {
    return await fn()
  } finally {
    if (hadOptions) model.pluginOptions["deep-populate"] = previous
    else delete model.pluginOptions["deep-populate"]
  }
}

const withAttributeOptions = async <T>(
  uid: string,
  attribute: string,
  options: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
) => {
  const model = getModel(uid) as unknown as { attributes: Record<string, { pluginOptions?: Record<string, unknown> }> }
  const attr = model.attributes[attribute]
  const pluginOptions = { ...(attr.pluginOptions ?? {}) }
  const hadOptions = Object.hasOwn(pluginOptions, "deep-populate")
  const previous = pluginOptions["deep-populate"]

  attr.pluginOptions = pluginOptions
  if (options === undefined) delete attr.pluginOptions["deep-populate"]
  else attr.pluginOptions["deep-populate"] = options

  try {
    return await fn()
  } finally {
    if (hadOptions) attr.pluginOptions["deep-populate"] = previous
    else delete attr.pluginOptions["deep-populate"]
  }
}

describe("plugin options", () => {
  const sectionType = "api::section.section"
  const pageType = "api::page.page"

  let emptyPage: { documentId: string }
  let pageWithSection: { documentId: string }
  let pageWithLink: { documentId: string }
  let cachedRootSection: { documentId: string }
  let originalSettings: Record<string, unknown>

  beforeAll(async () => {
    await setupStrapi()
    await settingsService().setSettings({})
    originalSettings = await settingsService().getSettings()

    emptyPage = await strapi.documents(pageType).create({ data: { title: "empty", slug: "empty" } })

    const leaf = await strapi.documents(sectionType).create({ data: { name: "leaf" } })
    const middle = await strapi.documents(sectionType).create({
      data: { name: "middle", sections: { connect: [leaf.documentId] } },
    })
    const root = await strapi.documents(sectionType).create({
      data: { name: "root", sections: { connect: [middle.documentId] } },
    })
    cachedRootSection = await strapi.documents(sectionType).create({
      data: { name: "cached root", sections: { connect: [middle.documentId] } },
    })

    pageWithSection = await strapi.documents(pageType).create({
      data: {
        title: "with section",
        slug: "with-section",
        sections: { connect: [root.documentId] },
      },
    })

    const targetSection = await strapi.documents(sectionType).create({ data: { name: "link target section" } })
    const targetPage = await strapi.documents(pageType).create({
      data: {
        title: "link target page",
        slug: "link-target",
        sections: { connect: [targetSection.documentId] },
      },
    })
    const sectionWithLink = await strapi.documents(sectionType).create({
      data: {
        name: "section with link",
        blocks: [{ __component: "shared.link", label: "link", page: targetPage.documentId }] as never,
      },
    })
    pageWithLink = await strapi.documents(pageType).create({
      data: {
        title: "with link",
        slug: "with-link",
        sections: { connect: [sectionWithLink.documentId] },
      },
    })
  })

  afterAll(async () => {
    await settingsService().setSettings(originalSettings)
    await teardownStrapi()
  })

  beforeEach(async () => {
    await settingsService().setSettings({})
  })

  describe("global settings", () => {
    test("default to the built-in values and can be overridden by the store", async () => {
      const defaults = settingsService().getGlobal()
      expect(defaults).toMatchObject({ useCache: true, replaceWildcard: true })
      expect(defaults.omitEmpty).toBeUndefined()
      expect(defaults.localizations).toBeUndefined()

      await settingsService().setSettings({ omitEmpty: true, localizations: true, replaceWildcard: false })
      expect(settingsService().getGlobal()).toMatchObject({
        omitEmpty: true,
        localizations: true,
        replaceWildcard: false,
      })
    })

    test("applies omitEmpty to the root populate", async () => {
      await settingsService().setSettings({ omitEmpty: true })

      const populated = await populateService().get({
        contentType: pageType,
        documentId: emptyPage.documentId,
        bustCache: true,
      })

      expect(populated).not.toHaveProperty("sections")
      expect(populated).not.toHaveProperty("members")
    })

    test("function parameters take precedence over the store", async () => {
      await settingsService().setSettings({ omitEmpty: true })

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
      await settingsService().setSettings({ omitEmpty: true })

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
      await settingsService().setSettings({ omitEmpty: false })

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

      const sectionPopulate = populated.sections.populate
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

      const linkPage = populated.sections.populate.blocks.on["shared.link"].populate.page
      // The linked page itself is populated (the target is not denied by its own options)...
      expect(typeof linkPage).toBe("object")
      // ...but its relations are stopped by the attribute's `allow.relations: []`.
      expect(linkPage.populate.sections).toBe(true)
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

      const linkPage = populated.sections.populate.blocks.on["shared.link"].populate.page
      expect(typeof linkPage).toBe("object")
      expect(linkPage.populate.sections.populate).toBeDefined()
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

      expect(populated.sections.populate.sections).toBe(true)
    })

    test("true keeps traversing self-referential relations", async () => {
      const populated = await withSchemaOptions(sectionType, { selfReferencing: true }, async () =>
        populateService().get({
          contentType: pageType,
          documentId: pageWithSection.documentId,
          bustCache: true,
        }),
      )

      expect(populated.sections.populate.sections.populate).toBeDefined()
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

      const linkPage = populated.sections.populate.blocks.on["shared.link"].populate.page
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

      const linkPage = populated.sections.populate.blocks.on["shared.link"].populate.page
      expect(linkPage).toBe(true)
    })
  })

  describe("cache", () => {
    test("is invalidated when a nested schema's plugin options change", async () => {
      await settingsService().setSettings({ useCache: true })

      const before = await populateService().get({
        contentType: sectionType,
        documentId: cachedRootSection.documentId,
      })
      expect(before.sections.populate).toBeDefined()

      const after = await withSchemaOptions(sectionType, { selfReferencing: false }, async () =>
        populateService().get({
          contentType: sectionType,
          documentId: cachedRootSection.documentId,
        }),
      )

      expect(after.sections).toBe(true)
    })

    test("is invalidated when an attribute's plugin options change", async () => {
      await settingsService().setSettings({ useCache: true })

      await withSchemaOptions(pageType, { selfReferencing: true }, async () => {
        const before = await populateService().get({
          contentType: pageType,
          documentId: pageWithLink.documentId,
          bustCache: true,
        })
        const beforeLinkPage = before.sections.populate.blocks.on["shared.link"].populate.page
        expect(beforeLinkPage.populate.sections).toBe(true)

        const after = await withAttributeOptions("shared.link", "page", undefined, async () =>
          populateService().get({
            contentType: pageType,
            documentId: pageWithLink.documentId,
          }),
        )
        const afterLinkPage = after.sections.populate.blocks.on["shared.link"].populate.page
        expect(afterLinkPage.populate.sections.populate).toBeDefined()
      })
    })
  })
})

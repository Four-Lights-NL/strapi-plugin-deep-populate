import { type StandardGraph, seedStandardGraph } from "@test/factories"
import { setPluginConfig, setupStrapi, strapi } from "@test/harness"
import { beforeAll, describe, expect, it } from "vitest"

describe("cache invalidation", () => {
  const contentType = "api::page.page" as const
  let context: StandardGraph

  beforeAll(async () => {
    await setupStrapi()
    context = await seedStandardGraph()
  })

  const base = { useCache: true, replaceWildcard: true } as const

  it("should invalidate cache when omitEmpty changes from false to true", async () => {
    setPluginConfig({ ...base, omitEmpty: false, localizations: false })

    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc1).toHaveProperty("image", null)
    expect(doc1).toHaveProperty("members", [])
    expect(doc1).toHaveProperty("sections")

    setPluginConfig({ ...base, omitEmpty: true, localizations: false })

    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc2).toHaveProperty("sections")
    expect(doc2).not.toHaveProperty("image")
    expect(doc2).not.toHaveProperty("members")
  })

  it("should invalidate cache when omitEmpty changes from true to false", async () => {
    setPluginConfig({ ...base, omitEmpty: true, localizations: false })

    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc1).toHaveProperty("sections")
    expect(doc1).not.toHaveProperty("image")
    expect(doc1).not.toHaveProperty("members")

    setPluginConfig({ ...base, omitEmpty: false, localizations: false })

    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc2).toHaveProperty("image", null)
    expect(doc2).toHaveProperty("members", [])
    expect(doc2).toHaveProperty("sections")
  })

  it("should invalidate cache when allow relations changes", async () => {
    setPluginConfig({
      ...base,
      omitEmpty: true,
      localizations: false,
      contentTypes: { [contentType]: { allow: { relations: ["api::section.section"] } } },
    })

    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc1).toHaveProperty("sections")
    for (const section of doc1.sections) {
      expect(section).toHaveProperty("sections")
    }
    expect(doc1).not.toHaveProperty("image")
    expect(doc1).not.toHaveProperty("members")

    setPluginConfig({
      ...base,
      omitEmpty: true,
      localizations: false,
      contentTypes: {
        [contentType]: { allow: {}, deny: { relations: ["api::section.section"] } },
      },
    })

    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc2).toHaveProperty("sections")
    for (const section of doc2.sections) {
      expect(section).not.toHaveProperty("sections")
    }
    expect(doc2).not.toHaveProperty("image")
    expect(doc2).not.toHaveProperty("members")
  })

  it("should invalidate cache when deny relations changes", async () => {
    setPluginConfig({
      ...base,
      omitEmpty: false,
      localizations: false,
      contentTypes: { [contentType]: { deny: { relations: [] } } },
    })

    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc1).toHaveProperty("sections")

    for (const section of doc1.sections) {
      expect(section).toHaveProperty("sections")
    }

    expect(doc1).toHaveProperty("image", null)
    expect(doc1).toHaveProperty("members", [])

    setPluginConfig({
      ...base,
      omitEmpty: false,
      localizations: false,
      contentTypes: { [contentType]: { deny: { relations: ["api::section.section"] } } },
    })

    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc2).toHaveProperty("sections")

    for (const section of doc2.sections) {
      expect(section).not.toHaveProperty("sections")
    }
    expect(doc2).toHaveProperty("image", null)
    expect(doc2).toHaveProperty("members", [])
  })

  it("should invalidate cache when localizations changes from false to true", async () => {
    setPluginConfig({ ...base, localizations: false, omitEmpty: false })

    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc1).not.toHaveProperty("localizations")
    expect(doc1).toHaveProperty("image", null)

    setPluginConfig({ ...base, localizations: true, omitEmpty: false })

    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc2).toHaveProperty("localizations")
    expect(doc2).toHaveProperty("image", null)
  })

  it("should invalidate cache when localizations changes from true to false", async () => {
    setPluginConfig({ ...base, localizations: true, omitEmpty: false })

    const doc1 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc1).toHaveProperty("localizations")
    expect(doc1).toHaveProperty("image", null)

    setPluginConfig({ ...base, localizations: false, omitEmpty: false })

    const doc2 = await strapi.documents(contentType).findOne({
      documentId: context.page.documentId,
      populate: "*",
    })

    expect(doc2).not.toHaveProperty("localizations")
    expect(doc2).toHaveProperty("image", null)
  })
})

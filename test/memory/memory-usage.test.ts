import { type StandardGraph, seedStandardGraph } from "@test/factories"
import { setPluginConfig, setupStrapi, strapi, trackFunction } from "@test/harness"
import { beforeAll, describe, expect, it } from "vitest"

describe.sequential("Memory Usage Tests", () => {
  let context: StandardGraph

  beforeAll(async () => {
    await setupStrapi()

    // Create a very nested lookup
    let previousPageId: string | undefined
    for (let idx = 0; idx < 5; idx += 1) {
      const layerContext = await seedStandardGraph(previousPageId)
      previousPageId = layerContext.page.documentId
    }
    context = await seedStandardGraph(previousPageId)
  })

  it("should not use more than 15MiB memory when using cache", async () => {
    setPluginConfig({ useCache: true })

    const results = await trackFunction(
      async () =>
        await strapi.documents("api::page.page").findOne({ documentId: context.page.documentId, populate: "*" }),
      { iterations: 100, forceGC: true },
    )

    expect(results.stats.maxHeapUsed).toBeLessThan(40 * 1024 * 1024 /* 40 MiB */)
    expect(results.stats.avgHeapUsed).toBeLessThan(15 * 1024 * 1024 /* 15 MiB */)
  })

  it("should not use more than 80MiB memory without using cache", async () => {
    setPluginConfig({ useCache: false })

    // remove existing cache
    {
      const cacheContentType = "plugin::deep-populate.cache"
      const caches = await strapi
        .documents(cacheContentType)
        .findMany({ filters: { hash: { $notNull: true } }, fields: ["documentId"] })

      for (const { documentId } of caches) {
        await strapi.documents(cacheContentType).delete({ documentId })
      }
    }

    const results = await trackFunction(
      async () =>
        await strapi.documents("api::page.page").findOne({ documentId: context.page.documentId, populate: "*" }),
      { iterations: 100, forceGC: true },
    )

    expect(results.stats.maxHeapUsed).toBeLessThan(80 * 1024 * 1024 /* 80 MiB */)
    expect(results.stats.avgHeapUsed).toBeLessThan(80 * 1024 * 1024 /* 80 MiB */)
  })
})

import { afterAll, beforeAll, describe, it } from "vitest"

import type { UnwrapPromise } from "./helpers/unwrapPromise"

import * as MemoryTracker from "./helpers/memoryTracker"
import { setupDocuments } from "./helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "./helpers/strapi"

describe.sequential("Memory Usage Tests", () => {
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>>
  let originalConfigGet: typeof strapi.config.get
  let configSpy: ReturnType<typeof vitest.spyOn>
  let useCache = true

  beforeAll(async () => {
    await setupStrapi()

    originalConfigGet = strapi.config.get
    configSpy = vitest.spyOn(strapi.config, "get")
    configSpy.mockImplementation((key) => {
      const config = originalConfigGet.call(strapi.config, key)
      if (key === "plugin::deep-populate") {
        config.useCache = useCache
        return config as object
      }
      return config
    })

    // Create a very nested lookup
    let previousPageId: string
    for (let idx = 0; idx < 5; idx += 1) {
      const layerContext = await setupDocuments(previousPageId)
      previousPageId = layerContext.page.documentId
    }
    console.log("Done setting up layers")
    context = await setupDocuments(previousPageId)
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  it("should not use more than 15MiB memory when using cache", async () => {
    const results = await MemoryTracker.trackFunction(
      async () =>
        await strapi.documents("api::page.page").findOne({ documentId: context.page.documentId, populate: "*" }),
      { iterations: 100, forceGC: true },
    )

    // To see the actual memory stats, use:
    console.log("Cache-full memory stats", results.stats)

    expect(results.stats.maxHeapUsed).toBeLessThan(40 * 1024 * 1024 /* 40 MiB */)
    expect(results.stats.avgHeapUsed).toBeLessThan(15 * 1024 * 1024 /* 15 MiB */)
  })

  it("should not use more than 40MiB memory without using cache", async () => {
    useCache = false // disable cache

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

    const results = await MemoryTracker.trackFunction(
      async () =>
        await strapi.documents("api::page.page").findOne({ documentId: context.page.documentId, populate: "*" }),
      { iterations: 100, forceGC: true },
    )

    // To see the actual memory stats, use:
    console.log("Cache-less memory stats", results.stats)

    expect(results.stats.maxHeapUsed).toBeLessThan(40 * 1024 * 1024 /* 40 MiB */)
    expect(results.stats.avgHeapUsed).toBeLessThan(40 * 1024 * 1024 /* 40 MiB */)
  })
})

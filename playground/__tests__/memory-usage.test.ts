import { afterAll, beforeAll, describe, it } from "vitest"
import { setupDocuments } from "./helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "./helpers/strapi"
import type { UnwrapPromise } from "./helpers/unwrapPromise"

type MemoryUsage = {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
}

const getMemoryUsage = (): MemoryUsage => {
  const usage = process.memoryUsage()
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
  }
}

const forceGC = (): void => {
  if (global.gc) {
    global.gc()
  }
}

const logMemoryDelta = (label: string, before: MemoryUsage, after: MemoryUsage): void => {
  const delta = {
    heapUsed: after.heapUsed - before.heapUsed,
    heapTotal: after.heapTotal - before.heapTotal,
    external: after.external - before.external,
    rss: after.rss - before.rss,
  }
  console.log(`${label} Memory Delta:`, delta)
  console.log(`${label} Before:`, before)
  console.log(`${label} After:`, after)
}

describe("Memory Usage Tests", () => {
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>>

  beforeAll(async () => {
    await setupStrapi()
    context = await setupDocuments()
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  // Test cases will be implemented here
  it("Deep Section Nesting", async () => {
    // Measure memory before deep-populate
    const memoryBefore = getMemoryUsage()

    // Perform deep-populate
    const _document = await strapi
      .documents("api::page.page")
      .findOne({ documentId: context.page.documentId, populate: "*" })

    // Measure memory after deep-populate
    const memoryAfter = getMemoryUsage()
    logMemoryDelta("After Deep-Populate", memoryBefore, memoryAfter)
    console.log(`Memory usage: ${(memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 ** 2} MiB`)
    expect(memoryAfter.heapUsed - memoryBefore.heapUsed).toBeLessThan(15 * 1024 * 1024)

    // Force garbage collection if available
    forceGC()

    // Measure memory after GC
    const memoryAfterGC = getMemoryUsage()
    logMemoryDelta("After GC", memoryAfter, memoryAfterGC)
    console.log(`GC freed: ${(memoryAfterGC.heapUsed - memoryAfter.heapUsed) / 1024 ** 2} MiB`)
    expect(memoryAfterGC.heapUsed - memoryAfter.heapUsed).toBeGreaterThan(0)
  })
})

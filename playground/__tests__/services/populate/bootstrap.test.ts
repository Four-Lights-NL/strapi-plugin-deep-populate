import plugin from "@fourlights/strapi-plugin-deep-populate/strapi-server"

import type { UnwrapPromise } from "../../helpers/unwrapPromise"

import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"

describe("bootstrap", () => {
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>>
  const contentType = "api::page.page"

  let originalConfigGet: typeof strapi.config.get
  let configSpy: ReturnType<typeof vitest.spyOn>
  let clearCacheOnStartup: boolean | undefined

  beforeAll(async () => {
    await setupStrapi()

    originalConfigGet = strapi.config.get
    configSpy = vitest.spyOn(strapi.config, "get")
    configSpy.mockImplementation((key) => {
      const config = { ...originalConfigGet.call(strapi.config, key), useCache: true }
      if (key === "plugin::deep-populate") {
        return {
          ...(config as object),
          cacheOptions: clearCacheOnStartup !== undefined ? { clearCacheOnStartup } : undefined,
        }
      }
      return config
    })

    context = (await setupDocuments()) as unknown as typeof context
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  beforeEach(async () => {
    configSpy.mockClear()
    clearCacheOnStartup = undefined

    // Clear all cache entries before each test
    const cachedEntries = await strapi.documents("plugin::deep-populate.cache").findMany({})
    for (const entry of cachedEntries) {
      await strapi.documents("plugin::deep-populate.cache").delete({ documentId: entry.documentId })
    }
  })

  describe("clearCacheOnStartup", () => {
    it("should clear all cache entries when clearCacheOnStartup is true", async () => {
      // Populate cache by making requests
      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      await strapi.documents("api::section.section").findOne({
        documentId: context.primarySection.documentId,
        populate: "*",
      })

      // Verify cache is populated
      const initialCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(initialCount).toBeGreaterThan(0)

      // Set config to enable clearCacheOnStartup
      clearCacheOnStartup = true

      // Call bootstrap
      await plugin.bootstrap({ strapi })

      // Verify cache is cleared
      const finalCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(finalCount).toBe(0)
    })

    it("should not clear cache entries when clearCacheOnStartup is false", async () => {
      // Populate cache
      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      // Verify cache is populated
      const initialCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(initialCount).toBeGreaterThan(0)

      // Set config to disable clearCacheOnStartup
      clearCacheOnStartup = false

      // Call bootstrap
      await plugin.bootstrap({ strapi })

      // Verify cache is not cleared
      const finalCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(finalCount).toBe(initialCount)
    })

    it("should not clear cache entries when clearCacheOnStartup is undefined", async () => {
      // Populate cache
      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      // Verify cache is populated
      const initialCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(initialCount).toBeGreaterThan(0)

      // clearCacheOnStartup is undefined by default

      // Call bootstrap
      await plugin.bootstrap({ strapi })

      // Verify cache is not cleared
      const finalCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(finalCount).toBe(initialCount)
    })

    it("should handle errors gracefully during cache deletion", async () => {
      // Populate cache
      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      // Set config to enable clearCacheOnStartup
      clearCacheOnStartup = true

      // Mock deleteMany to throw an error
      const deleteSpy = vitest.spyOn(strapi.db.query("plugin::deep-populate.cache"), "deleteMany")
      deleteSpy.mockRejectedValue(new Error("Database error"))

      // Spy on logger
      const logErrorSpy = vitest.spyOn(strapi.log, "error")

      // Call bootstrap - should not throw
      await expect(plugin.bootstrap({ strapi })).resolves.not.toThrow()

      // Verify error was logged
      expect(logErrorSpy).toHaveBeenCalledWith("❌ Error during startup cache deletion:", expect.any(Error))

      // Restore mocks
      deleteSpy.mockRestore()
      logErrorSpy.mockRestore()
    })
  })
})

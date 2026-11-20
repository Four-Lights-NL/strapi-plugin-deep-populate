import { type StandardGraph, seedStandardGraph } from "@test/factories"
import { clearCache, loadPlugin, setPluginConfig, setupStrapi, strapi } from "@test/harness"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

describe("bootstrap", () => {
  const contentType = "api::page.page"
  let context: StandardGraph

  beforeAll(async () => {
    await setupStrapi()
    context = await seedStandardGraph()
  })

  beforeEach(async () => {
    await clearCache()
  })

  describe("clearCacheOnStartup", () => {
    it("should clear all cache entries when clearCacheOnStartup is true", async () => {
      setPluginConfig({ useCache: true, cacheOptions: { clearCacheOnStartup: true } })

      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      await strapi.documents("api::section.section").findOne({
        documentId: context.primarySection.documentId,
        populate: "*",
      })

      const initialCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(initialCount).toBeGreaterThan(0)

      await loadPlugin().bootstrap?.({ strapi })

      const finalCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(finalCount).toBe(0)
    })

    it("should not clear cache entries when clearCacheOnStartup is false", async () => {
      setPluginConfig({ useCache: true, cacheOptions: { clearCacheOnStartup: false } })

      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      const initialCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(initialCount).toBeGreaterThan(0)

      await loadPlugin().bootstrap?.({ strapi })

      const finalCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(finalCount).toBe(initialCount)
    })

    it("should not clear cache entries when clearCacheOnStartup is undefined", async () => {
      setPluginConfig({ useCache: true })

      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      const initialCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(initialCount).toBeGreaterThan(0)

      await loadPlugin().bootstrap?.({ strapi })

      const finalCount = await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })
      expect(finalCount).toBe(initialCount)
    })

    it("should handle errors gracefully during cache deletion", async () => {
      setPluginConfig({ useCache: true, cacheOptions: { clearCacheOnStartup: true } })

      await strapi.documents(contentType).findOne({
        documentId: context.page.documentId,
        populate: "*",
      })

      const deleteSpy = vi.spyOn(strapi.db.query("plugin::deep-populate.cache"), "deleteMany")
      deleteSpy.mockRejectedValue(new Error("Database error"))

      const logErrorSpy = vi.spyOn(strapi.log, "error")

      await expect(loadPlugin().bootstrap?.({ strapi }) as Promise<unknown>).resolves.not.toThrow()

      expect(logErrorSpy).toHaveBeenCalledWith("❌ Error during startup cache deletion:", expect.any(Error))

      deleteSpy.mockRestore()
      logErrorSpy.mockRestore()
    })
  })
})

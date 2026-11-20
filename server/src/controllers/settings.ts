import type { Core } from "@strapi/strapi"

import { syncCacheIndex } from "../utils/cacheIndex"
import { validateSettings } from "../validation/settings"

const toTarget = (schema: { uid: string; info?: { displayName?: string } }) => ({
  uid: schema.uid,
  displayName: schema.info?.displayName ?? schema.uid,
})

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getSettings(ctx) {
    const settings = await strapi.plugin("deep-populate").service("settings").load()
    ctx.body = { data: settings }
  },

  async updateSettings(ctx) {
    const data = await validateSettings(ctx.request.body)
    const service = strapi.plugin("deep-populate").service("settings")
    const previous = await service.load()
    const stored = await service.getSettings()
    const merged = {
      ...stored,
      ...data,
      ...(data.cacheOptions ? { cacheOptions: { ...(stored.cacheOptions ?? {}), ...data.cacheOptions } } : {}),
    }
    const settings = await service.setSettings(merged)

    if (previous.useCache !== settings.useCache) {
      // Entries accumulate while caching is disabled and are not cleared by document writes.
      // Flush them when caching is turned back on so stale populate objects are not served.
      if (!previous.useCache && settings.useCache) {
        await strapi.plugin("deep-populate").service("cache").clearAll()
      }
      await syncCacheIndex(strapi)
    }

    ctx.body = { data: settings }
  },

  async getTargets(ctx) {
    const contentTypes = Object.values(strapi.contentTypes)
      .filter(
        (schema) =>
          (schema.uid.startsWith("api::") || schema.uid.startsWith("plugin::")) &&
          schema.uid !== "plugin::deep-populate.cache",
      )
      .map(toTarget)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    const components = Object.values(strapi.components)
      .map(toTarget)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    ctx.body = { contentTypes, components }
  },
})

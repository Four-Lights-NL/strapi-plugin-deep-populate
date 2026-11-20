import type { Core } from "@strapi/strapi"

import type { Config, GlobalConfig, GlobalSettings } from "../config"

import { isPlainObject, parseGlobalSettings, resolveGlobalConfig } from "../config"
import log from "../utils/log"

export const settingsStoreKey = "settings"

const getStaticConfig = (strapi: Core.Strapi): Partial<Config> => {
  try {
    const config = strapi.config.get("plugin::deep-populate")
    return isPlainObject(config) ? (config as Partial<Config>) : {}
  } catch {
    return {}
  }
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const store = () =>
    strapi.store({
      type: "plugin",
      name: "deep-populate",
      key: settingsStoreKey,
    })

  // The store can only be read asynchronously, while `getGlobal` is used in a hot, synchronous
  // path. Keep the last known store value in memory and refresh it on bootstrap and on save.
  let storeSnapshot: GlobalSettings = {}
  let hasLoaded = false
  let loadPromise: Promise<void> | null = null

  const readStore = async (): Promise<GlobalSettings | null> => {
    try {
      const value = await store().get({})
      return parseGlobalSettings(value)
    } catch (error) {
      log.warn("Could not read the deep-populate settings store, falling back to config/plugins.js", String(error))
      return null
    }
  }

  const settingsService = {
    async load() {
      if (hasLoaded) return settingsService.getGlobal()
      if (!loadPromise) {
        loadPromise = readStore().then((value) => {
          if (value !== null) {
            storeSnapshot = value
            hasLoaded = true
          }
          loadPromise = null
        })
      }

      await loadPromise
      return settingsService.getGlobal()
    },

    /**
     * Synchronous view of the global configuration: `store > config/plugins.js > defaults`.
     */
    getGlobal(): GlobalConfig {
      return resolveGlobalConfig(storeSnapshot, getStaticConfig(strapi))
    },

    async getSettings(): Promise<GlobalSettings> {
      return { ...storeSnapshot }
    },

    async setSettings(value: GlobalSettings): Promise<GlobalConfig> {
      const sanitized = parseGlobalSettings(value)
      await store().set({ value: sanitized })
      storeSnapshot = sanitized
      hasLoaded = true
      return settingsService.getGlobal()
    },

    /** Test helper: forget the in-memory snapshot so the next `load` reads the store again. */
    reset() {
      storeSnapshot = {}
      hasLoaded = false
      loadPromise = null
    },
  }

  return settingsService
}

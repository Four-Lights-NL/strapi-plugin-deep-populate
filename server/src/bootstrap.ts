import type { Core } from "@strapi/strapi"

import log from "./utils/log"

const permissions = [
  {
    section: "settings",
    category: "Deep Populate",
    subCategory: "Configuration",
    pluginName: "deep-populate",
    displayName: "Access the Deep Populate settings",
    uid: "settings.access",
  },
]

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  const settings = await strapi.plugin("deep-populate").service("settings").load()
  const { cacheOptions } = settings

  if (cacheOptions?.clearCacheOnStartup === true) {
    try {
      await strapi.db.query("plugin::deep-populate.cache").deleteMany({
        where: {
          id: { $gt: 0 },
        },
      })
    } catch (error) {
      strapi.log.error("❌ Error during startup cache deletion:", error)
    }
  }

  try {
    await strapi.service("admin::permission").actionProvider.registerMany(permissions)
  } catch (error) {
    // The admin plugin is not always available (e.g. headless setups). The settings API is then
    // simply unreachable, which is fine.
    log.debug("Could not register the deep-populate settings permission", String(error))
  }
}

export default bootstrap

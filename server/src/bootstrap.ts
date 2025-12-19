import type { Core } from "@strapi/strapi"

import type { Config } from "./config"

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  const { cacheOptions } = strapi.config.get("plugin::deep-populate") as Config

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
}

export default bootstrap

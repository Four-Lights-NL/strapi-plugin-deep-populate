import { defineConfig, mergeConfig, type UserConfig } from "vite"

export default defineConfig((config) => {
  return mergeConfig(config, {
    resolve: {
      alias: {
        "@": "/src",
      },
      dedupe: ["@strapi/admin", "@strapi/design-system", "@strapi/icons"],
    } as UserConfig,
  })
})

import { defineConfig, mergeConfig, type UserConfig } from "vite"

export default defineConfig((config) => {
  return mergeConfig(config, {
    resolve: {
      alias: {
        "@": "/src",
      },
    } as UserConfig,
  })
})

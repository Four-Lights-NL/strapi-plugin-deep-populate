import { type UserConfig, defineConfig, mergeConfig } from "vite"

export default defineConfig((config) => {
  return mergeConfig(config, {
    resolve: {
      alias: {
        "@": "/src",
      },
    } as UserConfig,
  })
})

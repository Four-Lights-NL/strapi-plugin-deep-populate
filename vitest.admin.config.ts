import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["admin/src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.admin.setup.ts"],
    server: {
      deps: {
        inline: true,
        interopDefault: true,
      },
    },
  },
})

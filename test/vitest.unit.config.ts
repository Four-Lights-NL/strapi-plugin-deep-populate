import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@test": path.resolve("test"),
    },
  },
  test: {
    name: "unit",
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 30000,
  },
})

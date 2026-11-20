import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@test": path.resolve("test"),
    },
  },
  test: {
    name: "memory",
    include: ["test/memory/**/*.test.ts"],
    environment: "node",
    globals: true,
    pool: "forks",
    fileParallelism: false,
    isolate: false,
    restoreMocks: true,
    execArgv: ["--expose-gc"],
    testTimeout: 300000,
    hookTimeout: 300000,
    globalSetup: ["test/harness/global-setup.ts"],
    setupFiles: ["test/harness/setup.ts"],
    server: {
      deps: {
        inline: true,
      },
    },
  },
})

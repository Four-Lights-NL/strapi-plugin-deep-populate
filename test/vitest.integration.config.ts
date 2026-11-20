import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@test": path.resolve("test"),
    },
  },
  test: {
    name: "integration",
    include: ["test/integration/**/*.test.ts"],
    environment: "node",
    globals: true,
    // One shared Strapi instance ⇒ one worker, no isolation between files.
    pool: "forks",
    fileParallelism: false,
    isolate: false,
    restoreMocks: true,
    execArgv: ["--expose-gc"],
    testTimeout: 120000,
    hookTimeout: 120000,
    globalSetup: ["test/harness/global-setup.ts"],
    setupFiles: ["test/harness/setup.ts"],
    // The booted app prints a lot of noise; keep warnings out of the report.
    onConsoleLog(log, type) {
      return !(type === "stdout" && log.includes("warning"))
    },
    server: {
      deps: {
        inline: true,
      },
    },
  },
})

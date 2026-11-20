import path from "node:path"

import { defineConfig } from "vitest/config"

// Unit + integration in a single run so coverage spans the pure helpers and the
// booted plugin together. Memory is excluded (machine-sensitive thresholds).
export default defineConfig({
  resolve: {
    alias: {
      "@test": path.resolve("test"),
    },
  },
  test: {
    name: "coverage",
    include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts"],
    environment: "node",
    globals: true,
    pool: "forks",
    fileParallelism: false,
    isolate: false,
    restoreMocks: true,
    execArgv: ["--expose-gc"],
    testTimeout: 120000,
    hookTimeout: 120000,
    globalSetup: ["test/harness/global-setup.ts"],
    setupFiles: ["test/harness/setup.ts"],
    server: {
      deps: {
        inline: true,
      },
    },
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["server/src/**/*.ts"],
      exclude: ["server/src/**/*.d.ts"],
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      // Re-baselined after the stacked PR (#158) grew `server/src` (~600-700 new
      // lines for the settings store, admin routes/controller and schema plugin
      // options). Measured at statements 24.66 / branches 30.82 / functions 28.69 /
      // lines 24.28 on the merged tree, with the new unit tests for the pure config
      // helpers carrying most of the attributable surface. Thresholds sit ~1.6
      // points below to guard against regressions without being noisy.
      thresholds: {
        lines: 23,
        statements: 23,
        functions: 27,
        branches: 29,
      },
    },
  },
})

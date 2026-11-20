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
      // Measured baseline (unit layer + whatever the v8 provider can attribute
      // from the booted app). The bulk of the plugin runs through the app's
      // native module loader, outside the Vite module graph, so the integration
      // suites contribute little to the numbers. Thresholds are set just below
      // the measured values to guard against regressions without being noisy.
      thresholds: {
        lines: 18,
        statements: 18,
        functions: 23,
        branches: 24,
      },
    },
  },
})

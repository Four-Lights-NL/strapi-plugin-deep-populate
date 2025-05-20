import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["playground/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    environment: "node",
    globals: true,
    testTimeout: 20000,
    isolate: false,
    poolOptions: {
      forks: {
        singleFork: true,
      },
      vmForks: {
        singleFork: false,
      },
      threads: {
        singleThread: true,
      },
      vmThreads: {
        singleThread: true,
      },
    },
    // Cleanup nasty node warnings
    onConsoleLog(log, type) {
      return !(type === "stdout" && log.includes("warning"))
    },
    deps: {
      interopDefault: true,
    },
    server: {
      deps: {
        inline: true,
      },
    },
    globalSetup: ["./vitest.setup.ts"],
  },
})

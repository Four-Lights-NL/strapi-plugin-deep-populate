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
        minForks: 1,
        maxForks: 1
      },
      threads: {
        singleThread: true,
        minThreads: 1,
        maxThreads: 1,
        useAtomics: true
      },
      vmThreads: {
        singleThread: true,
        minThreads: 1,
        maxThreads: 1,
        useAtomics: true
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

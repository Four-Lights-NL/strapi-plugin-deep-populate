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
        execArgv: ["--expose-gc"],
      },
      vmForks: {
        singleFork: false,
        execArgv: ["--expose-gc"],
      },
      threads: {
        singleThread: true,
        execArgv: ["--expose-gc"],
      },
      vmThreads: {
        singleThread: true,
        execArgv: ["--expose-gc"],
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

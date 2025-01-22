import { type JestConfigWithTsJest, createDefaultPreset } from "ts-jest"

const presetConfig = createDefaultPreset({
  tsconfig: "./server/tsconfig.json",
})

const jestConfig: JestConfigWithTsJest = {
  ...presetConfig,
  testMatch: ["<rootDir>/playground/__tests__/**/*.(spec|test).(ts|tsx|js|jsx)"],
  testTimeout: 20000,
  modulePathIgnorePatterns: [".yalc"],
  collectCoverage: true,
  coverageDirectory: "./coverage",
}

export default jestConfig

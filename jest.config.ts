import { type JestConfigWithTsJest, createDefaultPreset } from "ts-jest"

const presetConfig = createDefaultPreset({
  tsconfig: "./server/tsconfig.json",
})

const jestConfig: JestConfigWithTsJest = {
  ...presetConfig,
  testMatch: ["**/*.(spec|test).(ts|tsx|jsx|js)"],
  testPathIgnorePatterns: ["<rootDir>/__tests__/integration/"],
  collectCoverage: true,
  coverageDirectory: "./coverage",
}

export default jestConfig

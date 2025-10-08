#!/usr/bin/env node
import fs from "node:fs"

const version = process.argv[2]
const baseVersion = version.split("-")[0].replace("v", "") // Remove prerelease suffix

const changelog = fs.readFileSync("CHANGELOG.md", "utf8")
const lines = changelog.split("\n")

let capturing = false
const result = []

for (const line of lines) {
  if (line.startsWith(`## [${baseVersion}]`)) {
    capturing = true
  } else if (line.startsWith("## [") && capturing) {
    break // Stop at next version
  } else if (capturing) {
    result.push(line)
  }
}

console.log(result.join("\n").trim())

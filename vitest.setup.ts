import { execSync } from "node:child_process"

export default function setup() {
  process.env.NODE_NO_WARNINGS = "1"
  console.log("🔨 Building plugin")
  try {
    execSync("npm run build", {
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    })
  } catch (error) {
    console.error("Build failed:", error)
  }
}

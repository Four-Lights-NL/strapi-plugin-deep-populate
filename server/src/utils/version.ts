import { version } from "../../../package.json"

export const majorMinorVersion = version.split(".").slice(0, -1).join(".")

import { afterEach, describe, expect, it } from "vitest"

import { name as pkgName } from "../../package.json"
import log, { debug, error, info, warn } from "../../server/src/utils/log"

const calls: Record<string, string[]> = { error: [], warn: [], info: [], debug: [] }

const globalScope = globalThis as unknown as { strapi?: unknown }
const previousStrapi = globalScope.strapi

const installStrapiLog = () => {
  for (const key of Object.keys(calls)) calls[key] = []
  globalScope.strapi = {
    log: {
      error: (message: string) => calls.error.push(message),
      warn: (message: string) => calls.warn.push(message),
      info: (message: string) => calls.info.push(message),
      debug: (message: string) => calls.debug.push(message),
    },
  }
}

describe("log", () => {
  afterEach(() => {
    if (previousStrapi === undefined) delete globalScope.strapi
    else globalScope.strapi = previousStrapi
  })

  it("prefixes every message with the plugin package name", () => {
    installStrapiLog()
    error("something went wrong")
    expect(calls.error).toEqual([`[${pkgName}] something went wrong`])
  })

  it("renders the context on a prefixed new line", () => {
    installStrapiLog()
    warn("careful", "extra detail")
    expect(calls.warn).toEqual([`[${pkgName}] careful\n[${pkgName}] extra detail`])
  })

  it("stringifies non-string context via template interpolation", () => {
    installStrapiLog()
    warn("careful", { detail: true })
    expect(calls.warn).toEqual([`[${pkgName}] careful\n[${pkgName}] [object Object]`])
  })

  it("routes each level to the matching strapi.log method", () => {
    installStrapiLog()
    error("e")
    warn("w")
    info("i")
    debug("d")

    expect(calls.error).toEqual([`[${pkgName}] e`])
    expect(calls.warn).toEqual([`[${pkgName}] w`])
    expect(calls.info).toEqual([`[${pkgName}] i`])
    expect(calls.debug).toEqual([`[${pkgName}] d`])
  })

  it("exposes the same functions on the default export", () => {
    expect(log).toEqual({ error, warn, info, debug })
  })
})

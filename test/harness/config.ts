import { merge } from "lodash"
import { vi } from "vitest"

import type { Config } from "../../server/src/config"

import { strapi } from "./strapi"

type ConfigKey = string | readonly string[]

/**
 * The per-test override that the single `strapi.config.get` spy merges over the
 * real plugin config. `undefined` means "no override: return the real value".
 *
 * It is intentionally module-level state: with `isolate: false` every suite in
 * the single integration worker shares this module, so a suite can flip the
 * config between requests inside one test (e.g. toggling `omitEmpty`) by calling
 * {@link setPluginConfig} again.
 */
let activeOverride: Partial<Config> | undefined

/** Set (or replace) the plugin config override for the current test. */
export const setPluginConfig = (override: Partial<Config>): void => {
  activeOverride = override
}

/**
 * Drop the override so the next `strapi.config.get("plugin::deep-populate")`
 * returns the real config again. Registered globally in `beforeEach` by
 * `harness/setup.ts`; suites must never call `mockRestore` on the config spy.
 */
export const resetPluginConfig = (): void => {
  activeOverride = undefined
}

/**
 * Ensure the one and only `strapi.config.get` spy is installed. Called after
 * boot and again before every test, because the integration config enables
 * `restoreMocks`, which would otherwise tear this spy down between tests.
 *
 * The spy keeps the live binding to the original `get` (so identity/spying stay
 * correct) and forwards `defaultValue` unchanged, preserving Strapi's "throw
 * when missing and no default" behaviour for other keys. For
 * `plugin::deep-populate` it deep-merges {@link activeOverride} over the real
 * config, so partial overrides behave like the real config merged with intent.
 */
export const ensureConfigSpy = (): void => {
  if (vi.isMockFunction(strapi.config.get)) return

  const realGet = strapi.config.get.bind(strapi.config)
  vi.spyOn(strapi.config, "get").mockImplementation((key: ConfigKey, defaultValue?: unknown) => {
    const value = realGet(key as string, defaultValue)
    if (key === "plugin::deep-populate" && activeOverride) {
      return merge({}, value, activeOverride)
    }
    return value
  })
}

/** Alias kept for readability at the boot site. */
export const installConfigSpy = ensureConfigSpy

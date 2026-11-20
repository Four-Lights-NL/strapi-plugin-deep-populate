import type { Core } from "@strapi/strapi"

import { strapi } from "./strapi"

type SettingsService = Core.Service & {
  load: () => Promise<Record<string, unknown>>
  getGlobal: () => Record<string, unknown>
  getSettings: () => Promise<Record<string, unknown>>
  setSettings: (value: Record<string, unknown>) => Promise<unknown>
  reset: () => void
}

/**
 * The plugin's settings service, which backs the `store > config/plugins.js > defaults`
 * resolution used by the runtime. Tests drive it directly instead of spying on
 * `strapi.config.get`.
 */
export const settingsService = (): SettingsService =>
  strapi.plugin("deep-populate").service("settings") as SettingsService

/** The persisted settings (the store layer only). */
export const getSettings = (): Promise<Record<string, unknown>> => settingsService().getSettings()

/** The fully resolved global config (`store > config/plugins.js > defaults`). */
export const getGlobal = (): Record<string, unknown> => settingsService().getGlobal()

/**
 * Persist a settings patch and refresh the in-memory snapshot the runtime reads.
 * Returns the resolved global config, matching the service contract.
 */
export const setSettings = (value: Record<string, unknown>): Promise<unknown> => settingsService().setSettings(value)

/**
 * Clear the settings for the next test. The store (unlike the in-memory snapshot)
 * survives across suites in the shared `isolate: false` worker, and a non-empty
 * store overrides `config/plugins.js`, so this reset is mandatory to keep suites
 * independent and keep `setPluginConfig` effective.
 */
export const resetSettings = async (): Promise<void> => {
  if (!strapi) return
  await setSettings({})
  settingsService().reset()
}

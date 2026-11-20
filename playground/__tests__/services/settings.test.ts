import type { Core } from "@strapi/strapi"

import { setupStrapi, strapi, teardownStrapi } from "../helpers/strapi"

const settingsService = () =>
  strapi.plugin("deep-populate").service("settings") as Core.Service & {
    getSettings: () => Promise<Record<string, unknown>>
    setSettings: (value: Record<string, unknown>) => Promise<unknown>
  }

const controller = () => strapi.controller("plugin::deep-populate.settings")

const populateService = () => strapi.plugin("deep-populate").service("populate") as Core.Service

const cacheCount = () => strapi.db.query("plugin::deep-populate.cache").count()

const createContext = (body?: unknown) => ({ request: { body }, body: undefined }) as never

describe("settings", () => {
  let originalSettings: Record<string, unknown>
  let cachedPage: { documentId: string }

  beforeAll(async () => {
    await setupStrapi()
    await settingsService().setSettings({})
    originalSettings = await settingsService().getSettings()
    cachedPage = await strapi.documents("api::page.page").create({
      data: { title: "settings cache page", slug: "settings-cache-page" },
    })
  })

  afterAll(async () => {
    await settingsService().setSettings(originalSettings)
    await teardownStrapi()
  })

  beforeEach(async () => {
    await settingsService().setSettings({})
  })

  test("registers the settings permission", () => {
    const actions = strapi.service("admin::permission").actionProvider.values()
    expect(actions.map((action) => action.actionId)).toContain("plugin::deep-populate.settings.access")
  })

  test("gets the effective settings", async () => {
    await settingsService().setSettings({ useCache: false })

    const ctx = createContext()
    await controller().getSettings(ctx)

    expect(ctx.body.data).toMatchObject({
      useCache: false,
      replaceWildcard: true,
      cacheOptions: {},
    })
  })

  test("updates and validates the settings", async () => {
    const ctx = createContext({
      useCache: false,
      replaceWildcard: false,
      omitEmpty: true,
      localizations: true,
      cacheOptions: { clearCacheOnStartup: true, warmOnWrite: true },
    })

    await controller().updateSettings(ctx)

    expect(ctx.body.data).toMatchObject({
      useCache: false,
      replaceWildcard: false,
      omitEmpty: true,
      localizations: true,
      cacheOptions: { clearCacheOnStartup: true, warmOnWrite: true },
    })
    expect(await settingsService().getSettings()).toMatchObject({ useCache: false })
  })

  test("merges partial updates into the stored settings", async () => {
    await settingsService().setSettings({ useCache: false, replaceWildcard: false, omitEmpty: true })

    const ctx = createContext({ localizations: true })
    await controller().updateSettings(ctx)

    expect(await settingsService().getSettings()).toMatchObject({
      useCache: false,
      replaceWildcard: false,
      omitEmpty: true,
      localizations: true,
    })
  })

  test("flushes stale entries when caching is re-enabled", async () => {
    await settingsService().setSettings({ useCache: true })
    await populateService().get({ contentType: "api::page.page", documentId: cachedPage.documentId })
    expect(await cacheCount()).toBeGreaterThan(0)

    await settingsService().setSettings({ useCache: false })
    const ctx = createContext({ useCache: true })
    await controller().updateSettings(ctx)

    expect(await cacheCount()).toBe(0)
  })

  test("rejects unknown settings", async () => {
    const ctx = createContext({ useCache: true, unknown: "value" })

    await expect(controller().updateSettings(ctx)).rejects.toBeDefined()
  })

  test("lists content types and components as targets", async () => {
    const ctx = createContext()
    await controller().getTargets(ctx)

    const uids = (ctx.body.contentTypes as { uid: string }[]).map(({ uid }) => uid)
    expect(uids).toContain("api::page.page")
    expect(uids).not.toContain("plugin::deep-populate.cache")
    expect((ctx.body.components as { uid: string }[]).map(({ uid }) => uid)).toContain("shared.link")
  })
})

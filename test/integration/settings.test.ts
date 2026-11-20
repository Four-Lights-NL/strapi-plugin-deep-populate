import { createPage, type Handle } from "@test/factories"
import { getSettings, setSettings, setupStrapi, strapi } from "@test/harness"
import { beforeAll, beforeEach, describe, expect, test } from "vitest"

const populateService = () =>
  strapi.plugin("deep-populate").service("populate") as unknown as {
    get: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  }

const controller = () =>
  strapi.controller("plugin::deep-populate.settings") as unknown as {
    getSettings: (ctx: unknown) => Promise<void>
    updateSettings: (ctx: unknown) => Promise<void>
    getTargets: (ctx: unknown) => Promise<void>
  }

const cacheCount = async (): Promise<number> =>
  (strapi.db.query("plugin::deep-populate.cache") as unknown as { count: () => Promise<number> }).count()

type Ctx = { request: { body?: unknown }; body: Record<string, unknown> }
const createContext = (body?: unknown): Ctx => ({ request: { body }, body: {} })

describe("settings", () => {
  let cachedPage: Handle

  beforeAll(async () => {
    await setupStrapi()
    await setSettings({})
    cachedPage = await createPage({ title: "settings cache page" })
  })

  beforeEach(async () => {
    await setSettings({})
  })

  test("registers the settings permission", () => {
    const permission = strapi.service("admin::permission") as unknown as {
      actionProvider: { values: () => Array<{ actionId: string }> }
    }
    const actions = permission.actionProvider.values()
    expect(actions.map((action) => action.actionId)).toContain("plugin::deep-populate.settings.access")
  })

  test("gets the effective settings", async () => {
    await setSettings({ useCache: false })

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
    expect(await getSettings()).toMatchObject({ useCache: false })
  })

  test("merges partial updates into the stored settings", async () => {
    await setSettings({ useCache: false, replaceWildcard: false, omitEmpty: true })

    const ctx = createContext({ localizations: true })
    await controller().updateSettings(ctx)

    expect(await getSettings()).toMatchObject({
      useCache: false,
      replaceWildcard: false,
      omitEmpty: true,
      localizations: true,
    })
  })

  test("flushes stale entries when caching is re-enabled", async () => {
    await setSettings({ useCache: true })
    await populateService().get({ contentType: "api::page.page", documentId: cachedPage.documentId })
    expect(await cacheCount()).toBeGreaterThan(0)

    await setSettings({ useCache: false })
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

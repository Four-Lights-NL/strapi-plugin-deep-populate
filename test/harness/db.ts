import { strapi } from "./strapi"

const CACHE_UID = "plugin::deep-populate.cache"

/**
 * Wipe the test-owned data: every playground content type, its components, the
 * relation link tables and the deep-populate cache.
 *
 * Strapi's own bookkeeping is preserved: tables prefixed with `strapi_`
 * (core store, i18n, migrations, schema), `admin_` (api tokens, users) and
 * `up_` (users-permissions roles) are left untouched so the running app keeps
 * working between suites.
 *
 * SQLite foreign keys are disabled for the duration so the delete order does
 * not matter, then re-enabled.
 */
export const resetDatabase = async (): Promise<void> => {
  const db = strapi.db
  const sqlite = String(db.dialect.client).includes("sqlite")

  if (sqlite) {
    await db.connection.raw("PRAGMA foreign_keys = OFF")
    try {
      const rows = await db.connection.raw("SELECT name FROM sqlite_master WHERE type='table'")
      const tables = (rows as unknown as { name: string }[])
        .map((row) => row.name)
        .filter((name) => !/^(sqlite_|strapi_|admin_|up_)/.test(name))

      for (const table of tables) {
        await db
          .connection(table)
          .del()
          .catch(() => undefined)
      }
    } finally {
      await db.connection.raw("PRAGMA foreign_keys = ON")
    }
    return
  }

  // Non-sqlite fallback: iterate the DB metadata and delete each collected model.
  for (const model of db.metadata.values()) {
    const uid = model.uid as string
    const collectionName = (model as { collectionName?: string }).collectionName
    if (uid.startsWith("admin::") || uid.startsWith("strapi::")) continue
    if (uid.startsWith("plugin::") && !uid.startsWith("plugin::deep-populate.")) continue
    if (!collectionName) continue
    await db
      .connection(collectionName)
      .del()
      .catch(() => undefined)
  }
}

/** Delete every cached populate entry. */
export const clearCache = async (): Promise<void> => {
  await strapi.db.query(CACHE_UID).deleteMany({ where: {} })
}

/** Number of cached populate entries. */
export const countCache = async (): Promise<number> => {
  const rows = await strapi.documents(CACHE_UID).findMany({ fields: ["documentId"] })
  return rows.length
}

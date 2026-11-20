import type { Core } from "@strapi/strapi"

import {
  addDeepPopulateCacheFullTextIndex,
  hasDeepPopulateCacheFullTextIndex,
  removeDeepPopulateCacheFullTextIndex,
} from "../migrations"
import { getGlobalConfig } from "../services/deep-populate/utils"

/**
 * Keep the full text index on the cache table in sync with the `useCache` setting. Run on
 * `afterSync` and whenever the settings are saved.
 */
export const syncCacheIndex = async (strapi: Core.Strapi) => {
  // `afterSync` runs before plugins bootstrap, so make sure the store-backed settings are loaded
  // before deciding whether the index should exist.
  await strapi.plugin("deep-populate").service("settings").load()

  const tableName = strapi.db.metadata.get("plugin::deep-populate.cache").tableName
  const columnName = "dependencies"

  const hasIndex = await hasDeepPopulateCacheFullTextIndex(strapi.db, tableName, columnName)
  const hasTable = await strapi.db.connection.schema.hasTable(tableName)
  const hasColumn = hasTable && (await strapi.db.connection.schema.hasColumn(tableName, columnName))
  const cacheIsEnabled = getGlobalConfig().useCache === true

  const shouldCreateIndex = cacheIsEnabled && hasTable && hasColumn && !hasIndex
  const shouldRemoveIndex = hasIndex && (!cacheIsEnabled || !hasTable || !hasColumn)

  if (shouldCreateIndex) await addDeepPopulateCacheFullTextIndex(strapi.db, tableName, columnName)
  if (shouldRemoveIndex) await removeDeepPopulateCacheFullTextIndex(strapi.db, tableName, columnName)
}

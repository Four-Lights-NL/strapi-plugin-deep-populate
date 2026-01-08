import type { Core, Schema, UID } from "@strapi/strapi"

import { async, sanitize } from "@strapi/utils"
import cloneDeep from "lodash/cloneDeep"
import has from "lodash/has"
import isEmpty from "lodash/isEmpty"
import unset from "lodash/unset"

import {
  addDeepPopulateCacheFullTextIndex,
  hasDeepPopulateCacheFullTextIndex,
  removeDeepPopulateCacheFullTextIndex,
} from "./migrations"
import { asBoolean } from "./utils/asBoolean"
import log from "./utils/log"

const populateIsWildcardEquivalent = async ({
  strapi,
  schema,
  populate,
}: {
  strapi: Core.Strapi
  schema: Schema.ContentType
  populate: unknown
}) => {
  if (isEmpty(populate)) return false

  // NOTE: Strapi does all kinds of magic on the populate object, so we need to check if that's the case
  const expandedWildcardQuery = await sanitize.sanitizers.defaultSanitizePopulate(
    {
      schema,
      getModel: (uid: string) => strapi.getModel(uid as UID.Schema),
    },
    "*",
  )

  return populate === "*" || populate === true || JSON.stringify(expandedWildcardQuery) === JSON.stringify(populate)
}

export async function clearCacheForChangedSchemas(schemas: UID.Schema[]) {
  await async.map(schemas, async (schema: UID.Schema) => {
    const deleted = await strapi.db.query("plugin::deep-populate.cache").deleteMany({
      where: {
        dependencies: { $contains: schema },
      },
    })

    log.debug(`Deleted ${deleted.count} cached entries due to out of date schema '${schema}'`)
  })
}

export default async ({ strapi }) => {
  strapi.hook("strapi::content-types.beforeSync").register(async () => {
    const databaseSchema = await strapi.db.dialect.schemaInspector.getSchema()
    const storedSchema = await strapi.db.schema.schemaStorage.read()

    const { status, diff } = await strapi.db.schema.schemaDiff.diff({
      previousSchema: storedSchema?.schema,
      databaseSchema,
      userSchema: strapi.db.schema.schema,
    })

    if (status === "CHANGED") {
      const updatedTables: string[] = (diff.tables.updated ?? []).map((t) => t.name)
      const updatedSchemas: UID.Schema[] = [...strapi.db.metadata.values()]
        .filter((m) => updatedTables.includes(m.tableName))
        .map((m) => m.uid)

      const tableName = strapi.db.metadata.get("plugin::deep-populate.cache").tableName
      const hasTable = await strapi.db.connection.schema.hasTable(tableName)

      // NOTE: We clear the cached entries for changed content types even if the cache is currently disabled
      // because we can only hook into the change _when_ it is applied.
      // So instead of `cacheIsEnabled` we _only_ check if the cache table exist.
      if (hasTable) await clearCacheForChangedSchemas(updatedSchemas)
    }
  })
  strapi.hook("strapi::content-types.afterSync").register(async () => {
    const tableName = strapi.db.metadata.get("plugin::deep-populate.cache").tableName
    const columnName = "dependencies"

    const hasIndex = await hasDeepPopulateCacheFullTextIndex(strapi.db, tableName, columnName)
    const hasTable = await strapi.db.connection.schema.hasTable(tableName)
    const hasColumn = hasTable && (await strapi.db.connection.schema.hasColumn(tableName, columnName))
    const cacheIsEnabled = strapi.config.get("plugin::deep-populate").useCache === true

    const shouldCreateIndex = cacheIsEnabled && hasTable && hasColumn && !hasIndex
    const shouldRemoveIndex = hasIndex && (!cacheIsEnabled || !hasTable || !hasColumn)

    if (shouldCreateIndex) await addDeepPopulateCacheFullTextIndex(strapi.db, tableName, columnName)
    if (shouldRemoveIndex) await removeDeepPopulateCacheFullTextIndex(strapi.db, tableName, columnName)
  })

  strapi.documents.use(async (context, next) => {
    const { useCache, replaceWildcard } = strapi.config.get("plugin::deep-populate")

    if (
      // do nothing if not configured
      (!useCache && !replaceWildcard) ||
      context.uid === "plugin::deep-populate.cache"
    )
      return await next()

    const populateService = strapi.plugin("deep-populate").service("populate")
    const cacheService = strapi.plugin("deep-populate").service("cache")

    const { populate } = context.params
    const bustCache = asBoolean(context.params.bustCache)

    const returnDeeplyPopulated =
      replaceWildcard && (await populateIsWildcardEquivalent({ strapi, schema: context.contentType, populate }))
    if (has(populate, "__deepPopulated")) {
      unset(populate, "__deepPopulated")
      unset(populate, "__deepPopulateConfig")
    }

    if (useCache && context.action === "delete")
      await cacheService.clear({ ...context.params, contentType: context.uid })

    const originalFields = cloneDeep(context.fields)

    if (returnDeeplyPopulated && ["findOne", "findFirst", "findMany"].includes(context.action))
      context.fields = ["documentId", "status", "locale"]

    const result = await next()
    if (!result) return result

    if (["create", "update", "publish"].includes(context.action)) {
      const { documentId, publishedAt, locale } = result
      const status = publishedAt !== null ? "published" : "draft"
      const refreshCache = useCache && ["update", "publish"].includes(context.action)

      if (refreshCache) await cacheService.clear({ ...context.params, status, contentType: context.uid })

      if (useCache || returnDeeplyPopulated) {
        const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
        if (returnDeeplyPopulated)
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
      }
    }

    if (returnDeeplyPopulated && ["findOne", "findFirst"].includes(context.action)) {
      const { documentId, publishedAt, locale } = result
      const status = publishedAt !== null ? "published" : "draft"
      const deepPopulate = await populateService.get({
        contentType: context.uid,
        documentId,
        status,
        locale,
        bustCache,
      })
      return await strapi
        .documents(context.uid)
        .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
    }

    if (returnDeeplyPopulated && context.action === "findMany") {
      return await Promise.all(
        result.map(async ({ documentId, publishedAt, locale }) => {
          const status = publishedAt !== null ? "published" : "draft"
          const deepPopulate = await populateService.get({
            contentType: context.uid,
            documentId,
            status,
            locale,
            bustCache,
          })
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
        }),
      )
    }

    return result
  })
}

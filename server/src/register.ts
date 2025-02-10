import type { Core, Schema, UID } from "@strapi/strapi"
import { sanitize } from "@strapi/utils"
import { klona } from "klona/json"
import {
  addDeepPopulateCacheFullTextIndex,
  hasDeepPopulateCacheFullTextIndex,
  removeDeepPopulateCacheFullTextIndex,
} from "./migrations"

const populateIsWildcardEquivalent = async ({
  strapi,
  schema,
  populate,
}: { strapi: Core.Strapi; schema: Schema.ContentType; populate: unknown }) => {
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

export default async ({ strapi }) => {
  strapi.hook("strapi::content-types.afterSync").register(async () => {
    const tableName = "populate_cache"
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
    const returnDeeplyPopulated =
      replaceWildcard && (await populateIsWildcardEquivalent({ strapi, schema: context.contentType, populate }))

    if (useCache && context.action === "delete")
      await cacheService.clear({ ...context.params, contentType: context.uid })

    const originalFields = klona(context.fields)

    if (returnDeeplyPopulated && ["findOne", "findFirst", "findMany"].includes(context.action))
      context.fields = ["documentId", "status", "locale"]

    const result = await next()

    if (["create", "update"].includes(context.action)) {
      const { documentId, status, locale } = result

      if (useCache && context.action === "update")
        await cacheService.clear({ ...context.params, contentType: context.uid })

      if (useCache || returnDeeplyPopulated) {
        const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
        if (returnDeeplyPopulated)
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
      }
    }

    if (returnDeeplyPopulated && ["findOne", "findFirst"].includes(context.action)) {
      const { documentId, status, locale } = result
      const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
      return await strapi
        .documents(context.uid)
        .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
    }

    if (returnDeeplyPopulated && context.action === "findMany") {
      return await Promise.all(
        result.map(async ({ documentId, status, locale }) => {
          const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
        }),
      )
    }

    return result
  })
}

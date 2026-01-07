import type { Core, Schema, UID } from "@strapi/strapi"

import { async, sanitize } from "@strapi/utils"
import { omit } from "lodash"
import cloneDeep from "lodash/cloneDeep"
import has from "lodash/has"
import isEmpty from "lodash/isEmpty"
import isEqual from "lodash/isEqual"
import unset from "lodash/unset"

import {
  addDeepPopulateCacheFullTextIndex,
  hasDeepPopulateCacheFullTextIndex,
  removeDeepPopulateCacheFullTextIndex,
} from "./migrations"
import { asBoolean } from "./utils/asBoolean"
import { majorMinorVersion } from "./utils/version"

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

interface StrapiContentTypesAfterSyncProps {
  oldContentTypes: Record<string, Schema.ContentType>
  contentTypes: Record<string, Schema.ContentType>
}

// Based on https://github.com/strapi/strapi/blob/f86041c89a8c1545c6437a881dc613e98bc52bd7/packages/core/content-releases/server/src/migrations/index.ts#L127
export async function clearCacheForChangedContentTypes({
  oldContentTypes,
  contentTypes,
}: StrapiContentTypesAfterSyncProps) {
  if (oldContentTypes !== undefined && contentTypes !== undefined) {
    const contentTypesWithDraftAndPublish = Object.keys(oldContentTypes).filter(
      (uid) => oldContentTypes[uid]?.options?.draftAndPublish,
    )

    await async.map(contentTypesWithDraftAndPublish, async (contentTypeUID: UID.ContentType) => {
      const oldContentType = oldContentTypes[contentTypeUID]
      const contentType = contentTypes[contentTypeUID]

      // If attributes have changed, we need to clear cached entries for this content-type
      // NOTE: We omit `publishedAt` and `localizations.joinColumn` as those seem to be a side-effect from the afterSync hook we use.
      if (
        !isEqual(
          omit(oldContentType?.attributes, "publishedAt", "localizations.joinColumn"),
          omit(contentType?.attributes, "publishedAt", "localizations.joinColumn"),
        )
      ) {
        const deleted = await strapi.db.query("plugin::deep-populate.cache").deleteMany({
          where: {
            hash: { $startsWith: `${majorMinorVersion}-${contentTypeUID}` },
          },
        })

        strapi.log.debug(
          `[Plugin: Deep Populate] Deleted ${deleted.count} cached entries due to out of date schema '${contentTypeUID}'`,
        )
      }
    })
  }
}

export default async ({ strapi }) => {
  strapi.hook("strapi::content-types.afterSync").register(async (afterSyncProps: StrapiContentTypesAfterSyncProps) => {
    const tableName = "populate_cache"
    const columnName = "dependencies"

    const hasIndex = await hasDeepPopulateCacheFullTextIndex(strapi.db, tableName, columnName)
    const hasTable = await strapi.db.connection.schema.hasTable(tableName)
    const hasColumn = hasTable && (await strapi.db.connection.schema.hasColumn(tableName, columnName))
    const cacheIsEnabled = strapi.config.get("plugin::deep-populate").useCache === true

    // NOTE: We clear the cached entries for changed content types even if the cache is currently disabled
    // because we can only hook into the change _when_ it is applied.
    // So instead of `cacheIsEnabled` we _only_ check if the cache table exist.
    if (hasTable) await clearCacheForChangedContentTypes(afterSyncProps)

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

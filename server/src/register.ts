import type { Core, Schema, UID } from "@strapi/strapi"

import { async } from "@strapi/utils"
import cloneDeep from "lodash/cloneDeep"
import has from "lodash/has"
import isEmpty from "lodash/isEmpty"
import isEqual from "lodash/isEqual"
import isObject from "lodash/isObject"
import unset from "lodash/unset"

import { getGlobalConfig } from "./services/deep-populate/utils"
import { asBoolean } from "./utils/asBoolean"
import { syncCacheIndex } from "./utils/cacheIndex"
import log from "./utils/log"

/**
 * A populate object is "wildcard shaped" when it is a flat map of `true` values, e.g.
 * `{ sections: true, image: true }`. Strapi produces exactly this for `?populate=*` before it
 * applies auth based filtering, so it is a strong signal that we may have failed to recognise a
 * wildcard request.
 */
const looksLikeWildcard = (populate: unknown): boolean =>
  isObject(populate) &&
  !Array.isArray(populate) &&
  !isEmpty(populate) &&
  Object.values(populate as Record<string, unknown>).every((value) => value === true)

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
  if (populate === "*" || populate === true) return true

  // The content API sanitizes the query before the document service middleware runs, so the incoming
  // populate is core's sanitized result rather than the raw `*`. Reproduce exactly what the controller
  // did by calling the same entry point it uses (`sanitize.query`, which reads `route`/`auth`), with
  // the request's auth.
  //
  // This must be `sanitize.query` and not `sanitize.populate` directly. `sanitizePopulate` already
  // applies `removeRestrictedRelations(auth)` whenever it is given an auth, but core's `sanitizeQuery`
  // only began passing the request auth into it in 5.53.0. Calling `sanitize.populate("*", schema, { auth })`
  // would therefore apply the auth visitor even on <= 5.52.3, where core does not, and silently break
  // `?populate=*` on the very versions that must keep working.
  //
  // The auth-aware sanitization only applies to content API requests. Outside one (direct document
  // service calls, bootstrap) there is no auth-derived populate to match, so we skip the auth visitor
  // to avoid needless work on every call.
  const ctx = strapi.requestContext?.get?.()
  const auth = ctx ? ((ctx.state?.auth as unknown) ?? {}) : undefined
  const sanitized = (await strapi.contentAPI.sanitize.query({ populate: "*" }, schema, { auth })) as {
    populate?: unknown
  }
  const expandedWildcardQuery = sanitized.populate

  const isEquivalent = isEqual(expandedWildcardQuery, populate)

  if (!isEquivalent && looksLikeWildcard(populate)) {
    log.debug(
      "Deep populate: a wildcard-like populate was not recognised as `*` and was passed through " +
        "untouched. This usually means Strapi changed how it sanitizes the populate query.",
      JSON.stringify({ populate, expandedWildcardQuery }),
    )
  }

  return isEquivalent
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
    await syncCacheIndex(strapi)
  })

  strapi.documents.use(async (context, next) => {
    const { useCache, replaceWildcard, cacheOptions } = getGlobalConfig()
    const warmOnWrite = cacheOptions?.warmOnWrite === true

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
      unset(populate, "__deepPopulateSchemaConfig")
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

      if (returnDeeplyPopulated) {
        const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
        return await strapi
          .documents(context.uid)
          .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
      }

      if (useCache && warmOnWrite) {
        await populateService.get({ contentType: context.uid, documentId, status, locale })
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

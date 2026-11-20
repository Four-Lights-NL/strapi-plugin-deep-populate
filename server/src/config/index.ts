import type { UID } from "@strapi/strapi"

import isEmpty from "lodash/isEmpty"
import isObject from "lodash/isObject"

export type ContentTypeConfigAllow = {
  relations?: UID.ContentType[]
  components?: UID.Component[]
}

export type ContentTypeConfigDeny = {
  relations?: UID.ContentType[]
  components?: UID.Component[]
}

export type ContentTypeConfig = {
  omitEmpty?: boolean
  localizations?: boolean
  allow?: ContentTypeConfigAllow
  deny?: ContentTypeConfigDeny
}

export type CacheOptions = {
  clearCacheOnStartup?: boolean
  warmOnWrite?: boolean
}

export type Config = {
  useCache: boolean
  cacheOptions?: CacheOptions
  replaceWildcard: boolean
  omitEmpty?: boolean
  localizations?: boolean
  contentTypes: Partial<Record<UID.ContentType | "*", ContentTypeConfig>>
}

/**
 * Configuration stored in (and edited through) the admin settings page.
 * The content-type specific configuration stays in `config/plugins.js`.
 */
export type GlobalSettings = {
  useCache?: boolean
  replaceWildcard?: boolean
  omitEmpty?: boolean
  localizations?: boolean
  cacheOptions?: CacheOptions
}

/**
 * Fully resolved global configuration (`store > config/plugins.js > defaults`).
 */
export type GlobalConfig = {
  useCache: boolean
  replaceWildcard: boolean
  omitEmpty?: boolean
  localizations?: boolean
  cacheOptions?: CacheOptions
}

/**
 * `pluginOptions['deep-populate']` as it can be set on a content type schema.
 */
export type DeepPopulatePluginOptions = {
  omitEmpty?: boolean
  localizations?: boolean
  selfReferencing?: boolean
  allow?: ContentTypeConfigAllow
  deny?: ContentTypeConfigDeny
}

/**
 * `pluginOptions['deep-populate']` on a component schema. `omitEmpty` and `localizations`
 * are only meaningful on content types, so they are not part of the component shape.
 */
export type DeepPopulateComponentPluginOptions = {
  selfReferencing?: boolean
  allow?: ContentTypeConfigAllow
  deny?: ContentTypeConfigDeny
}

/**
 * `pluginOptions['deep-populate']` on a relation, component or dynamic zone attribute.
 */
export type DeepPopulateAttributePluginOptions = {
  allow?: ContentTypeConfigAllow
  deny?: ContentTypeConfigDeny
}

/**
 * Stored with a cached populate object so cache entries are invalidated when a schema's or an
 * attribute's `pluginOptions['deep-populate']` changes.
 */
export type DeepPopulateSchemaConfig = {
  options?: DeepPopulatePluginOptions
  attributes?: Record<string, DeepPopulateAttributePluginOptions>
}

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && !Array.isArray(value)

const parseStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  return value.filter((entry): entry is string => typeof entry === "string")
}

const parseAllowDeny = (value: unknown): ContentTypeConfigAllow | ContentTypeConfigDeny | undefined => {
  if (!isPlainObject(value)) return undefined

  const relations = parseStringArray(value.relations)
  const components = parseStringArray(value.components)

  if (relations === undefined && components === undefined) return undefined

  return {
    ...(relations !== undefined ? { relations: relations as UID.ContentType[] } : {}),
    ...(components !== undefined ? { components: components as UID.Component[] } : {}),
  }
}

const parseBoolean = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined)

/**
 * Tolerant parser for content-type/component schema options. Unknown keys and UIDs are ignored so
 * that a partially invalid schema never breaks population at runtime.
 */
export const parseSchemaPluginOptions = (value: unknown): DeepPopulatePluginOptions => {
  if (!isPlainObject(value)) return {}

  const omitEmpty = parseBoolean(value.omitEmpty)
  const localizations = parseBoolean(value.localizations)
  const selfReferencing = parseBoolean(value.selfReferencing)
  const allow = parseAllowDeny(value.allow)
  const deny = parseAllowDeny(value.deny)

  return {
    ...(omitEmpty !== undefined ? { omitEmpty } : {}),
    ...(localizations !== undefined ? { localizations } : {}),
    ...(selfReferencing !== undefined ? { selfReferencing } : {}),
    ...(allow !== undefined ? { allow } : {}),
    ...(deny !== undefined ? { deny } : {}),
  }
}

/**
 * Tolerant parser for attribute options. Only allow/deny are supported on attributes.
 */
export const parseAttributePluginOptions = (value: unknown): DeepPopulateAttributePluginOptions => {
  if (!isPlainObject(value)) return {}

  const allow = parseAllowDeny(value.allow)
  const deny = parseAllowDeny(value.deny)

  return {
    ...(allow !== undefined ? { allow } : {}),
    ...(deny !== undefined ? { deny } : {}),
  }
}

export const parseCacheOptions = (value: unknown): CacheOptions | undefined => {
  if (!isPlainObject(value)) return undefined

  const clearCacheOnStartup = parseBoolean(value.clearCacheOnStartup)
  const warmOnWrite = parseBoolean(value.warmOnWrite)

  if (clearCacheOnStartup === undefined && warmOnWrite === undefined) return undefined

  return {
    ...(clearCacheOnStartup !== undefined ? { clearCacheOnStartup } : {}),
    ...(warmOnWrite !== undefined ? { warmOnWrite } : {}),
  }
}

/**
 * Tolerant parser for the settings stored by the admin settings page.
 */
export const parseGlobalSettings = (value: unknown): GlobalSettings => {
  if (!isPlainObject(value)) return {}

  const useCache = parseBoolean(value.useCache)
  const replaceWildcard = parseBoolean(value.replaceWildcard)
  const omitEmpty = parseBoolean(value.omitEmpty)
  const localizations = parseBoolean(value.localizations)
  const cacheOptions = parseCacheOptions(value.cacheOptions)

  return {
    ...(useCache !== undefined ? { useCache } : {}),
    ...(replaceWildcard !== undefined ? { replaceWildcard } : {}),
    ...(omitEmpty !== undefined ? { omitEmpty } : {}),
    ...(localizations !== undefined ? { localizations } : {}),
    ...(cacheOptions !== undefined ? { cacheOptions } : {}),
  }
}

/**
 * Merge the admin settings (highest priority) with `config/plugins.js` and the built-in defaults.
 */
export const resolveGlobalConfig = (settings: GlobalSettings, config: Partial<Config>): GlobalConfig => ({
  useCache: settings.useCache ?? config.useCache ?? true,
  replaceWildcard: settings.replaceWildcard ?? config.replaceWildcard ?? true,
  omitEmpty: settings.omitEmpty ?? config.omitEmpty,
  localizations: settings.localizations ?? config.localizations,
  cacheOptions: {
    ...(config.cacheOptions ?? {}),
    ...(settings.cacheOptions ?? {}),
  },
})

export default {
  default: () => ({ useCache: true, replaceWildcard: true, contentTypes: {} }),
  validator: (config: Config) => {
    if (!isObject(config.contentTypes)) {
      throw new Error("plugin::deep-populate config.contentTypes must be an object")
    }
    if (!isEmpty(config.contentTypes)) {
      for (const [uid, contentTypeConfig] of Object.entries(config.contentTypes)) {
        if (!isObject(contentTypeConfig)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid} must be an object`)
        }
        if (!contentTypeConfig.allow && !contentTypeConfig.deny) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid} must have an "allow" or "deny".`)
        }
        if (contentTypeConfig.allow && !isObject(contentTypeConfig.allow)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid}.allow must be an object`)
        }
        if (contentTypeConfig.deny && !isObject(contentTypeConfig.deny)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid}.deny must be an object`)
        }
        if (contentTypeConfig.allow) {
          if (contentTypeConfig.allow.relations && !Array.isArray(contentTypeConfig.allow.relations)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.allow.relations must be an array`)
          }
          if (contentTypeConfig.allow.components && !Array.isArray(contentTypeConfig.allow.components)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.allow.components must be an array`)
          }
        }
        if (contentTypeConfig.deny) {
          if (contentTypeConfig.deny.relations && !Array.isArray(contentTypeConfig.deny.relations)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.deny.relations must be an array`)
          }
          if (contentTypeConfig.deny.components && !Array.isArray(contentTypeConfig.deny.components)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.deny.components must be an array`)
          }
        }
      }
    }
  },
}

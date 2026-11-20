import type { Schema, UID } from "@strapi/strapi"

import { contentTypes } from "@strapi/utils"

import type {
  Config,
  ContentTypeConfig,
  ContentTypeConfigAllow,
  ContentTypeConfigDeny,
  DeepPopulateAttributePluginOptions,
  DeepPopulatePluginOptions,
  GlobalConfig,
} from "../../config"
import type { PopulateParams } from "../populate"

import { isPlainObject, parseAttributePluginOptions, parseSchemaPluginOptions, resolveGlobalConfig } from "../../config"
import { sanitizeObject } from "../../utils/sanitizeObject"

type PluginOptions = {
  i18n?: {
    localized: boolean
  }
  "deep-populate"?: unknown
}

export const getRelations = <TSchema extends UID.Schema>(model: Schema.Schema<TSchema>) => {
  const filteredAttributes = new Set()

  const { populateCreatorFields } = contentTypes.getOptions(model) as { populateCreatorFields?: boolean }

  const { pluginOptions } = model as { pluginOptions?: PluginOptions }
  if (pluginOptions?.i18n?.localized !== true) {
    filteredAttributes.add("locale")
    filteredAttributes.add("localizations")
  }

  if (!populateCreatorFields) {
    filteredAttributes.add(contentTypes.constants.CREATED_BY_ATTRIBUTE)
    filteredAttributes.add(contentTypes.constants.UPDATED_BY_ATTRIBUTE)
  }

  const relationalAttributes = new Set([
    ...contentTypes.getRelationalAttributes(model).filter((attr) => !filteredAttributes.has(attr)),
    ...contentTypes.getComponentAttributes(model).filter((attr) => !filteredAttributes.has(attr)),
  ])

  return Object.entries(model.attributes).filter(
    ([attrName, attr]) => relationalAttributes.has(attrName) || contentTypes.isMediaAttribute(attr),
  )
}

export const isEmpty = (obj: object) => {
  return obj === undefined || Object.keys(obj).length === 0
}

export const hasValue = (value: unknown) => {
  return !(
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && isEmpty(value))
  )
}

/**
 * `pluginOptions['deep-populate']` of the schema (content type or component) at the current level.
 */
export const getSchemaPluginOptions = (model: Schema.Schema<UID.Schema> | undefined): DeepPopulatePluginOptions => {
  if (!model) return {}
  const { pluginOptions } = model as { pluginOptions?: PluginOptions }
  return parseSchemaPluginOptions(pluginOptions?.["deep-populate"])
}

/**
 * `pluginOptions['deep-populate']` of a relation, component or dynamic zone attribute.
 */
export const getAttributePluginOptions = (attr: Schema.Attribute.AnyAttribute): DeepPopulateAttributePluginOptions => {
  const { pluginOptions } = attr as { pluginOptions?: Record<string, unknown> }
  return parseAttributePluginOptions(pluginOptions?.["deep-populate"])
}

const getStaticConfig = (): Partial<Config> => {
  try {
    const config = strapi.config.get("plugin::deep-populate")
    return isPlainObject(config) ? (config as Partial<Config>) : {}
  } catch {
    return {}
  }
}

/**
 * Resolved global configuration (`store > config/plugins.js > defaults`). Falls back to
 * `config/plugins.js` when the settings service is not available yet (e.g. during register).
 */
export const getGlobalConfig = (): GlobalConfig => {
  try {
    return strapi.plugin("deep-populate").service("settings").getGlobal()
  } catch {
    const config = getStaticConfig()
    return resolveGlobalConfig({}, config)
  }
}

const getContentTypeConfig = (config: Partial<Config>, contentType: UID.ContentType): ContentTypeConfig => {
  const configured = isPlainObject(config.contentTypes) ? config.contentTypes : {}
  const wildcard = configured["*"]
  const specific = configured[contentType]

  const wildcardConfig = isPlainObject(wildcard) ? (wildcard as ContentTypeConfig) : {}
  const specificConfig = isPlainObject(specific) ? (specific as ContentTypeConfig) : {}

  // Per key, the most specific source wins. Allow/deny are not merged across sources.
  const pick = <K extends keyof ContentTypeConfig>(key: K) => specificConfig[key] ?? wildcardConfig[key]

  return {
    ...(pick("omitEmpty") !== undefined ? { omitEmpty: pick("omitEmpty") } : {}),
    ...(pick("localizations") !== undefined ? { localizations: pick("localizations") } : {}),
    ...(pick("allow") !== undefined ? { allow: pick("allow") } : {}),
    ...(pick("deny") !== undefined ? { deny: pick("deny") } : {}),
  }
}

/**
 * Root-scoped configuration inherited by every level of the traversal: the static
 * `contentTypes` configuration (specific > wildcard) plus the global defaults.
 * Schema-level `pluginOptions` are resolved separately at each level.
 */
export const getInheritedConfig = (params: PopulateParams) => {
  const config = getStaticConfig()
  const contentTypeConfig = getContentTypeConfig(config, params.contentType)
  const global = getGlobalConfig()

  return {
    allow: contentTypeConfig.allow,
    deny: contentTypeConfig.deny,
    omitEmpty: contentTypeConfig.omitEmpty ?? global.omitEmpty,
    localizations: contentTypeConfig.localizations ?? global.localizations,
  }
}

const intersect = (base?: string[], extra?: string[]): string[] | undefined => {
  if (base === undefined) return extra
  if (extra === undefined) return base
  return base.filter((value) => extra.includes(value))
}

const union = (base?: string[], extra?: string[]): string[] | undefined => {
  if (base === undefined && extra === undefined) return undefined
  return [...new Set([...(base ?? []), ...(extra ?? [])])]
}

const mergeAllow = (
  inherited?: ContentTypeConfigAllow,
  attribute?: ContentTypeConfigAllow,
): ContentTypeConfigAllow | undefined => {
  if (!inherited && !attribute) return undefined

  const relations = intersect(inherited?.relations, attribute?.relations)
  const components = intersect(inherited?.components, attribute?.components)

  return {
    ...(relations !== undefined ? { relations: relations as UID.ContentType[] } : {}),
    ...(components !== undefined ? { components: components as UID.Component[] } : {}),
  }
}

const mergeDeny = (
  inherited?: ContentTypeConfigDeny,
  attribute?: ContentTypeConfigDeny,
): ContentTypeConfigDeny | undefined => {
  if (!inherited && !attribute) return undefined

  const relations = union(inherited?.relations, attribute?.relations)
  const components = union(inherited?.components, attribute?.components)

  return {
    ...(relations !== undefined ? { relations: relations as UID.ContentType[] } : {}),
    ...(components !== undefined ? { components: components as UID.Component[] } : {}),
  }
}

/**
 * Combine the allow/deny resolved for the current schema with the options of the current
 * attribute. Deny lists are additive (union), allow lists narrow (intersection).
 */
export const mergeAllowDeny = (
  inherited: { allow?: ContentTypeConfigAllow; deny?: ContentTypeConfigDeny } | undefined,
  attribute: DeepPopulateAttributePluginOptions | undefined,
) => ({
  allow: mergeAllow(inherited?.allow, attribute?.allow),
  deny: mergeDeny(inherited?.deny, attribute?.deny),
})

/**
 * Fully resolved configuration for the root content type:
 * `params > schema pluginOptions > static contentTypes[uid] > contentTypes['*'] > global`.
 */
export const getConfig = (params: PopulateParams) => {
  const inherited = getInheritedConfig(params)
  const schemaOptions = getSchemaPluginOptions(strapi.getModel(params.contentType))

  return {
    allow: schemaOptions.allow ?? inherited.allow,
    deny: schemaOptions.deny ?? inherited.deny,
    omitEmpty: params.omitEmpty ?? schemaOptions.omitEmpty ?? inherited.omitEmpty,
    localizations: params.localizations ?? schemaOptions.localizations ?? inherited.localizations,
  }
}

export { sanitizeObject }

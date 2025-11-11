import type { Schema, UID } from "@strapi/strapi"
import { contentTypes } from "@strapi/utils"
import { get, has, mergeWith } from "lodash"
import type { Config } from "../../config"
import { sanitizeObject } from "../../utils/sanitizeObject"
import type { PopulateParams } from "../populate"

type PluginOptions = {
  i18n?: {
    localized: boolean
  }
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

export const getConfig = (params: PopulateParams) => {
  const {
    omitEmpty: omitEmptyFallback,
    localizations: localizationsFallback,
    contentTypes,
  } = strapi.config.get("plugin::deep-populate") as Config
  const contentTypeConfig = has(contentTypes, "*") ? get(contentTypes, "*") : {}
  if (has(contentTypes, params.contentType)) {
    mergeWith(contentTypeConfig, sanitizeObject(get(contentTypes, params.contentType)))
  }
  const { allow, deny } = contentTypeConfig
  const omitEmpty = params.omitEmpty ?? contentTypeConfig.omitEmpty ?? omitEmptyFallback
  const localizations = params.localizations ?? contentTypeConfig.localizations ?? localizationsFallback

  return { allow, deny, omitEmpty, localizations }
}

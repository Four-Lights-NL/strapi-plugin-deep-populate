import type { Schema, UID } from "@strapi/strapi"
import { contentTypes } from "@strapi/utils"

export const getRelations = <TSchema extends UID.Schema>(model: Schema.Schema<TSchema>) => {
  const filteredAttributes = new Set()

  const { populateCreatorFields } = contentTypes.getOptions(model) as { populateCreatorFields?: boolean }
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

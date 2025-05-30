import type { Data, UID } from "@strapi/strapi"
import { contentTypes } from "@strapi/utils"

import cloneDeep from "lodash/cloneDeep"
import get from "lodash/get"
import has from "lodash/has"
import mergeWith from "lodash/mergeWith"
import set from "lodash/set"

import type { Config } from "../../config"
import type { PopulateParams } from "../populate"
import type { PopulateComponentProps, PopulateDynamicZoneProps, PopulateProps, PopulateRelationProps } from "./types"
import { getRelations, hasValue, isEmpty } from "./utils"

async function _populateComponent<TContentType extends UID.ContentType, TSchema extends UID.Schema>({
  schema,
  populate = {},
  lookup,
  attrName,
  inDynamicZone = false,
  __allow,
  __deny,
  ...params
}: PopulateComponentProps<TContentType, TSchema>) {
  const componentLookup = lookup.length === 0 ? [attrName] : [...lookup, inDynamicZone ? "on" : "populate", attrName]

  const componentPopulate = populate
  set(componentPopulate, componentLookup, { populate: "*" })

  if (__allow?.components && !__allow.components.includes(schema as UID.Component)) return { populate: "*" }
  if (__deny?.components?.includes(schema as UID.Component)) return { populate: "*" }

  const nestedPopulate = await _populate({
    schema,
    populate: componentPopulate,
    lookup: componentLookup,
    __allow,
    __deny,
    ...params,
  })
  return isEmpty(nestedPopulate) ? true : { populate: nestedPopulate }
}

async function _populateDynamicZone<TContentType extends UID.ContentType>({
  components,
  lookup,
  attrName,
  ...params
}: PopulateDynamicZoneProps<TContentType>) {
  const dynamicZoneLookup = [...lookup, attrName]

  const resolvedPopulate = {}
  for (const component of components) {
    const componentPopulate = await _populateComponent({
      schema: component,
      lookup: dynamicZoneLookup,
      attrName: component,
      inDynamicZone: true,
      ...params,
    })

    set(resolvedPopulate, [component], componentPopulate) // NOTE: We pass cur as `array` so that the dot notation is used as the key
  }

  if (isEmpty(resolvedPopulate)) return undefined
  return { on: resolvedPopulate }
}

function _populateMedia() {
  return true
}

async function _populateRelation<TContentType extends UID.ContentType>({
  contentType,
  relation,
  resolvedRelations,
  ...params
}: PopulateRelationProps<TContentType>) {
  const isSingleRelation = !Array.isArray(relation)
  const relations = isSingleRelation ? [relation] : relation

  // Forward pass to prevent circular references
  const nonResolvedRelations = relations.filter(({ documentId }) => !resolvedRelations.has(documentId))
  for (const relation of nonResolvedRelations) {
    resolvedRelations.set(relation.documentId, {})

    const relationPopulate = await _populate({
      contentType,
      documentId: relation.documentId,
      schema: contentType,
      resolvedRelations,
      ...params,
    })

    resolvedRelations.set(relation.documentId, relationPopulate)
  }

  // Consolidate relations
  const newPopulate = {} as Record<UID.Schema, unknown>
  for (const { documentId } of relations) {
    const relationPopulate = resolvedRelations.get(documentId)
    mergeWith(newPopulate, relationPopulate, (existing, proposed) => {
      if (proposed === true && existing) return existing
      return undefined
    })
  }

  return isEmpty(newPopulate) ? true : { populate: newPopulate }
}

const _resolveValue = ({ document, lookup, attrName }) => {
  // If the lookup contains an `on`, we're dealing with a dynamic zone
  // and need to resolve the value using the `__component` field
  const dynamicZoneIdx = Array.isArray(lookup) ? lookup.findIndex((l) => l === "on") : -1
  const populateIdx = Array.isArray(lookup) ? lookup.findIndex((l) => l === "populate") : -1
  if (dynamicZoneIdx !== -1) {
    const dynamicZoneLookup = lookup.slice(0, dynamicZoneIdx)
    const dynamicZoneComponent = lookup[dynamicZoneIdx + 1]

    const componentLookup = lookup.slice(dynamicZoneIdx + 2)
    if (componentLookup.find((l) => l === "on")) {
      throw Error("Nested dynamic zones are not supported")
    }

    const dynamicZoneValue = dynamicZoneLookup.length === 0 ? document : get(document, dynamicZoneLookup, [])
    const componentValue = dynamicZoneValue
      .filter((b) => b.__component === dynamicZoneComponent)
      .map((c) => _resolveValue({ document: c, lookup: componentLookup, attrName }))

    // It's possible that the component type is used more often in the dynamic zone, so we try to find one that actually has the requested attribute set
    return (Array.isArray(componentValue) ? componentValue : [componentValue]).find((v) => hasValue(v))
  }

  // If the lookup contains a `populate`, we're dealing with a component or relation
  if (populateIdx !== -1) {
    const parentLookup = lookup.slice(0, populateIdx)
    const childLookup = lookup.slice(populateIdx + 1, lookup.length)

    const parentValue = parentLookup.length === 0 ? document : get(document, parentLookup)
    const childValue = (Array.isArray(parentValue) ? parentValue : [parentValue]).map((v) =>
      _resolveValue({ document: v, lookup: childLookup, attrName }),
    )

    // It's possible that multiple components or relations are available, so we try to find one that actually has the requested attribute set
    return childValue.find((v) => hasValue(v))
  }

  // Otherwise, we'll just do a normal lookup
  const parentValue = lookup.length === 0 ? document : get(document, lookup)
  if (Array.isArray(parentValue)) {
    return parentValue.map((v) => v[attrName]).filter((v) => hasValue(v))
  }
  return parentValue?.[attrName]
}

async function _populate<TContentType extends UID.ContentType, TSchema extends UID.Schema>({
  contentType,
  schema,
  populate = {},
  lookup = [],
  resolvedRelations,
  omitEmpty,
  __deny,
  __allow,
  ...params
}: PopulateProps<TContentType, TSchema>) {
  const newPopulate = {}

  let relations = getRelations(strapi.getModel(schema))
  let currentPopulate = cloneDeep(populate)

  // Make sure we won't revisit this documentId from nested children
  resolvedRelations.set(params.documentId, true)

  // Make sure we retrieve all related objects one level below this on
  for (const [attrName, attr] of relations) {
    if (lookup.length > 0) {
      const parent = get(currentPopulate, lookup)
      if (parent === undefined || (parent !== "*" && "populate" in parent && parent.populate === "*"))
        set(currentPopulate, [...lookup, "populate"], {})
      set(
        currentPopulate,
        [...lookup, "populate", attrName],
        contentTypes.isMediaAttribute(attr) ? true : { populate: "*" },
      )
    } else {
      set(currentPopulate, attrName, { populate: "*" })
    }
  }

  // Get the document for this level
  let document = (await strapi.documents(contentType).findOne({
    ...params,
    populate: currentPopulate ? currentPopulate : "*",
  })) as Data.Entity<TContentType>

  currentPopulate = null

  // Filter relations on actual value and optional allowing or denying
  const resolveRelations = []
  for (const [attrName, attr] of relations) {
    const value = _resolveValue({ document, attrName, lookup })

    if (!hasValue(value)) {
      if (omitEmpty !== true) newPopulate[attrName] = true
      continue
    }

    if (params.localizations !== true && attrName === "localizations" && hasValue(value)) {
      newPopulate[attrName] = true
      continue
    }

    if (contentTypes.isRelationalAttribute(attr)) {
      if (__allow?.relations && !__allow.relations.includes(attr.target as UID.ContentType)) {
        newPopulate[attrName] = true
        continue
      }

      if (__deny?.relations?.includes(attr.target as UID.ContentType)) {
        newPopulate[attrName] = true
        continue
      }
    }

    if (contentTypes.isComponentAttribute(attr) && !contentTypes.isDynamicZoneAttribute(attr)) {
      if (__allow?.components && !__allow.components.includes(attr.component as UID.Component)) {
        newPopulate[attrName] = true
        continue
      }

      if (__deny?.components?.includes(attr.component as UID.Component)) {
        newPopulate[attrName] = true
        continue
      }
    }

    resolveRelations.push([attrName, attr, value])
  }

  relations = null
  document = null

  // Construct actual populate
  for (const [attrName, attr, value] of resolveRelations) {
    if (contentTypes.isDynamicZoneAttribute(attr)) {
      const relComponents = (value as Data.Component[]).map(
        (dataComponent) =>
          attr.components.find((schemaComponent) => schemaComponent === dataComponent.__component) as UID.Component,
      )

      newPopulate[attrName] = await _populateDynamicZone({
        contentType,
        components: relComponents,
        lookup,
        attrName,
        resolvedRelations,
        omitEmpty,
        __deny,
        __allow,
        ...params,
      })
    }

    if (contentTypes.isRelationalAttribute(attr)) {
      newPopulate[attrName] = await _populateRelation({
        contentType: attr.target as UID.ContentType,
        relation: value,
        resolvedRelations,
        omitEmpty,
        locale: params.locale,
        status: params.status,
        localizations: params.localizations,
        __deny,
        __allow,
      })
    }

    if (contentTypes.isComponentAttribute(attr) && !contentTypes.isDynamicZoneAttribute(attr)) {
      newPopulate[attrName] = await _populateComponent({
        contentType,
        schema: attr.component as UID.Component,
        lookup,
        attrName,
        resolvedRelations,
        omitEmpty,
        __deny,
        __allow,
        ...params,
      })
    }

    if (contentTypes.isMediaAttribute(attr)) {
      newPopulate[attrName] = _populateMedia()
    }
  }

  return newPopulate
}

export default async function populate(params: PopulateParams) {
  const { contentTypes } = strapi.config.get("plugin::deep-populate") as Config
  const contentTypeConfig = has(contentTypes, "*") ? get(contentTypes, "*") : {}
  if (has(contentTypes, params.contentType)) {
    mergeWith(contentTypeConfig, get(contentTypes, params.contentType))
  }
  const { allow, deny } = contentTypeConfig

  const resolvedRelations = new Map()
  const populated = (await _populate({
    ...params,
    schema: params.contentType,
    resolvedRelations,
    __deny: deny,
    __allow: allow,
  })) as Record<string, unknown>
  populated.__deepPopulated = true
  return { populate: populated, dependencies: [...resolvedRelations.keys()] }
}

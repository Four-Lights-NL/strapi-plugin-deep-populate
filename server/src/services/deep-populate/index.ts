import type { Data, UID } from "@strapi/strapi"
import delve from "dlv"
import { dset } from "dset/merge"
import { klona } from "klona/json"

import { contentTypes } from "@strapi/utils"
import type { PopulateComponentProps, PopulateDynamicZoneProps, PopulateProps, PopulateRelationProps } from "./types"
import { getRelations, hasValue, isEmpty } from "./utils"

async function _populateComponent<TContentType extends UID.ContentType, TSchema extends UID.Schema>({
  mainUid,
  mainDocumentId,
  schema,
  populate = {},
  lookup,
  inDynamicZone = false,
  omitEmpty,
}: PopulateComponentProps<TContentType, TSchema>) {
  const attrName = lookup.pop()
  const componentLookup = lookup.length === 0 ? [attrName] : [...lookup, inDynamicZone ? "on" : "populate", attrName]

  const componentPopulate = klona(populate)
  dset(componentPopulate, componentLookup, { populate: "*" })

  const nestedPopulate = await _populate({
    mainUid,
    mainDocumentId,
    schema,
    populate: componentPopulate,
    lookup: componentLookup,
    omitEmpty,
  })
  return isEmpty(nestedPopulate) ? true : { populate: nestedPopulate }
}

async function _populateDynamicZone<TContentType extends UID.ContentType>({
  mainUid,
  mainDocumentId,
  components,
  populate,
  lookup,
  omitEmpty,
}: PopulateDynamicZoneProps<TContentType>) {
  const resolvedPopulate = await components.reduce(async (prev, cur) => {
    const curPopulate = await _populateComponent({
      mainUid,
      mainDocumentId,
      schema: cur,
      populate,
      lookup: [...lookup, cur],
      inDynamicZone: true,
      omitEmpty,
    })

    const newPop = await prev
    dset(newPop, [cur], curPopulate) // NOTE: We pass cur as `array` so that the dot notation is used as the key
    return newPop
  }, Promise.resolve({}))

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
  omitEmpty,
}: PopulateRelationProps<TContentType>) {
  const isSingleRelation = !Array.isArray(relation)
  const relations = isSingleRelation ? [relation] : relation

  // Forward pass to prevent circular references
  for (const relation of relations.filter(({ documentId }) => !resolvedRelations.has(documentId))) {
    resolvedRelations.set(relation.documentId, {})

    const relationPopulate = await _populate({
      mainUid: contentType,
      mainDocumentId: relation.documentId,
      schema: contentType,
      resolvedRelations,
      omitEmpty,
    })

    resolvedRelations.set(relation.documentId, relationPopulate)
  }

  // Consolidate relations
  const newPopulate = {} as Record<UID.Schema, unknown>
  for (const { documentId } of relations) {
    const relationPopulate = resolvedRelations.get(documentId)
    Object.keys(relationPopulate).map((r) => dset(newPopulate, r, relationPopulate[r]))
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

    const dynamicZoneValue = delve(document, dynamicZoneLookup) ?? []
    const componentValue = dynamicZoneValue
      .filter((b) => b.__component === dynamicZoneComponent)
      .map((c) => _resolveValue({ document: c, lookup: componentLookup, attrName }))

    // It's possible that the component type is used more often in the dynamic zone, so we try to find one that actually has the requested attribute set
    return (Array.isArray(componentValue) ? componentValue : [componentValue]).find((v) => hasValue(v))
  }

  // If the lookup contains a `populate`, we're dealing with a component or relation
  if (populateIdx !== -1) {
    const parentLookup = lookup.slice(0, populateIdx)
    const childLookup = lookup[populateIdx + 1]

    const parentValue = delve(document, parentLookup)
    const childValue = (Array.isArray(parentValue) ? parentValue : [parentValue]).map((v) =>
      _resolveValue({ document: parentValue, lookup: childLookup, attrName }),
    )

    // It's possible that multiple components or relations are available, so we try to find one that actually has the requested attribute set
    return childValue.find((v) => hasValue(v))
  }

  // Otherwise, we'll just do a normal lookup
  const parentValue = delve(document, lookup)
  if (Array.isArray(parentValue)) {
    return parentValue.map((v) => v[attrName]).filter((v) => hasValue(v))
  }
  return parentValue?.[attrName]
}

export default async function _populate<TContentType extends UID.ContentType, TSchema extends UID.Schema>({
  mainUid,
  mainDocumentId,
  schema,
  populate = {},
  lookup = [],
  resolvedRelations = new Map(),
  omitEmpty = true,
}: PopulateProps<TContentType, TSchema>) {
  const newPopulate = {}

  const model = strapi.getModel(schema)
  const relations = getRelations(model)
  const currentPopulate = klona(populate)

  // Make sure we retrieve all related objects one level below this on
  for (const [attrName] of relations) {
    if (lookup.length > 0) {
      const parent = delve(currentPopulate, lookup)
      if (parent === undefined || (parent !== "*" && "populate" in parent && parent.populate === "*"))
        dset(currentPopulate, [...lookup, "populate"], {})
      dset(currentPopulate, [...lookup, "populate", attrName], { populate: "*" })
    } else {
      dset(currentPopulate, attrName, { populate: "*" })
    }
  }

  // Get the document for this level
  const document = (await strapi.documents(mainUid).findOne({
    documentId: mainDocumentId,
    populate: currentPopulate ? currentPopulate : "*",
  })) as Data.Entity<TContentType>

  // Construct actual populate
  for (const [attrName, attr] of relations) {
    const value = _resolveValue({ document, attrName, lookup })

    if (!hasValue(value)) {
      if (!omitEmpty) newPopulate[attrName] = true
      continue
    }

    if (contentTypes.isDynamicZoneAttribute(attr)) {
      const relComponents = (value as Data.Component[]).map((dataComponent) =>
        attr.components.find((schemaComponent) => schemaComponent === dataComponent.__component),
      )
      newPopulate[attrName] = await _populateDynamicZone({
        mainUid,
        mainDocumentId,
        components: relComponents,
        lookup: [...lookup, attrName],
        omitEmpty,
      })
    }

    if (contentTypes.isRelationalAttribute(attr)) {
      const { target: relContentType } = attr as { target?: UID.ContentType }

      newPopulate[attrName] = await _populateRelation({
        contentType: relContentType,
        relation: value,
        resolvedRelations,
        omitEmpty,
      })
    }

    if (contentTypes.isComponentAttribute(attr) && !contentTypes.isDynamicZoneAttribute(attr)) {
      newPopulate[attrName] = await _populateComponent({
        mainUid,
        mainDocumentId,
        schema: attr.component,
        lookup: [...lookup, attrName],
        omitEmpty,
      })
    }

    if (contentTypes.isMediaAttribute(attr)) {
      newPopulate[attrName] = _populateMedia()
    }
  }

  return newPopulate
}

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
  populate,
  lookup,
}: PopulateComponentProps<TContentType, TSchema>) {
  const nestedPopulate = await _populate({ mainUid, mainDocumentId, schema, populate, lookup })
  return { populate: nestedPopulate ? nestedPopulate : "*" }
}

async function _populateDynamicZone<TContentType extends UID.ContentType>({
  mainUid,
  mainDocumentId,
  components,
  populate,
  lookup,
}: PopulateDynamicZoneProps<TContentType>) {
  const dzLookup = [...lookup, "on"]
  const dzPopulate = klona(populate)
  dset(dzPopulate, dzLookup, {})

  const resolvedPopulate = await components.reduce(async (prev, cur) => {
    const componentPopulate = klona(dzPopulate)
    delve(componentPopulate, dzLookup)[cur] = { populate: "*" }
    const curPopulate = await _populateComponent({
      mainUid,
      mainDocumentId,
      schema: cur,
      populate: componentPopulate,
      lookup: [...dzLookup, cur],
    })

    const newPop = await prev
    dset(newPop, [cur], curPopulate) // NOTE: We pass cur as `array` so that the dot notation is used as the key
    return newPop
  }, Promise.resolve({}))

  if (isEmpty(resolvedPopulate)) return undefined
  return { on: resolvedPopulate }
}

function _populateMedia() {
  return { populate: "*" }
}

async function _populateRelation<TContentType extends UID.ContentType>({
  contentType,
  relation,
  resolvedRelations,
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
    })

    resolvedRelations.set(relation.documentId, relationPopulate)
  }

  // Consolidate relations
  const newPopulate = {} as Record<UID.Schema, unknown>
  for (const { documentId } of relations) {
    const relationPopulate = resolvedRelations.get(documentId)
    Object.keys(relationPopulate).map((r) => dset(newPopulate, r, relationPopulate[r]))
  }

  return { populate: newPopulate }
}

export default async function _populate<TContentType extends UID.ContentType, TSchema extends UID.Schema>({
  mainUid,
  mainDocumentId,
  schema,
  populate = {},
  lookup = [],
  resolvedRelations = new Map(),
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
    const attrLookup = [...lookup, attrName]
    const value = delve(document, attrLookup)
    if (!hasValue(value)) {
      newPopulate[attrName] = true
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
        populate: newPopulate,
        lookup: [...lookup, attrName],
      })
    }

    if (contentTypes.isRelationalAttribute(attr)) {
      const { target: relContentType } = attr as { target?: UID.ContentType }

      newPopulate[attrName] = await _populateRelation({
        contentType: relContentType,
        relation: value,
        resolvedRelations,
      })
    }

    if (contentTypes.isComponentAttribute(attr) && !contentTypes.isDynamicZoneAttribute(attr)) {
      newPopulate[attrName] = await _populateComponent({
        mainUid,
        mainDocumentId,
        schema: attr.component,
        populate: newPopulate,
        lookup: [...lookup, attrName],
      })
    }

    if (contentTypes.isMediaAttribute(attr)) {
      newPopulate[attrName] = _populateMedia()
    }
  }

  return isEmpty(newPopulate) ? "*" : newPopulate
}

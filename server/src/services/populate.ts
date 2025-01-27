import type { Core, UID } from "@strapi/strapi"
import { dset } from "dset/merge"
import populate from "./deep-populate"

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async get({
    contentType,
    documentId,
    omitEmpty = false,
  }: { contentType: UID.ContentType; documentId: string; omitEmpty?: boolean }) {
    return await populate({ mainUid: contentType, mainDocumentId: documentId, schema: contentType, omitEmpty })
  },
  documents(contentType: UID.ContentType) {
    const documents = strapi.documents(contentType)
    const { findOne, ...wrapped } = strapi.documents(contentType)

    const wrappedFindOne: typeof findOne = async (params) => {
      const { documentId, populate: originalPopulate } = params
      const deepPopulate = await populate({
        mainUid: contentType,
        mainDocumentId: documentId,
        schema: contentType,
        omitEmpty: originalPopulate !== "*",
      })

      // Try to merge the original populate with the deepPopulate
      if (originalPopulate && originalPopulate !== "*") {
        strapi.log.warn(
          `passed "populate" will be merged with deepPopulate, which could result in unexpected behavior.`,
        )
        if (typeof originalPopulate === "object")
          Object.keys(originalPopulate).map((k) => dset(deepPopulate, k, originalPopulate[k]))
        if (Array.isArray(originalPopulate)) originalPopulate.map((k) => dset(deepPopulate, k, true))
      }

      return await findOne({ ...params, populate: deepPopulate })
    }

    return { ...wrapped, findOne: wrappedFindOne } as typeof documents
  },
})

import type { Core, UID } from "@strapi/strapi"
import { dset } from "dset/merge"
import populate from "./deep-populate"

const deepPopulateService = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getPopulate({ contentType, documentId }: { contentType: UID.ContentType; documentId: string }) {
    return await populate({ mainUid: contentType, mainDocumentId: documentId, schema: contentType })
  },
  documents(contentType: UID.ContentType) {
    const documents = strapi.documents(contentType)
    const { findOne, ...wrapped } = strapi.documents(contentType)

    const wrappedFindOne: typeof findOne = async (params) => {
      const { documentId, populate: originalPopulate } = params
      const deepPopulate = await populate({ mainUid: contentType, mainDocumentId: documentId, schema: contentType })

      // Try to merge the original populate with the deepPopulate
      // NOTE: `populate: '*'` will be fully replaced because deepPopulate is by definition more specific
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

export default deepPopulateService

import type { Core, Modules } from "@strapi/strapi"

import type { PopulateParams } from "./populate"

type SetPopulateParams = PopulateParams & Modules.Documents.Params.Pick<PopulateParams["contentType"], "populate">

const getHash = (params: PopulateParams) => {
  return `${params.contentType}-${params.documentId}-${params.locale}-${params.status}-${params.omitEmpty ? "sparse" : "full"}`
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(params: PopulateParams) {
    const entry = await strapi
      .documents("plugin::deep-populate.cache")
      .findFirst({ filters: { hash: { $eq: getHash(params) } } })
    return entry ? entry.populate : null
  },
  async set({ populate, ...params }: SetPopulateParams) {
    await strapi.documents("plugin::deep-populate.cache").create({ data: { hash: getHash(params), populate } })
  },
  async clear(params: PopulateParams) {
    const entry = await strapi
      .documents("plugin::deep-populate.cache")
      .findFirst({ filters: { hash: { $eq: getHash(params) } } })
    if (entry) {
      return await strapi.documents("plugin::deep-populate.cache").delete({ documentId: entry.documentId })
    }
    return null
  },
})

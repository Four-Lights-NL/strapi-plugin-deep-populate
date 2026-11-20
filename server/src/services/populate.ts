import type { Core, Modules, UID } from "@strapi/strapi"

import populate from "./deep-populate"
import { getGlobalConfig } from "./deep-populate/utils"

export type PopulateParams<TContentType extends UID.ContentType = UID.ContentType> = Modules.Documents.Params.Pick<
  TContentType,
  "locale:string" | "status"
> & {
  contentType: TContentType
  documentId: string
  omitEmpty?: boolean
  bustCache?: boolean
  localizations?: boolean
}

export default (_: { strapi: Core.Strapi }) => ({
  async get(params: PopulateParams) {
    const { useCache } = getGlobalConfig()
    if (!useCache) return (await populate(params)).populate

    const cachedEntry = await strapi.service("plugin::deep-populate.cache").get(params)
    if (cachedEntry && params.bustCache !== true) return cachedEntry

    const resolved = await populate(params)
    await strapi.service("plugin::deep-populate.cache").set({ ...params, ...resolved })
    return resolved.populate
  },
})

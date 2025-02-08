import type { Core, Modules, UID } from "@strapi/strapi"

import type config from "../config"
import populate from "./deep-populate"

export type PopulateParams<TContentType extends UID.ContentType = UID.ContentType> = Modules.Documents.Params.Pick<
  TContentType,
  "locale:string" | "status"
> & {
  contentType: TContentType
  documentId: string
  omitEmpty?: boolean
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(params: PopulateParams) {
    const { cachePopulate } = strapi.config.get<ReturnType<(typeof config)["default"]>>("plugin::deep-populate")

    if (!cachePopulate) return await populate(params)

    const cachedEntry = await strapi.service("plugin::deep-populate.cache").get(params)
    if (cachedEntry) return cachedEntry

    const resolved = await populate(params)
    await strapi.service("plugin::deep-populate.cache").set({ ...params, populate: resolved })
    return resolved
  },
})

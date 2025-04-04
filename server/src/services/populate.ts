import type { Core, Modules, UID } from "@strapi/strapi"

import type { Config } from "../config"
import populate from "./deep-populate"

export type PopulateParams<TContentType extends UID.ContentType = UID.ContentType> = Modules.Documents.Params.Pick<
  TContentType,
  "locale:string" | "status"
> & {
  contentType: TContentType
  documentId: string
  omitEmpty?: boolean
  localizations?: boolean
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(params: PopulateParams) {
    const { useCache } = strapi.config.get("plugin::deep-populate") as Config

    if (!useCache) return (await populate(params)).populate

    const cachedEntry = await strapi.service("plugin::deep-populate.cache").get(params)
    if (cachedEntry) return cachedEntry

    const resolved = await populate(params)
    await strapi.service("plugin::deep-populate.cache").set({ ...params, ...resolved })
    return resolved.populate
  },
})

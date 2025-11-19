import type { Core, Modules } from "@strapi/strapi"

import get from "lodash/get"
import isEmpty from "lodash/isEmpty"
import isEqual from "lodash/isEqual"

import type { PopulateParams } from "./populate"

import { version } from "../../../package.json"
import { getConfig } from "./deep-populate/utils"

type SetPopulateParams = PopulateParams &
  Modules.Documents.Params.Pick<PopulateParams["contentType"], "populate"> & { dependencies: string[] }

const majorMinorVersion = version.split(".").slice(0, -1).join(".")

const isEqualConfig = (lhs: object, rhs: object) => {
  const cleanedLhs = JSON.parse(JSON.stringify(lhs))
  const cleanedRhs = JSON.parse(JSON.stringify(rhs))
  return isEqual(cleanedLhs, cleanedRhs)
}

const getHash = (params: PopulateParams) => {
  return `${majorMinorVersion}-${params.contentType}-${params.documentId}-${params.locale}-${params.status}`
}

const isValid = (entry: Modules.Documents.AnyDocument, params: PopulateParams) => {
  if (entry && !isEmpty(entry.populate) && get(entry.populate, "__deepPopulated", false)) {
    const cachedConfig = entry.populate.__deepPopulateConfig
    const currentConfig = getConfig(params)
    return isEqualConfig(cachedConfig, currentConfig)
  }
  return false
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(params: PopulateParams) {
    const entry = await strapi
      .documents("plugin::deep-populate.cache")
      .findFirst({ filters: { hash: { $eq: getHash(params) } } })
    return isValid(entry, params) ? entry.populate : null
  },
  async set({ populate, dependencies, ...params }: SetPopulateParams) {
    const documentService = strapi.documents("plugin::deep-populate.cache")
    const hash = getHash(params)

    const entry = await documentService.findFirst({ filters: { hash: { $eq: hash } } })

    return entry
      ? await documentService.update({
          documentId: entry.documentId,
          data: { populate, dependencies: dependencies.join(",") } as Partial<
            Modules.Documents.Params.Data.Input<"plugin::deep-populate.cache">
          >,
        })
      : await documentService.create({ data: { hash, params, populate, dependencies: dependencies.join(",") } })
  },
  async clear(params: PopulateParams) {
    const entry = await strapi
      .documents("plugin::deep-populate.cache")
      .findFirst({ filters: { hash: { $eq: getHash(params) } } })

    let retval = null

    if (entry) {
      retval = await strapi.documents("plugin::deep-populate.cache").delete({ documentId: entry.documentId })
    }

    await this.refreshDependents(params.documentId)
    return retval
  },

  async refreshDependents(documentId: string) {
    // Get all cached entries that are dependent on the document
    const entries = await strapi
      .documents("plugin::deep-populate.cache")
      .findMany({ filters: { dependencies: { $contains: documentId } }, fields: ["documentId", "params"] })

    // Delete the cached entries
    const deleted = await strapi.db.query("plugin::deep-populate.cache").deleteMany({
      where: {
        documentId: { $in: entries.map((x) => x.documentId) },
      },
    })

    if (deleted.count !== entries.length)
      console.error(`Deleted count ${deleted.count} does not match entries count ${entries.length}`)

    // Then, in batches, re-populate the entries
    const batchSize = 5
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      await Promise.all(batch.map((entry) => strapi.service("plugin::deep-populate.populate").get(entry.params)))
    }
  },
})

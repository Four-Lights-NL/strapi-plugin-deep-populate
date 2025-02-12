import type { UID } from "@strapi/strapi"
import isEmpty from "lodash/isEmpty"
import isObject from "lodash/isObject"

export type ContentTypeConfigWhitelist = {
  relations?: UID.ContentType[]
  components?: UID.Component[]
}

export type ContentTypeConfigBlacklist = {
  relations?: UID.ContentType[]
  components?: UID.Component[]
}

type ContentTypeConfig = {
  whitelist?: ContentTypeConfigWhitelist
  blacklist?: ContentTypeConfigBlacklist
}

export type Config = {
  useCache: boolean
  replaceWildcard: boolean
  contentTypes: Record<UID.ContentType, ContentTypeConfig>
}

export default {
  default: ({ env }) => ({ useCache: true, replaceWildcard: true, contentTypes: {} }),
  validator: (config: Config) => {
    if (!isObject(config.contentTypes)) {
      throw new Error("plugin::deep-populate config.contentTypes must be an object")
    }
    if (!isEmpty(config.contentTypes)) {
      for (const [uid, contentTypeConfig] of Object.entries(config.contentTypes)) {
        if (!isObject(contentTypeConfig)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid} must be an object`)
        }
        if (!contentTypeConfig.whitelist && !contentTypeConfig.blacklist) {
          throw new Error(
            `plugin::deep-populate config.contentTypes.${uid} must have either a "whitelist" or "blacklist".`,
          )
        }
        if (contentTypeConfig.whitelist && !isObject(contentTypeConfig.whitelist)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid}.whitelist must be an object`)
        }
        if (contentTypeConfig.blacklist && !isObject(contentTypeConfig.blacklist)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid}.blacklist must be an object`)
        }
        if (contentTypeConfig.whitelist) {
          if (contentTypeConfig.whitelist.relations && !Array.isArray(contentTypeConfig.whitelist.relations)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.whitelist.relations must be an array`)
          }
          if (contentTypeConfig.whitelist.components && !Array.isArray(contentTypeConfig.whitelist.components)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.whitelist.components must be an array`)
          }
        }
        if (contentTypeConfig.blacklist) {
          if (contentTypeConfig.blacklist.relations && !Array.isArray(contentTypeConfig.blacklist.relations)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.blacklist.relations must be an array`)
          }
          if (contentTypeConfig.blacklist.components && !Array.isArray(contentTypeConfig.blacklist.components)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.blacklist.components must be an array`)
          }
        }
      }
    }
  },
}

import type { UID } from "@strapi/strapi"
import isEmpty from "lodash/isEmpty"
import isObject from "lodash/isObject"

export type ContentTypeConfigAllow = {
  relations?: UID.ContentType[]
  components?: UID.Component[]
}

export type ContentTypeConfigDeny = {
  relations?: UID.ContentType[]
  components?: UID.Component[]
}

type ContentTypeConfig = {
  allow?: ContentTypeConfigAllow
  deny?: ContentTypeConfigDeny
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
        if (!contentTypeConfig.allow && !contentTypeConfig.deny) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid} must have an "allow" or "deny".`)
        }
        if (contentTypeConfig.allow && !isObject(contentTypeConfig.allow)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid}.allow must be an object`)
        }
        if (contentTypeConfig.deny && !isObject(contentTypeConfig.deny)) {
          throw new Error(`plugin::deep-populate config.contentTypes.${uid}.deny must be an object`)
        }
        if (contentTypeConfig.allow) {
          if (contentTypeConfig.allow.relations && !Array.isArray(contentTypeConfig.allow.relations)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.allow.relations must be an array`)
          }
          if (contentTypeConfig.allow.components && !Array.isArray(contentTypeConfig.allow.components)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.allow.components must be an array`)
          }
        }
        if (contentTypeConfig.deny) {
          if (contentTypeConfig.deny.relations && !Array.isArray(contentTypeConfig.deny.relations)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.deny.relations must be an array`)
          }
          if (contentTypeConfig.deny.components && !Array.isArray(contentTypeConfig.deny.components)) {
            throw new Error(`plugin::deep-populate config.contentTypes.${uid}.deny.components must be an array`)
          }
        }
      }
    }
  },
}

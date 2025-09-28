import type { Config } from "@fourlights/strapi-plugin-deep-populate/dist/server/src/config/index"
import type { UID } from "@strapi/strapi"

export const allowCyclicContentType = (contentType: UID.ContentType): Partial<Config> => {
  return {
    contentTypes: {
      [contentType]: {
        allow: {
          relations: [contentType],
        },
      },
    },
  }
}

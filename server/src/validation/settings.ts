import { validateYupSchema, yup } from "@strapi/utils"

const settingsSchema = yup
  .object({
    useCache: yup.boolean(),
    replaceWildcard: yup.boolean(),
    omitEmpty: yup.boolean(),
    localizations: yup.boolean(),
    cacheOptions: yup.object({
      clearCacheOnStartup: yup.boolean(),
      warmOnWrite: yup.boolean(),
    }),
  })
  .noUnknown()

export const validateSettings = validateYupSchema(settingsSchema)

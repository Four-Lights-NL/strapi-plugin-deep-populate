import { klona } from "klona/json"

export default async ({ strapi }) => {
  strapi.documents.use(async (context, next) => {
    const { cachePopulate, augmentPopulateStar } = strapi.config.get("plugin::deep-populate")

    if (
      // do nothing if not configured
      (!cachePopulate && !augmentPopulateStar) ||
      context.uid === "plugin::deep-populate.cache"
    )
      return await next()

    const populateService = strapi.plugin("deep-populate").service("populate")
    const cacheService = strapi.plugin("deep-populate").service("cache")

    const { populate } = context.params
    const returnDeeplyPopulated = augmentPopulateStar && populate === "*"

    if (cachePopulate && context.action === "delete")
      await cacheService.clear({ ...context.params, contentType: context.uid })

    const originalFields = klona(context.fields)

    if (returnDeeplyPopulated && ["findOne", "findFirst", "findMany"].includes(context.action))
      context.fields = ["documentId", "status", "locale"]

    const result = await next()

    if (["create", "update"].includes(context.action)) {
      const { documentId, status, locale } = result

      if (cachePopulate && context.action === "update")
        await cacheService.clear({ ...context.params, contentType: context.uid })

      if (cachePopulate || returnDeeplyPopulated) {
        const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
        if (returnDeeplyPopulated)
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
      }
    }

    if (returnDeeplyPopulated && ["findOne", "findFirst"].includes(context.action)) {
      const { documentId, status, locale } = result
      const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
      return await strapi
        .documents(context.uid)
        .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
    }

    if (returnDeeplyPopulated && context.action === "findMany") {
      return await Promise.all(
        result.map(async ({ documentId, status, locale }) => {
          const deepPopulate = await populateService.get({ contentType: context.uid, documentId, status, locale })
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, status, locale, fields: originalFields, populate: deepPopulate })
        }),
      )
    }

    return result
  })
}

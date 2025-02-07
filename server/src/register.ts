import { klona } from "klona/json"

export default async ({ strapi }) => {
  strapi.documents.use(async (context, next) => {
    const { cachePopulate, augmentPopulateStar } = strapi.config.get("plugin::deep-populate")
    if (!cachePopulate && !augmentPopulateStar) return await next() // nothing to do
    if (context.uid === "plugin::deep-populate.cache") return await next() // don't cache the cache

    const { populate } = context.params
    const returnDeeplyPopulated = augmentPopulateStar && populate === "*"

    const { get: getDeepPopulate } = strapi.plugin("deep-populate").service("populate")

    if (cachePopulate && ["delete"].includes(context.action)) {
      const { documentId, locale, status } = context.params
      await strapi
        .plugin("deep-populate")
        .service("cache")
        .clear({ contentType: context.uid, documentId, locale, status })
    }

    const fields = klona(context.fields)

    if (returnDeeplyPopulated && ["findOne", "findFirst", "findMany"].includes(context.action)) {
      context.fields = ["documentId", "status", "locale"]
    }

    const result = await next()

    if (["create", "update"].includes(context.action)) {
      const { documentId, status, locale } = result
      if (context.action === "update" && cachePopulate) {
        // FIXME: Upsert the cache instead
        // TODO: Update dependent caches as well
        const { documentId, locale, status } = context.params
        await strapi
          .plugin("deep-populate")
          .service("cache")
          .clear({ contentType: context.uid, documentId, locale, status })
      }
      if (cachePopulate || returnDeeplyPopulated) {
        // if cache is enabled, getting the deep populate will fill the cache
        const deepPopulate = await getDeepPopulate({ contentType: context.uid, documentId, status, locale })
        if (returnDeeplyPopulated)
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, fields, status, locale, populate: deepPopulate })
      }
    }

    if (returnDeeplyPopulated && ["findOne", "findFirst"].includes(context.action)) {
      const { documentId, status, locale } = result
      const deepPopulate = await getDeepPopulate({ contentType: context.uid, documentId, status, locale })
      return await strapi.documents(context.uid).findOne({ documentId, fields, status, locale, populate: deepPopulate })
    }

    if (returnDeeplyPopulated && ["findMany"].includes(context.action)) {
      return await Promise.all(
        result.map(async ({ documentId, status, locale }) => {
          const deepPopulate = await getDeepPopulate({ contentType: context.uid, documentId, status, locale })
          return await strapi
            .documents(context.uid)
            .findOne({ documentId, fields, status, locale, populate: deepPopulate })
        }),
      )
    }

    return result
  })
}

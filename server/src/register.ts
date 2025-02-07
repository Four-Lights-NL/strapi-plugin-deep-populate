import { klona } from "klona/json"

export default async ({ strapi }) => {
  strapi.documents.use(async (context, next) => {
    const { augmentPopulateStar } = strapi.config.get("plugin::deep-populate")
    if (!augmentPopulateStar) return await next() // nothing to do

    const { populate } = context.params
    const returnDeeplyPopulated = augmentPopulateStar && populate === "*"

    const { get: getDeepPopulate } = strapi.plugin("deep-populate").service("populate")

    const fields = klona(context.fields)

    if (returnDeeplyPopulated && ["findOne", "findFirst", "findMany"].includes(context.action)) {
      context.fields = ["documentId", "status", "locale"]
    }

    const result = await next()

    if (["create", "update"].includes(context.action)) {
      const { documentId, status, locale } = result
      if (returnDeeplyPopulated) {
        const deepPopulate = await getDeepPopulate({ contentType: context.uid, documentId, status, locale })
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

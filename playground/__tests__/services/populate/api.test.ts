import type { Modules } from "@strapi/strapi"
import supertest from "supertest"
import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"
import type { UnwrapPromise } from "../../helpers/unwrapPromise"

describe("api", () => {
  let context: UnwrapPromise<ReturnType<typeof setupDocuments>>
  let jwt: string

  beforeAll(async () => {
    await setupStrapi()
    context = await setupDocuments()

    const apiTokenService = strapi.service("admin::api-token")
    const apiToken = await apiTokenService.create({
      name: "Full Access",
      description: "A default API token with full access permissions, used for accessing or modifying resources",
      type: "full-access",
      lifespan: null,
    })
    jwt = apiToken.accessKey
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  it("should return fully populated document from api with populate wildcard", async () => {
    const page = await supertest(strapi.server.httpServer)
      .get(`/api/pages/${context.page.documentId}`)
      .set("Authorization", `Bearer ${jwt}`)
      .query({ populate: "*", status: "draft" })
      .expect(200)

    const expected: Record<string, object> = {}
    expected.nestedSection = context.nestedSection
    expected.primarySection = {
      ...context.primarySection,
      sections: [expected.nestedSection],
    }
    expected.page = {
      ...context.page,
      sections: [expected.primarySection],
    }

    expect(page.body.data).toEqual(expected.page)
  })

  describe("simple content types", async () => {
    let expected: Modules.Documents.AnyDocument

    beforeAll(async () => {
      expected = await strapi.documents("api::static.static").create({
        data: { content: "A simple document" },
      })
      // Create returns locale filled, even if it's not part of the model
      expected.locale = undefined
    })

    it("should return simple content types without any problems", async () => {
      const person = await supertest(strapi.server.httpServer)
        .get(`/api/statics/${expected.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*" })
        .expect(200)

      expect(person.body.data).toEqual(expected)
    })

    it("should return cached simple content types without any problems", async () => {
      const simple = await supertest(strapi.server.httpServer)
        .get(`/api/statics/${expected.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*" })
        .expect(200)
      const cachedSimple = await supertest(strapi.server.httpServer)
        .get(`/api/statics/${expected.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*" })
        .expect(200)

      expect(simple.body.data).toEqual(expected)
      expect(cachedSimple.body.data).toEqual(expected)
    })
  })

  describe("bustCache parameter", () => {
    beforeEach(async () => {
      const cachedEntries = await strapi.documents("plugin::deep-populate.cache").findMany({})
      for (const entry of cachedEntries) {
        await strapi.documents("plugin::deep-populate.cache").delete({ documentId: entry.documentId })
      }
    })

    it("should use cached version when bustCache is not provided", async () => {
      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(0)

      // First request - should populate cache
      const firstResponse = await supertest(strapi.server.httpServer)
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      // check directly with strapi if the cache was filled
      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(1)
      const cacheOne = await strapi.documents("plugin::deep-populate.cache").findFirst({})

      // Second request - should use cache
      const secondResponse = await supertest(strapi.server.httpServer)
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      expect(firstResponse.body.data).toEqual(secondResponse.body.data)

      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(1)
      const cacheTwo = await strapi.documents("plugin::deep-populate.cache").findFirst({})
      expect(cacheOne.params).toEqual(cacheTwo.params)
    })

    it("should refresh cache when bustCache=true", async () => {
      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(0)

      // First request - populate cache
      await supertest(strapi.server.httpServer)
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      // check directly with strapi if the cache was filled
      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(1)
      const cacheOne = await strapi.documents("plugin::deep-populate.cache").findFirst({})

      // update the cached entry slightly to see if the return changes
      await strapi.documents("plugin::deep-populate.cache").update({
        documentId: cacheOne.documentId,
        data: { dependencies: "test" } as Partial<Modules.Documents.Params.Data.Input<"plugin::deep-populate.cache">>,
      })
      const cacheTwo = await strapi.documents("plugin::deep-populate.cache").findFirst({})
      expect(cacheOne.dependencies).not.toEqual(cacheTwo.dependencies)

      // Request with bustCache=true
      await supertest(strapi.server.httpServer)
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft", bustCache: true })
        .expect(200)

      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(1)
      const cacheThree = await strapi.documents("plugin::deep-populate.cache").findFirst({})
      expect(cacheOne.dependencies).toEqual(cacheThree.dependencies)
    })

    it("should bust cache for findMany operations", async () => {
      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(0)

      // First request - populate cache
      await supertest(strapi.server.httpServer)
        .get("/api/pages")
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      // check directly with strapi if the cache was filled
      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(1)
      const cacheOne = await strapi.documents("plugin::deep-populate.cache").findFirst({})

      // update the cached entry slightly to see if the return changes
      await strapi.documents("plugin::deep-populate.cache").update({
        documentId: cacheOne.documentId,
        data: { dependencies: "test" } as Partial<Modules.Documents.Params.Data.Input<"plugin::deep-populate.cache">>,
      })
      const cacheTwo = await strapi.documents("plugin::deep-populate.cache").findFirst({})
      expect(cacheOne.dependencies).not.toEqual(cacheTwo.dependencies)

      // Request with bustCache=true - should get fresh data for all pages
      await supertest(strapi.server.httpServer)
        .get("/api/pages")
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft", bustCache: true })
        .expect(200)

      expect(await strapi.documents("plugin::deep-populate.cache").count({ status: "draft" })).toBe(1)
      const cacheThree = await strapi.documents("plugin::deep-populate.cache").findFirst({})
      expect(cacheOne.dependencies).toEqual(cacheThree.dependencies)
    })
  })
})

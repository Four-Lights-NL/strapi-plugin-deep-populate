import type { Modules } from "@strapi/strapi"

import { createStatic, type StandardGraph, seedStandardGraph } from "@test/factories"
import { clearCache, fullAccessToken, request, resetDatabase, setupStrapi, strapi } from "@test/harness"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

const CACHE_UID = "plugin::deep-populate.cache"

describe("api", () => {
  let context: StandardGraph
  let jwt: string

  beforeAll(async () => {
    await setupStrapi()
    // Hermetic: this suite's `findMany` assertions count cache entries, so start
    // from a clean database rather than the data left by earlier suites.
    await resetDatabase()
    context = await seedStandardGraph()
    jwt = await fullAccessToken()
  })

  it("should return fully populated document from api with populate wildcard", async () => {
    const page = await request()
      .get(`/api/pages/${context.page.documentId}`)
      .set("Authorization", `Bearer ${jwt}`)
      .query({ populate: "*", status: "draft" })
      .expect(200)

    const expected: Record<string, object> = {}
    expected.nestedSection = context.nestedSection.doc
    expected.primarySection = {
      ...context.primarySection.doc,
      sections: [expected.nestedSection],
    }
    expected.page = {
      ...context.page.doc,
      sections: [expected.primarySection],
    }

    expect(page.body.data).toEqual(expected.page)
  })

  describe("simple content types", () => {
    let expected: Record<string, unknown>

    beforeAll(async () => {
      expected = (await createStatic({ content: "A simple document" })).doc
      // Create returns locale filled, even if it's not part of the model
      expected.locale = undefined
    })

    it("should return simple content types without any problems", async () => {
      const person = await request()
        .get(`/api/statics/${String(expected.documentId)}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*" })
        .expect(200)

      expect(person.body.data).toEqual(expected)
    })

    it("should return cached simple content types without any problems", async () => {
      const simple = await request()
        .get(`/api/statics/${String(expected.documentId)}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*" })
        .expect(200)
      const cachedSimple = await request()
        .get(`/api/statics/${String(expected.documentId)}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*" })
        .expect(200)

      expect(simple.body.data).toEqual(expected)
      expect(cachedSimple.body.data).toEqual(expected)
    })
  })

  describe("bustCache parameter", () => {
    beforeEach(async () => {
      await clearCache()
    })

    it("should use cached version when bustCache is not provided", async () => {
      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(0)

      const firstResponse = await request()
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(1)
      const cacheOne = await strapi.documents(CACHE_UID).findFirst({})

      const secondResponse = await request()
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      expect(firstResponse.body.data).toEqual(secondResponse.body.data)

      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(1)
      const cacheTwo = await strapi.documents(CACHE_UID).findFirst({})
      expect(cacheOne.params).toEqual(cacheTwo.params)
    })

    it("should refresh cache when bustCache=true", async () => {
      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(0)

      await request()
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(1)
      const cacheOne = await strapi.documents(CACHE_UID).findFirst({})

      await strapi.documents(CACHE_UID).update({
        documentId: cacheOne.documentId,
        data: { dependencies: "test" } as Partial<Modules.Documents.Params.Data.Input<typeof CACHE_UID>>,
      })
      const cacheTwo = await strapi.documents(CACHE_UID).findFirst({})
      expect(cacheOne.dependencies).not.toEqual(cacheTwo.dependencies)

      await request()
        .get(`/api/pages/${context.page.documentId}`)
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft", bustCache: true })
        .expect(200)

      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(1)
      const cacheThree = await strapi.documents(CACHE_UID).findFirst({})
      expect(cacheOne.dependencies).toEqual(cacheThree.dependencies)
    })

    it("should bust cache for findMany operations", async () => {
      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(0)

      await request()
        .get("/api/pages")
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft" })
        .expect(200)

      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(1)
      const cacheOne = await strapi.documents(CACHE_UID).findFirst({})

      await strapi.documents(CACHE_UID).update({
        documentId: cacheOne.documentId,
        data: { dependencies: "test" } as Partial<Modules.Documents.Params.Data.Input<typeof CACHE_UID>>,
      })
      const cacheTwo = await strapi.documents(CACHE_UID).findFirst({})
      expect(cacheOne.dependencies).not.toEqual(cacheTwo.dependencies)

      await request()
        .get("/api/pages")
        .set("Authorization", `Bearer ${jwt}`)
        .query({ populate: "*", status: "draft", bustCache: true })
        .expect(200)

      expect(await strapi.documents(CACHE_UID).count({ status: "draft" })).toBe(1)
      const cacheThree = await strapi.documents(CACHE_UID).findFirst({})
      expect(cacheOne.dependencies).toEqual(cacheThree.dependencies)
    })
  })
})

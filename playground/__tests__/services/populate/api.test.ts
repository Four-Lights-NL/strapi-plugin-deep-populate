import supertest from "supertest"
import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"
import type { UnwrapPromise } from "../../helpers/unwrapPromise"
import type { Modules } from "@strapi/strapi"

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
})

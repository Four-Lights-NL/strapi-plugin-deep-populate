import { setupStrapi, strapi, teardownStrapi } from "./helpers/strapi"

describe("global app", () => {
  beforeAll(async () => {
    await setupStrapi()
  })

  afterAll(async () => {
    await teardownStrapi()
  })

  test("strapi is defined", async () => {
    expect(strapi).toBeDefined()
  })
})

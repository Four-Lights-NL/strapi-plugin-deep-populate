import supertest from "supertest"

import { cleanImages, uploadImage } from "../../helpers/files"
import { setupDocuments } from "../../helpers/setupDocuments"
import { setupStrapi, strapi, teardownStrapi } from "../../helpers/strapi"

/**
 * Regression tests for https://github.com/Four-Lights-NL/strapi-plugin-deep-populate/issues/156
 *
 * Since Strapi 5.53.0 the content API sanitizes the `populate` query _with the request's auth_
 * (`sanitizeQuery` passes `auth` into `sanitizePopulate`, which runs `removeRestrictedRelations`).
 * That rewrites/removes relations before the document-service middleware runs:
 *   - morph relations have `true` expanded into a polymorphic `{ on: { <uid>: true } }` fragment
 *   - relations the auth cannot access are removed entirely
 *
 * The plugin used to compare the incoming populate against an auth-less expansion of `*`, so the
 * comparison no longer matched and `replaceWildcard` silently stopped deep-populating. These tests
 * exercise both mismatch triggers through the HTTP content API.
 */
describe("wildcard populate (issue #156)", () => {
  let context: Awaited<ReturnType<typeof setupDocuments>>
  let fullAccessToken: string
  let galleryDocumentId: string

  beforeAll(async () => {
    await setupStrapi()
    context = await setupDocuments()

    const image = await uploadImage(strapi)
    const gallery = await strapi.documents("api::gallery.gallery").create({
      data: {
        title: "gallery",
        cover: image,
        blocks: [
          {
            __component: "cms.slider",
            items: [{ image, enabled: true, link: { label: "link" } }],
          },
        ],
      },
    })
    galleryDocumentId = gallery.documentId
    // Publish so the document is also reachable by an unauthenticated (public) request.
    await strapi.documents("api::gallery.gallery").publish({ documentId: galleryDocumentId })

    const apiTokenService = strapi.service("admin::api-token")
    const fullAccess = await apiTokenService.create({
      name: "Full Access",
      type: "full-access",
      lifespan: null,
    })
    fullAccessToken = fullAccess.accessKey
  })

  afterAll(async () => {
    await cleanImages()
    await teardownStrapi()
  })

  const expectDeeplyPopulatedGallery = (data: Record<string, unknown>) => {
    const blocks = data.blocks as Array<Record<string, any>>

    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBeGreaterThan(0)

    // Before the fix a dynamic-zone entry only contains `{ id, __component }`.
    const slider = blocks[0]
    expect(slider).toHaveProperty("__component", "cms.slider")
    expect(Array.isArray(slider.items)).toBe(true)
    expect(slider.items.length).toBeGreaterThan(0)
    expect(slider.items[0]).toHaveProperty("enabled", true)
    expect(slider.items[0].image).toBeTruthy()
  }

  it("deep-populates a wildcard request with a full-access token despite a morph relation", async () => {
    const response = await supertest(strapi.server.httpServer)
      .get(`/api/galleries/${galleryDocumentId}`)
      .set("Authorization", `Bearer ${fullAccessToken}`)
      .query({ populate: "*", status: "draft" })
      .expect(200)

    expectDeeplyPopulatedGallery(response.body.data)
  })

  it("deep-populates a wildcard request from an unauthenticated (public) request", async () => {
    const publicRole = await strapi.db.query("plugin::users-permissions.role").findOne({
      where: { type: "public" },
    })
    for (const action of ["api::gallery.gallery.find", "api::gallery.gallery.findOne"]) {
      await strapi.db.query("plugin::users-permissions.permission").create({
        data: { action, role: publicRole.id },
      })
    }

    const response = await supertest(strapi.server.httpServer)
      .get(`/api/galleries/${galleryDocumentId}`)
      .query({ populate: "*" })
      .expect(200)

    expectDeeplyPopulatedGallery(response.body.data)
  })

  it("deep-populates a wildcard request with a token that is denied a relation", async () => {
    const apiTokenService = strapi.service("admin::api-token")
    const restricted = await apiTokenService.create({
      name: "Restricted",
      type: "custom",
      lifespan: null,
      // Has access to pages and sections, but NOT to users, so `page.members` is stripped by core.
      permissions: ["api::page.page.find", "api::page.page.findOne", "api::section.section.find", "api::section.section.findOne"],
    })

    const response = await supertest(strapi.server.httpServer)
      .get(`/api/pages/${context.page.documentId}`)
      .set("Authorization", `Bearer ${restricted.accessKey}`)
      .query({ populate: "*", status: "draft" })
      .expect(200)

    const sections = response.body.data.sections as Array<Record<string, any>>

    expect(Array.isArray(sections)).toBe(true)
    expect(sections.length).toBeGreaterThan(0)

    const blocks = sections[0].blocks as Array<Record<string, any>>
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.length).toBeGreaterThan(0)
    // Before the fix the dynamic-zone entry is a bare `{ id, __component }` stub.
    expect(blocks[0]).toHaveProperty("isCool", true)
  })
})

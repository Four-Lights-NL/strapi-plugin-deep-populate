import { strapi } from "@test/harness"

import { type Handle, makeHandle } from "./handle"
import { uniqueValue } from "./unique"

/**
 * Create an `api::gallery.gallery`. The gallery exists to exercise wildcard
 * populate against a morph (`morphToOne`) relation and a dynamic zone; the
 * required `title` is auto-filled unless supplied.
 */
export const createGallery = async (
  data: Record<string, unknown> = {},
  params: Record<string, unknown> = {},
): Promise<Handle> => {
  const title = (data.title as string) ?? uniqueValue("gallery")
  const doc = await strapi.documents("api::gallery.gallery").create({
    data: { title, ...data },
    ...params,
  })
  return makeHandle("api::gallery.gallery", doc as Record<string, unknown>)
}

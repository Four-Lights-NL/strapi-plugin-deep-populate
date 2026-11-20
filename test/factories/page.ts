import { strapi } from "@test/harness"

import { type Handle, makeHandle } from "./handle"
import { slugify, uniqueValue } from "./unique"

/**
 * Create an `api::page.page`. The required `slug` uid field (and a matching
 * `title`) are auto-filled from the global counter unless supplied.
 */
export const createPage = async (
  data: Record<string, unknown> = {},
  params: Record<string, unknown> = {},
): Promise<Handle> => {
  const title = (data.title as string) ?? uniqueValue("page")
  const slug = (data.slug as string) ?? slugify(title)
  const doc = await strapi.documents("api::page.page").create({
    data: { title, slug, ...data },
    ...params,
  })
  return makeHandle("api::page.page", doc as Record<string, unknown>)
}

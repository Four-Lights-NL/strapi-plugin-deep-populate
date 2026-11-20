import { strapi } from "@test/harness"

import { type Handle, makeHandle } from "./handle"

/**
 * Create an `api::static.static`, a content type with no relations: used to
 * prove pass-through behaviour.
 */
export const createStatic = async (
  data: Record<string, unknown> = {},
  params: Record<string, unknown> = {},
): Promise<Handle> => {
  const doc = await strapi.documents("api::static.static").create({ data, ...params })
  return makeHandle("api::static.static", doc as Record<string, unknown>)
}

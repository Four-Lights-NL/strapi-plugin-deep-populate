import { strapi } from "@test/harness"

import { type Handle, makeHandle } from "./handle"
import { uniqueValue } from "./unique"

/**
 * Create an `api::section.section`. The required, unique `name` is auto-filled
 * from the global counter unless supplied.
 */
export const createSection = async (
  data: Record<string, unknown> = {},
  params: Record<string, unknown> = {},
): Promise<Handle> => {
  const doc = await strapi.documents("api::section.section").create({
    data: { name: uniqueValue("section"), ...data },
    ...params,
  })
  return makeHandle("api::section.section", doc as Record<string, unknown>)
}

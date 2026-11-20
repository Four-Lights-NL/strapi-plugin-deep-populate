import type { UID } from "@strapi/strapi"

import { strapi } from "./strapi"

type ModelWithOptions = {
  pluginOptions?: Record<string, unknown>
  attributes?: Record<string, { pluginOptions?: Record<string, unknown> }>
}

const getModel = (uid: string): ModelWithOptions => strapi.getModel(uid as UID.Schema) as unknown as ModelWithOptions

const applyOption = (
  target: { pluginOptions?: Record<string, unknown> },
  options: Record<string, unknown> | undefined,
): { restore: () => void } => {
  const pluginOptions = { ...(target.pluginOptions ?? {}) }
  const hadOptions = Object.hasOwn(pluginOptions, "deep-populate")
  const previous = pluginOptions["deep-populate"]

  target.pluginOptions = pluginOptions
  if (options === undefined) delete pluginOptions["deep-populate"]
  else pluginOptions["deep-populate"] = options

  return {
    restore: () => {
      if (hadOptions) pluginOptions["deep-populate"] = previous
      else delete pluginOptions["deep-populate"]
    },
  }
}

/**
 * Temporarily set `pluginOptions["deep-populate"]` on a content type or component
 * model, restoring the previous value afterwards. Models are shared, booted
 * singletons, so the restore in `finally` is what keeps the mutation from leaking
 * into other suites of the shared worker.
 */
export const withSchemaOptions = async <T>(
  uid: string,
  options: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<T> => {
  const { restore } = applyOption(getModel(uid), options)
  try {
    return await fn()
  } finally {
    restore()
  }
}

/**
 * Temporarily set `pluginOptions["deep-populate"]` on a single attribute of a
 * model, restoring the previous value afterwards.
 */
export const withAttributeOptions = async <T>(
  uid: string,
  attribute: string,
  options: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<T> => {
  const model = getModel(uid)
  const attr = model.attributes?.[attribute]
  if (!attr) throw new Error(`Attribute "${attribute}" not found on "${uid}"`)

  const { restore } = applyOption(attr, options)
  try {
    return await fn()
  } finally {
    restore()
  }
}

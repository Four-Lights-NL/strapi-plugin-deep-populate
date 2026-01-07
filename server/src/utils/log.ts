import { name as pkgName } from "../../../package.json"

const f = (msg: string, context = undefined) => {
  const prefix = `[${pkgName}] `
  const suffix = context !== undefined ? `\n${prefix}${context}` : ""
  return `${prefix}${msg}${suffix}`
}

export const error = (msg: string, context = undefined) => strapi.log.error(f(msg, context))
export const warn = (msg: string, context = undefined) => strapi.log.warn(f(msg, context))
export const info = (msg: string, context = undefined) => strapi.log.info(f(msg, context))
export const debug = (msg: string, context = undefined) => strapi.log.debug(f(msg, context))

export default { error, warn, info, debug }

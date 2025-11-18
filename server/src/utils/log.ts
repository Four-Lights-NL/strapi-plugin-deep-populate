import { name as pkgName } from "../../../package.json"

export const error = (msg, context = undefined) => strapi.log.error(`[${pkgName}] ${msg}`, context)
export const warn = (msg, context = undefined) => strapi.log.warn(`[${pkgName}] ${msg}`, context)
export const info = (msg, context = undefined) => strapi.log.info(`[${pkgName}] ${msg}`, context)
export const debug = (msg, context = undefined) => strapi.log.debug(`[${pkgName}] ${msg}`, context)

export default { error, warn, info, debug }

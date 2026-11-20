import { createRequire } from "node:module"
import path from "node:path"

import type { Core } from "@strapi/strapi"

/**
 * The Strapi app directory and a `require` anchored inside it.
 *
 * Why not a plain `import ... from "@strapi/strapi"`? The tests now live at the
 * repo root, so a bare import would resolve Strapi from the root `node_modules`
 * (a newer/independent copy). The playground app, however, loads its plugins
 * from `playground/node_modules`, and only the Strapi copy in that tree can
 * resolve `@fourlights/strapi-plugin-deep-populate`. Booting the app with the
 * matching Strapi copy is what makes `createStrapi`/`compileStrapi` and the
 * app's plugin resolution consistent.
 */
export const appDir = path.resolve(process.cwd(), "playground")
export const distDir = path.join(appDir, "dist")
export const appRequire = createRequire(path.join(appDir, "package.json"))

const strapiRuntime = appRequire("@strapi/strapi") as typeof import("@strapi/strapi")

export const { compileStrapi, createStrapi } = strapiRuntime

/** The version of the Strapi copy the app actually runs on. */
export const strapiVersion = (appRequire("@strapi/strapi/package.json") as { version: string }).version

export type StrapiPlugin = {
  bootstrap?: (context: { strapi: Core.Strapi }) => unknown
}

/** Load the built plugin exactly the way the playground app does. */
export const loadPlugin = (): StrapiPlugin => {
  const mod = appRequire("@fourlights/strapi-plugin-deep-populate/strapi-server")
  return (mod.default ?? mod) as StrapiPlugin
}

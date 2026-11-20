import { beforeEach } from "vitest"

import { ensureConfigSpy, resetPluginConfig } from "./config"
import { strapi } from "./strapi"

// With a single shared worker (`isolate: false`), a config override set in one
// suite would leak into the next. Resetting before every test keeps suites
// independent without any suite ever touching the config spy's lifecycle.
//
// `restoreMocks` (integration/memory/coverage configs) restores every spy
// between tests, including the shared config spy, so it is re-installed here.
// The guard keeps this a no-op for unit tests, which never boot Strapi.
beforeEach(() => {
  resetPluginConfig()
  if (strapi) ensureConfigSpy()
})

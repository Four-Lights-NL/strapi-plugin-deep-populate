# Test harness

The plugin is tested against a real Strapi app booted from `playground/`. This
directory holds the harness (boot, config, fixtures) and three layers of tests:
**unit**, **integration** and **memory**. The admin (React) layer is tested
separately with a jsdom runner, see [Admin tests](#admin-tests).

## Layout

```
test/
  harness/        shared instance, config/settings override, db/request/upload/memory helpers
  factories/      typed document factories, component builders and presets
  unit/           Strapi-free unit tests (no boot)
  integration/    suites running against the shared Strapi instance
  memory/         opt-in memory-footprint suite
admin/src/**/*.test.tsx   admin component/page tests (vitest.admin.config.ts)
```

Tests import harness and factory code through the `@test/*` alias, e.g.
`import { setupStrapi, strapi } from "@test/harness"`.

## Running

Use Node 20–24 (the versions in the compatibility matrix). The native
`better-sqlite3` build fails on Node 26.

| Command | What it does |
| --- | --- |
| `npm run test:unit` | Unit tests only. Fast, no Strapi boot, no build needed. |
| `npm run test:integration` | Integration suites on the shared instance. Needs a build. |
| `npm run test:admin` | Admin component/page tests in jsdom (`vitest.admin.config.ts`). No Strapi boot. |
| `npm run test:coverage` | Unit + integration with v8 coverage over `server/src`. |
| `npm run test:memory` | Memory footprint suite (opt-in, needs the build, slow). |
| `npm test` | Pre-builds (`build:test`), typechecks (back + test + front), then unit + integration + admin. |
| `npm run typecheck` | `tsc` for the server sources, the test project and the admin sources. |

### Fast loop

`test:integration`, `test:memory` and `test:coverage` deliberately **do not**
pre-build. Build once, then iterate:

```bash
npm run build:test          # sourcemapped build, once
npx vitest --config test/vitest.integration.config.ts --watch
```

`npm test` and the CI gate are the only entry points that guarantee a fresh
sourcemapped build. The published build (`npm run build`) stays map-free; the
sourcemaps used here come from `build:test`
(`strapi-plugin build --sourcemap`).

## Shared instance lifecycle

Integration and memory tests run with **one shared Strapi instance**:

- `pool: "forks"`, `fileParallelism: false`, `isolate: false` → a single worker
  and shared module state.
- `setupStrapi()` in `harness/strapi.ts` is lazy and idempotent. The first
  suite that calls it compiles the playground and boots the app; every later
  suite gets the same instance. Suites call it in `beforeAll` and must not tear
  it down themselves.
- `harness/global-setup.ts` runs in the main process. It sets the env (telemetry
  off, temp dir, `DATABASE_FILENAME`) and removes the temp dir plus test uploads
  afterwards. It never boots Strapi.
- `teardownStrapi()` runs the shutdown sequence (node-schedule jobs → HTTP
  server → db) and always clears the instance reference. It is best-effort: it
  runs on `beforeExit` (e.g. watch mode), but Vitest force-exits workers in a
  normal run, so the durable cleanup is `global-setup.ts` removing the temp
  directory. The suite never relies on the shared instance being closed to pass.

Because the instance is shared, **per-test state must not leak**. The harness
handles config automatically (see below). Data is kept apart with unique values
from the factories; suites that assert global counts call `resetDatabase()` /
`clearCache()` first.

### Config overrides

Use `setPluginConfig(partial)` to override the plugin config for a test, and
never touch the config spy yourself:

```ts
setPluginConfig({ useCache: false, omitEmpty: true })
```

- `harness/setup.ts` registers `resetPluginConfig()` (and re-installs the spy)
  in `beforeEach`, so overrides never leak between tests.
- `setPluginConfig` can be called again inside a test to change the config
  between requests (e.g. toggling `omitEmpty` to exercise cache invalidation).
- There is exactly **one** `strapi.config.get` spy. It merges the override over
  the real plugin config and forwards `defaultValue` unchanged. Never call
  `mockRestore` on it.
- The configs enable `restoreMocks`, which restores every spy between tests;
  the setup hook re-installs the config spy before each test.

### Settings store

The runtime resolves global config as `store > config/plugins.js > defaults`,
where the store is the value edited through the admin settings page. Tests drive
it through `harness/settings.ts` instead of the config spy:

```ts
import { getSettings, getGlobal, setSettings } from "@test/harness"

await setSettings({ omitEmpty: true })   // persist a settings patch
getGlobal()                              // resolved global config (sync)
```

- `harness/setup.ts` calls `resetSettings()` in `beforeEach` (when Strapi is
  booted). A value left in the store by one suite ranks **above**
  `config/plugins.js`, so without the reset it would silently override the next
  suite's `setPluginConfig`.
- `resetSettings()` writes `{}` and then calls the service's `reset()` hook,
  which forgets the in-memory snapshot so the next `load()` re-reads the store.

Because config and settings are reset by the harness, a unit test that stubs
`globalThis.strapi` **must restore it per test** (not in `beforeAll`); otherwise
the harness's `beforeEach` would run its settings reset against the stub. See
`test/unit/deepPopulateUtils.test.ts`.

### Schema option overrides

To exercise the schema-level `pluginOptions['deep-populate']` resolution, wrap a
call in `withSchemaOptions` / `withAttributeOptions`:

```ts
await withSchemaOptions("api::section.section", { selfReferencing: false }, () =>
  populateService().get({ contentType, documentId }),
)
```

Both mutate the booted model's `pluginOptions` and restore the previous value in
`finally`, so nothing leaks into other suites.

## Factories

Factories eager-create documents and return a chainable `Handle`:

```ts
import { createSection, createPage, createStatic, connect } from "@test/factories"

const child = await createSection({ name: "child" })
const parent = await createSection({ sections: connect(child) })
const page = await createPage({ sections: [parent.documentId] })
```

A `Handle` exposes:

| Member | Description |
| --- | --- |
| `documentId` | The document's `documentId`. |
| `doc` | The raw document returned by the create/update call. |
| `connect()` | `{ connect: [documentId] }`, ready for a relation field. |
| `update(data, params?)` | Update and return a fresh handle. |
| `publish(params?)` | Publish and return a fresh handle. |
| `localize(locale, data?)` | Write a localization and return a fresh handle. |
| `refresh(params?)` | Re-read the document and return a fresh handle. |

Relations accept either a raw `documentId` or a `Handle` (`connect(ref)` /
`connect([refA, refB])`).

Required/unique fields are auto-filled from a global counter unless supplied:
`section.name`, `page.title` and `page.slug`. Passing `name`/`title`/`slug`
explicitly wins.

### Component builders

`components.ts` exports pure input builders: `special`, `coolComponent`,
`slider`, `sliderItem`, `link`, plus `asBlock(uid, data)` to wrap a builder as a
dynamic-zone entry. Builders never touch Strapi.

### Presets

- `seedStandardGraph(linkToPageId?)` reproduces the original fixture:
  page → primary section → nested section, with single/repeatable components and
  dynamic zones. Returns `{ page, primarySection, nestedSection }`.
- `pageWithLink(target?)` creates a page whose section links back to a target
  page, plus the shallow target document (used by the allow/deny tests).
- `deepChain(depth)` creates a linear section chain and returns the handles.
- `circularPair()` creates two sections that reference each other.

## Harness helpers

- `harness/request.ts`: `request()` (supertest against the shared HTTP server),
  `fullAccessToken()` (mints a full-access API token via the admin service) and
  `bearer(token)`.
- `harness/upload.ts`: `uploadImage(strapi)` uploads a tiny in-memory PNG (no
  fixture file, and it mirrors the `test-` prefix used by cleanup) and
  `cleanImages()` removes test uploads.
- `harness/db.ts`: `resetDatabase()` wipes app content types, components, link
  tables and the populate cache (Strapi's `strapi_`/`admin_`/`up_` tables are
  preserved), `clearCache()` and `countCache()`.
- `harness/settings.ts`: `settingsService()`, `getSettings()`, `getGlobal()`,
  `setSettings()` and `resetSettings()` wrap the plugin's settings service.
- `harness/schema.ts`: `withSchemaOptions(uid, options, fn)` and
  `withAttributeOptions(uid, attr, options, fn)` temporarily set schema-level
  `pluginOptions['deep-populate']` and restore it afterwards.
- `harness/memory.ts`: `trackFunction()` / `calculateStats()` used by the memory
  suite (requires `--expose-gc`, which the configs set).

## Suites ported from the stacked PRs

The harness re-expresses the tests that shipped with the stacked PRs so that
they run against the shared instance:

- `integration/wildcard.test.ts` (from #157): the `?populate=*` regression for
  issue #156 — full-access, public and denied-relation tokens through the HTTP
  API, plus a `findMany` case. Uses `factories/gallery.ts` (`api::gallery.gallery`)
  and `harness/upload.ts`.
- `integration/plugin-options.test.ts` (from #158): global settings, schema
  `pluginOptions` at every level, attribute allow/deny, `selfReferencing` and
  cache-fingerprint invalidation.
- `integration/settings.test.ts` (from #158): the settings service/controller —
  store persistence, partial merge, cache flush on re-enable, target listing and
  permission registration.

## Admin tests

Admin components/pages (`admin/src/**/*.test.tsx`) run through
`vitest.admin.config.ts` (jsdom + Testing Library) via `npm run test:admin`. They
do **not** use the integration harness: the harness boots with
`serveAdminPanel: false`, so the admin bundle is verified in isolation.

## Coverage

`test:coverage` runs the unit and integration suites in one worker and reports
v8 coverage for `server/src/**/*.ts`. The integration suites exercise the plugin
through the real app, but the app loads the plugin bundle with Node's native
module loader, outside Vite's module graph, so the v8 provider cannot attribute
most of that execution back to `server/src`. Coverage therefore comes mainly
from the unit layer; the thresholds in `vitest.coverage.config.ts` are set just
below the measured values so CI catches regressions without being noisy.

There was no usable pre-refactor baseline: the old suite ran against the
compiled playground bundle, which the v8 provider attributed as `0/391` lines in
`server/src`. After rebasing onto the stacked PR (#158), which grows
`server/src` by ~600–700 unattributable lines (settings store, admin
routes/controller, schema plugin options), the measured baseline is **24.28%
lines / 30.82% branches / 28.69% functions / 24.66% statements**. The unit tests
for the new pure config helpers (`isPlainObject`, `parseSchemaPluginOptions`,
`parseAttributePluginOptions`, `parseGlobalSettings`, `parseCacheOptions`,
`resolveGlobalConfig`) carry most of the added attributable surface. The
thresholds in `vitest.coverage.config.ts` are set ~1.6 points below the measured
values so CI catches regressions without being noisy.

## CI

- `.github/workflows/validate.yaml` is the PR gate: prepare → build → verify →
  install playground → typecheck → sourcemapped build → `test:coverage` →
  `test:admin` → upload coverage → biome. The memory suite is **not** part of the
  gate.
- `.github/workflows/compatibility.yaml` runs weekly and on demand, with an
  explicit `include` matrix: Node 20 + the Strapi floor (`5.31.0`), Node 20 at
  the wildcard-fix boundaries (`5.52.3`, `5.61.0`), and Node 20/22/24 + latest
  Strapi, with the memory suite on the Node 24 latest leg.

### Version injection

The harness boots the app with the Strapi copy in `playground/node_modules`
(see `harness/runtime.ts`), so version injection must rewrite **both** trees:
the root devDependencies (`@strapi/strapi`, `@strapi/utils`,
`@strapi/database`, `@strapi/typescript-utils`, and `@strapi/admin` — the admin
bundle needs it) and the playground dependencies (`@strapi/strapi`,
`@strapi/plugin-users-permissions`). This is CI-only and is never committed.

The compatibility job resolves `latest` to an exact version and passes it to the
integration run as `EXPECTED_STRAPI_VERSION`; `test/integration/app.test.ts`
asserts the app that actually booted runs that version. The current floor leg
uses `5.31.0`, the version declared in `devDependencies`; if it fails, raise the
floor in `package.json` (and the peerDependency) and update the matrix.

## Documented bugs

Known defects are characterised rather than fixed:

- `isUniqueConstraintError` compares driver `code`s against
  `Object.keys(UniqueConstraintErrorCodes)` (the constant names) instead of
  `Object.values(...)`. There is an `it.todo` for it in
  `test/unit/isUniqueConstraintError.test.ts`.
- `majorMinorVersion` (the populate cache namespace) strips only the package
  version's last dot-segment, so a prerelease such as `1.17.2-beta.0` yields
  `1.17.2-beta` rather than `1.17`. #160 is test-only and the runtime is owned by
  the stack, so the util is characterised rather than changed;
  `test/unit/version.test.ts` asserts the actual contract.

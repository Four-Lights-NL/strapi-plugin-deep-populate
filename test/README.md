# Test harness

The plugin is tested against a real Strapi app booted from `playground/`. This
directory holds the harness (boot, config, fixtures) and three layers of tests:
**unit**, **integration** and **memory**.

## Layout

```
test/
  harness/        shared instance, config override, db/request/upload/memory helpers
  factories/      typed document factories, component builders and presets
  unit/           Strapi-free unit tests (no boot)
  integration/    suites running against the shared Strapi instance
  memory/         opt-in memory-footprint suite
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
| `npm run test:coverage` | Unit + integration with v8 coverage over `server/src`. |
| `npm run test:memory` | Memory footprint suite (opt-in, needs the build, slow). |
| `npm test` | Pre-builds (`build:test`), typechecks, then unit + integration. |
| `npm run typecheck` | `tsc` for the server sources and for the test project. |

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
- `harness/memory.ts`: `trackFunction()` / `calculateStats()` used by the memory
  suite (requires `--expose-gc`, which the configs set).

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
`server/src`. The measured baseline for the new run is **19.69% lines / 25.66%
branches / 24.63% functions / 19.76% statements**, and the thresholds are set
just below those numbers. This is the documented fallback from the plan
(thresholds on the unit-observable surface).

## CI

- `.github/workflows/validate.yaml` is the PR gate: prepare → build → verify →
  install playground → typecheck → sourcemapped build → `test:coverage` → upload
  coverage → biome. The memory suite is **not** part of the gate.
- `.github/workflows/compatibility.yaml` runs weekly and on demand, with an
  explicit `include` matrix: Node 20 + the Strapi floor, Node 20/22/24 + latest
  Strapi, and the memory suite on the Node 24 latest leg.

### Version injection

The harness boots the app with the Strapi copy in `playground/node_modules`
(see `harness/runtime.ts`), so version injection must rewrite **both** trees:
the root devDependencies (`@strapi/strapi`, `@strapi/utils`,
`@strapi/database`, `@strapi/typescript-utils`) and the playground dependencies
(`@strapi/strapi`, `@strapi/plugin-users-permissions`). This is CI-only and is
never committed.

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

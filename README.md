# Strapi v5 Deep Populate Plugin

[![npm version](https://badge.fury.io/js/@fourlights%2Fstrapi-plugin-deep-populate.svg)](https://badge.fury.io/js/@fourlights%2Fstrapi-plugin-deep-populate)

A Strapi v5 plugin that automatically populates all nested relations in a single request using `populate: '*'`.
It does not impose a limit on the level of nesting and can cache the populate object for improved performance.

## Features

- Automatically resolves and populates all nested relations
- Supports all relation types including dynamic zones
- Handles circular references and edge cases
- Includes caching for improved performance
- Honors `populateCreatorFields` setting
- Supports optional allow/deny lists for specific relations or components during population
- Configurable globally from the admin settings page, per content type/component/attribute through `pluginOptions`, and from `config/plugins.js`
- Provides a `selfReferencing` escape hatch for deeply self-referential schemas

## Installation

```bash
npm install @fourlights/strapi-plugin-deep-populate
```

## Usage

Enable deep population in your Strapi config:

```js
// config/plugins.js
module.exports = ({ env }) => ({
  'deep-populate': {
    enabled: true,
    config: {
      useCache: true, // default
      replaceWildcard: true, // default
    }
  }
});
```

### Basic Usage

```ts
// Get fully populated document
const document = await strapi.documents("api.page.page").findOne({
  documentId: 'xyz',
  populate: '*'
});
```

### Advanced Usage

```ts
// Get populate object for custom usage
const populate = await strapi.plugin("deep-populate")
  .service("populate")
  .get({
    documentId: 'xyz',
    contentType: 'api::page.page',
    omitEmpty: true // optional
  });

const document = await strapi.documents('api::page.page').findOne({
  documentId: 'xyz',
  populate
});
```

### Admin Settings

Open **Settings → Deep Populate** in the admin panel to configure the global defaults
without redeploying. Values saved there take precedence over `config/plugins.js`:

- **Use cache** – persist resolved populate objects in the database
- **Replace wildcard populate** – turn `populate: '*'` into a deep populate
- **Omit empty relations** – leave relations without a value out of the populate object
- **Include localizations** – populate `localizations` for i18n-enabled content types
- **Clear cache on startup** / **Warm cache on write** – cache maintenance options

The settings page is protected by the `plugin::deep-populate.settings.access`
permission, which can be assigned to roles like any other Strapi permission.

### omitEmpty and localizations

The plugin provides fine-grained control over which attributes are included in the populate object through `omitEmpty` and `localizations` options.

#### Global Configuration

Set default behavior for all content types:

```js
// config/plugins.js
module.exports = ({ env }) => ({
  'deep-populate': {
    enabled: true,
    config: {
      useCache: true,
      replaceWildcard: true,
      omitEmpty: true, // Omit empty attributes by default
      localizations: false, // Exclude localizations by default
    }
  }
});
```

#### Content-Type Specific Configuration

Override global settings for specific content types:

```js
// config/plugins.js
module.exports = ({ env }) => ({
  'deep-populate': {
    enabled: true,
    config: {
      useCache: true,
      replaceWildcard: true,
      omitEmpty: true,
      localizations: false,
      
      contentTypes: {
        'api::page.page': {
          omitEmpty: false, // Include all attributes for pages
          localizations: true, // Always include localizations for pages
        },
        'api::blog-post.blog-post': {
          omitEmpty: true, // Explicitly omit empty attributes
          localizations: true, // But include localizations for blog posts
        }
      }
    }
  }
});
```

#### Function Parameter Configuration

Override both global and content-type settings per request:

```ts
// Get populate object with custom settings
const populate = await strapi.plugin("deep-populate")
  .service("populate")
  .get({
    documentId: 'xyz',
    contentType: 'api::page.page',
    omitEmpty: true, // Override content-type setting
    localizations: false // Override content-type setting
  });
```

#### Schema options (`pluginOptions`)

Instead of (or in addition to) `config/plugins.js`, you can configure a content
type or component from its schema. The options are resolved for every schema at
every level of the traversal:

```json
{
  "pluginOptions": {
    "deep-populate": {
      "omitEmpty": true,
      "localizations": true,
      "selfReferencing": true,
      "allow": { "relations": ["api::page.page"] },
      "deny": { "components": ["shared.link"] }
    }
  }
}
```

Content types support `omitEmpty`, `localizations`, `selfReferencing`, `allow`
and `deny`. Components support `selfReferencing`, `allow` and `deny`.

On a relation, component or dynamic zone attribute, `allow` and `deny` are
scoped to that attribute's subtree. The attribute's own target is always
included; the options only decide how deep the plugin keeps traversing below it:

```json
{
  "page": {
    "type": "relation",
    "relation": "oneToOne",
    "target": "api::page.page",
    "pluginOptions": {
      "deep-populate": {
        "deny": { "relations": ["api::page.page"] }
      }
    }
  }
}
```

`selfReferencing` controls how the circular-reference breaker treats the
schema:

- unset – keep the default breaker
- `true` – keep traversing self-referential relations, including indirect
  self-references through components and dynamic zones (documentId cycle
  detection remains the backstop)
- `false` – stop self-referential relations after one level

#### Override Priority

`omitEmpty` and `localizations` are applied in the following priority order
(highest to lowest):
1. **Function parameters** - Passed directly to the `get()` method
2. **Schema `pluginOptions`** - The content type/component schema at the current level
3. **Content-type configuration** - `config/plugins.js` (`contentTypes[uid]`)
4. **Wildcard configuration** - `config/plugins.js` (`contentTypes['*']`)
5. **Admin settings** - Settings saved in the admin panel
6. **Plugin configuration** - `config/plugins.js` global values
7. **Built-in defaults** - `useCache: true`, `replaceWildcard: true`

For `allow` and `deny`, the highest-priority source that defines them wins at
each level, and an attribute's own lists are applied on top for its subtree.

#### Special Behavior

- When `localizations: true`, the localizations field will be included even if `omitEmpty: true`
- When `localizations: false`, localizations are excluded regardless of the `omitEmpty` setting
- The `localizations` option only affects content types that have i18n enabled

### Caching

The plugin caches populate objects to improve performance. Cache can be disabled
via the `useCache` setting.  Cache entires are persisted in the database and can
become stale after content-type updates. You can use the `cacheOptions >
clearCacheOnStartup` to force cache purging on server start.

#### Cache Configuration

```js
// config/plugins.js
module.exports = ({ env }) => ({
  'deep-populate': {
    enabled: true,
    config: {
      useCache: true, // Enable caching (default: true)
      cacheOptions: {
        clearCacheOnStartup: false, // Clear cache on server startup (default: false)
        warmOnWrite: false, // Re-warm cache synchronously after writes; NOTE: can be slow (default: false)
      }
    }
  }
});
```

### Creator Fields

The plugin automatically populates `createdBy` and `updatedBy` fields when `populateCreatorFields` is enabled in the content-type configuration.

### Allow / Deny Lists

Sometimes you may want to restrict the nested population of certain relations or components. For example if you have a `Page` contentType where a deeply nested `Link` component has a relation to another `Page`.
In those situations you can use the allow or deny lists to control where the plugin should stop resolving nested relations.

```ts
// config/plugins.js
module.exports = ({ env }) => ({
  'deep-populate': {
    enabled: true,
    config: {
      useCache: true,
      replaceWildcard: true,
      
      contentTypes: {
        // '*' would apply to all content types
        'api::page.page': {
          deny: {
            relations: ['api::page.page']  // prevent resolving nested pages when populating a page
            // alternatively we could have denied the link component in this case
            // components: ['shared.link']
          }
        }
      }
    }
  }
});
```

The same `allow`/`deny` lists can be set on individual relation, component and
dynamic zone attributes through their `pluginOptions`, where they only affect
that attribute's subtree. A wildcard (`'*'`) entry is inherited as the base for
all content types. See [Schema options](#schema-options-pluginoptions) above.
---

## How The Plugin Works

The plugin recursively:
1. Traverses the content-type schema
2. Retrieves documents with one-level deep populate
3. Resolves all nested relations
4. Returns a complete populate object

This process handles all relation types including dynamic zones and circular references.

----

## Troubleshooting

Due to the dynamic nature of Strapi, stuff becomes complex pretty quickly and it can sometimes become tricky to see the proverbial forest through the trees.
In that case, feel free to open up an issue and I'll try to help you out.

But first, make sure you:

1. use the latest version of the plugin
2. use the latest version of Strapi
3. see if disabling the cache fixes the problem
4. check if your content-types are still valid, e.g. no dynamic zones who reference deleted components etc.
5. check you don't have attributes/relations marked as private if you expect them in the API response

If that didn't fix it, open up that issue! Make sure you report the used versions (plugin & strapi) and preferably share the affected content-type definitions. Or even better, a reproduction of the problem.

----

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Four-Lights-NL/strapi-plugin-deep-populate&type=date&legend=top-left)](https://www.star-history.com/#Four-Lights-NL/strapi-plugin-deep-populate&type=date&legend=top-left)

Thanks for reading and using the plugin. If you like it, consider starring it to give me a nice little dopamine hit next time I'm working on it.

### Built with ☕ in [Deventer, NL](https://en.wikipedia.org/wiki/Deventer).

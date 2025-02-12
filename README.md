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

### Caching

The plugin caches populate objects to improve performance. Cache can be disabled via the `useCache` setting.

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
---

## How The Plugin Works

The plugin recursively:
1. Traverses the content-type schema
2. Retrieves documents with one-level deep populate
3. Resolves all nested relations
4. Returns a complete populate object

This process handles all relation types including dynamic zones and circular references.

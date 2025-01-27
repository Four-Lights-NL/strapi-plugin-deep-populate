# @fourlights/strapi-plugin-deep-populate

[![npm version](https://badge.fury.io/js/@fourlights%2Fstrapi-plugin-deep-populate.svg)](https://badge.fury.io/js/@fourlights%2Fstrapi-plugin-deep-populate)

This Strapi v5 plugin provides a simple way of retrieving all nested objects in a single request.
It does this by traversing the schema and comparing that to the actual retrieved document(s).
Only relations that are actually set will be populated.

## Usage

```ts
// Option 1: get the populate object and use where you see fit
const populate = await strapi.plugin("deep-populate").service("populate").get({ documentId: 'xyz', contentType: 'api::page.page' })
const document = strapi.documents('api::page.page').findOne({ documentId: 'xyz', populate })
```
```ts
// Option 2: use the `findOne` method that wraps around documentService.findOne
const { findOne } = strapi.plugin("deep-populate").service("populate").documents("api::page.page")
const document = await findOne({ documentId: 'xyz' })
```

```ts
// Using the wrapped FindOne provides some handy features:

// Allow you to override the populate this way:
const documentWithCreatedBy = findOne({ documentId: 'xyz', populate: ['createdBy']})
const documentWithoutSection = findOne({ documentId: 'xyz', populate: { section: false }})

// And if you supply a `*` as populate, it will return a fully populated document (i.e. non-sparse)
const sparseDocument = findOne({ documentId: 'xyz' }) // sparse, so only attributes are returned that have a value
const fullDocument = findOne({ documentId: 'xyz', populate: '*' })   // fully populated, so all attributes are returned
```

### populateCreatorFields

The plugin honors the `populateCreatorFields`<a href="#fn1"><sup>[1]</sup></a> parameter at the content-type level. When set to true, the `createdBy` and `updatedBy` fields will be populated automatically.

<sup id="fn1">[1]</sup>: https://docs.strapi.io/dev-docs/api/rest/guides/populate-creator-fields


---

## When should you use this?

There are multiple arguments on why Strapi does not populate nested relations itself and requires you to explicitly state the population scheme:

- it's quicker and consumes less resources
- you don't accidentally expose too much data
- ... (add your own here, there are probably more)

However, in some data schemes (see the playground for an example), you don't know beforehand the relations that are going to be nested. This then requires you to implement some form of recursion to get the nested relations. That's where this plugin can be used so you don't have to think about it.

## How does it work

In short: it recursively resolves the content type schema for each attribute and queries the database to see if there is any value set.

A bit longer: You provide it with a documentId and a content type. It then recursively traverses the schema, retrieves the actual document with one-level deep populate and keeps doing this until all relations are resolved. Then it returns the full populate object that you can use to retrieve all relations in one go for that specific document.
It takes care of some edge cases (e.g. circular relations) and works for all types of relations, most notably the dynamic zone (which has a different format to populate in Strapi).

## Planned features

The following features are planned:

- Cache the populate object for a documentId/content-type combo and its latest changes to prevent having to parse the schema every time
- Invalidate said cache using db lifecycle hooks

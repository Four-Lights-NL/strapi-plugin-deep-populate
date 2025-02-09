export default {
  kind: "collectionType",
  collectionName: "caches",
  info: {
    singularName: "cache",
    pluralName: "caches",
    displayName: "Cache",
    description: "Holds cached deep populate object",
  },
  options: {},
  pluginOptions: {
    "content-manager": {
      visible: false,
    },
    "content-type-builder": {
      visible: false,
    },
  },
  attributes: {
    hash: {
      type: "string",
      configurable: false,
      required: true,
    },
    params: {
      type: "json",
      configurable: false,
      required: true,
    },
    populate: {
      type: "json",
      configurable: false,
    },
    dependencies: { type: "string", configurable: false },
  },
  // experimental feature:
  indexes: [
    {
      name: "deep-populate_cache_hash_index",
      columns: ["hash"],
      type: "unique",
    },
    {
      name: "deep-populate_cache_dependencies_index",
      columns: ["dependencies"],
      type: "fulltext",
    },
  ],
}

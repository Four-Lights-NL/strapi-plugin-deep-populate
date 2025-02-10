export default {
  kind: "collectionType",
  collectionName: "populate_cache",
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
    dependencies: { type: "text", configurable: false },
  },
  // experimental feature:
  indexes: [
    {
      name: "caches_hash_idx",
      columns: ["hash"],
      type: "unique",
    },
  ],
}

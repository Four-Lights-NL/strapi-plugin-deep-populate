import type { Database } from "@strapi/database"

export async function hasDeepPopulateCacheFullTextIndex(db: Database, tableName: string, columnName: string) {
  const knex = db.connection
  const client = db.dialect.client

  if (client === "sqlite") {
    return (await db.dialect.schemaInspector.getTables()).includes(`${tableName}_fts`)
  }
  if (client === "mysql" || client === "mysql2") {
    return (
      (await db.dialect.schemaInspector.getIndexes(tableName)).find(
        ({ name }) => name === `${tableName}_${columnName}_fulltext`,
      ) !== undefined
    )
  }
  if (client === "pg" || client === "postgres") {
    const result = await knex.raw(
      `SELECT * FROM pg_indexes WHERE tablename = '${tableName}' AND indexname = '${tableName}_${columnName}_gin'`,
    )
    return result.rows.length > 0
  }
  console.log(`Full-text index not supported for this database engine (${client})`)
  return false
}

export async function addDeepPopulateCacheFullTextIndex(db: Database, tableName: string, columnName: string) {
  const knex = db.connection

  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(tableName, columnName)
  if (!hasColumn) return

  const client = db.dialect.client
  if (client === "sqlite") {
    // SQLite supports full-text indexes using FTS extension
    await knex.raw(`CREATE VIRTUAL TABLE ${tableName}_fts USING fts3(${columnName})`)
    await knex.raw(`INSERT INTO ${tableName}_fts (${columnName}) SELECT ${columnName} FROM ${tableName}`)
  } else if (client === "mysql" || client === "mysql2") {
    // MySQL supports full-text indexes
    await knex.raw(`ALTER TABLE ${tableName} ADD FULLTEXT INDEX ${tableName}_${columnName}_fulltext (${columnName})`)
  } else if (client === "pg" || client === "postgres") {
    // PostgreSQL supports GIN indexes for full-text search
    await knex.raw(
      `CREATE INDEX ${tableName}_${columnName}_gin ON ${tableName} USING GIN (to_tsvector('english', ${columnName}))`,
    )
  } else {
    console.log(`Full-text index not supported for this database engine (${client})`)
  }
}

export async function removeDeepPopulateCacheFullTextIndex(db: Database, tableName: string, columnName: string) {
  const knex = db.connection

  const hasTable = await knex.schema.hasTable(tableName)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(tableName, columnName)
  if (!hasColumn) return

  const client = db.dialect.client

  if (client === "sqlite") {
    await knex.raw(`DROP TABLE ${tableName}_fts`)
  } else if (client === "mysql" || client === "mysql2") {
    await knex.raw(`ALTER TABLE ${tableName} DROP INDEX ${tableName}_${columnName}_fulltext`)
  } else if (client === "pg" || client === "postgres") {
    await knex.raw(`DROP INDEX ${tableName}_${columnName}_gin`)
  } else {
    console.log(`Full-text index not supported for this database engine (${client})`)
  }
}

const UniqueConstraintErrorCodes = {
  // PostgreSQL
  POSTGRES_UNIQUE_VIOLATION: "23505",

  // MySQL
  MYSQL_DUPLICATE_ENTRY: 1062,

  // SQLite
  SQLITE_CONSTRAINT: 19,
  SQLITE_CONSTRAINT_UNIQUE: 2067,

  // SQL Server
  SQLSERVER_DUPLICATE_KEY: 2601,
  SQLSERVER_UNIQUE_KEY_VIOLATION: 2627,
} as const

export const isUniqueConstraintError = (error: unknown): boolean => {
  const err = error as { code?: string; errno?: number; number?: number }

  return (
    Object.keys(UniqueConstraintErrorCodes).includes(err.code) ||
    err.code === UniqueConstraintErrorCodes.POSTGRES_UNIQUE_VIOLATION ||
    err.errno === UniqueConstraintErrorCodes.MYSQL_DUPLICATE_ENTRY ||
    err.errno === UniqueConstraintErrorCodes.SQLITE_CONSTRAINT ||
    err.errno === UniqueConstraintErrorCodes.SQLITE_CONSTRAINT_UNIQUE ||
    err.number === UniqueConstraintErrorCodes.SQLSERVER_DUPLICATE_KEY ||
    err.number === UniqueConstraintErrorCodes.SQLSERVER_UNIQUE_KEY_VIOLATION
  )
}

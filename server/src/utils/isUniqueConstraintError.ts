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
  const err = error as {
    code?: string
    errno?: number
    number?: number
    cause?: unknown
    originalError?: unknown
    parent?: unknown
  }
  const cause = (err.cause || err.originalError || err.parent || {}) as {
    code?: string
    errno?: number
    number?: number
  }

  const errno = err.errno ?? cause.errno
  const code = err.code ?? cause.code
  const number = err.number ?? cause.number

  return (
    Object.keys(UniqueConstraintErrorCodes).includes(code) ||
    code === UniqueConstraintErrorCodes.POSTGRES_UNIQUE_VIOLATION ||
    errno === UniqueConstraintErrorCodes.MYSQL_DUPLICATE_ENTRY ||
    errno === UniqueConstraintErrorCodes.SQLITE_CONSTRAINT ||
    errno === UniqueConstraintErrorCodes.SQLITE_CONSTRAINT_UNIQUE ||
    number === UniqueConstraintErrorCodes.SQLSERVER_DUPLICATE_KEY ||
    number === UniqueConstraintErrorCodes.SQLSERVER_UNIQUE_KEY_VIOLATION
  )
}

import path from 'node:path';

module.exports = ({ env }) => ({
  connection: {
    client: "sqlite",
    connection: {
      filename: env("DATABASE_FILENAME", path.resolve('.tmp/test.db')),
    },
    useNullAsDefault: true,
    debug: false,
  },
})

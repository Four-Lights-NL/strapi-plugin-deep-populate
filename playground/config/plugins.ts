import { randomBytes } from "node:crypto"

export default ({ env }) => ({
  "deep-populate": { enabled: true },
  "users-permissions": {
    config: {
      jwt: {
        jwtSecret: env("STRAPI_JWT_SECRET") || randomBytes(16).toString("base64"),
      },
    },
  },
})

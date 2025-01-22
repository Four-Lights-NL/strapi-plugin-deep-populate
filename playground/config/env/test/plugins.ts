import { randomBytes } from "node:crypto"

export default ({ env }) => ({
  "users-permissions": {
    config: {
      jwtSecret: env("JWT_SECRET", randomBytes(16).toString("base64")),
    },
  },
})

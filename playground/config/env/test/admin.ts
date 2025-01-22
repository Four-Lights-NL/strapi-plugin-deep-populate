import { randomBytes } from "node:crypto"

export default ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET", randomBytes(16).toString("base64")),
  },
  apiToken: {
    salt: env("API_TOKEN_SALT", randomBytes(16).toString("base64")),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT", randomBytes(16).toString("base64")),
    },
  },
  url: "/admin",
})

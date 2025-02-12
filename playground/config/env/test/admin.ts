import { randomBytes } from "node:crypto"

export default ({ env }) => ({
  auth: {
    secret: env("ADMIN_JWT_SECRET", "a1b2c3d4e5f6g7h8i9j0"),
  },
  apiToken: {
    salt: env("API_TOKEN_SALT", "a1b2c3d4e5f6g7h8i9j0"),
  },
  transfer: {
    token: {
      salt: env("TRANSFER_TOKEN_SALT", randomBytes(16).toString("base64")),
    },
  },
  url: "/admin",
})

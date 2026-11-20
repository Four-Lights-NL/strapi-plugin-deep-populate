import supertest from "supertest"

import { strapi } from "./strapi"

type ApiTokenService = {
  create: (data: Record<string, unknown>) => Promise<{ accessKey: string }>
}

/** A supertest agent bound to the shared instance's HTTP server. */
export const request = (): supertest.Agent => supertest(strapi.server.httpServer)

let tokenCounter = 0

/**
 * Mint a full-access API token and return its access key. Tokens are created
 * through the real `admin::api-token` service, exactly like the old suite.
 */
export const fullAccessToken = async (): Promise<string> => {
  const service = strapi.service("admin::api-token") as unknown as ApiTokenService
  tokenCounter += 1
  const token = await service.create({
    name: `Full Access ${tokenCounter}`,
    description: "Full access API token created by the test harness",
    type: "full-access",
    lifespan: null,
  })
  return token.accessKey
}

/** `Authorization` header value for a token. */
export const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` })

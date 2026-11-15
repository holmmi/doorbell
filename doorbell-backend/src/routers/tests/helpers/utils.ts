import { baseUrl } from './integration.js'

export const apiRequest = async (
  userId: string | undefined,
  method: string,
  path: string,
  body?: unknown,
  authorization?: string
) => {
  // The fixture must configure JWT_SECRET before loading the JWT module.
  const { createAccessToken } = await import('../../../utils/jwt.js')
  return fetch(new URL(`/api${path}`, baseUrl), {
    method,
    headers: {
      ...(userId === undefined
        ? {}
        : { Authorization: `Bearer ${createAccessToken(userId)}` }),
      ...(authorization === undefined ? {} : { Authorization: authorization }),
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  })
}

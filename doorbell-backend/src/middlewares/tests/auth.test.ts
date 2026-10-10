import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { Server } from 'node:http'
import { after, before, test } from 'node:test'

import express from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'

import { errorHandler } from '../errorHandler.js'
import { validateRequestBody } from '../validateRequest.js'
import { loginSchema } from '../../schemas/user.js'

const testJwtSecret = 'test-only-jwt-secret-for-authentication'
process.env.JWT_SECRET = testJwtSecret

const { authenticate } = await import('../authenticate.js')
const { createAccessToken } = await import('../../utils/jwt.js')

const app = express()
app.use(express.json())
app.post(
  '/__test/validation',
  validateRequestBody(loginSchema),
  (_request, response) => {
    response.sendStatus(204)
  }
)
app.get('/__test/auth', authenticate, (request, response) => {
  response.json(request.auth)
})
app.get('/__test/error', () => {
  throw new Error('private-internal-error')
})
app.use(errorHandler)

const userId = '9007199254740993'
const email = 'user@example.com'
const password = ' correct password with spaces '
let server: Server
let baseUrl: string

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

const validateBody = (body: unknown) =>
  fetch(`${baseUrl}/__test/validation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const authenticatedRequest = (authorization?: string) =>
  fetch(`${baseUrl}/__test/auth`, {
    headers:
      authorization === undefined ? {} : { Authorization: authorization },
  })

void test('access token expires after six hours and authenticates the same string ID', async () => {
  const token = createAccessToken(userId)
  const payload = jwt.verify(token, testJwtSecret, {
    algorithms: ['HS256'],
  })
  assert.ok(typeof payload !== 'string')
  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'sub'])
  assert.equal(payload.sub, userId)
  assert.ok(typeof payload.exp === 'number')
  assert.ok(typeof payload.iat === 'number')
  assert.equal(payload.exp - payload.iat, 6 * 60 * 60)

  const protectedResponse = await authenticatedRequest(`Bearer ${token}`)
  assert.equal(protectedResponse.status, 200)
  assert.deepEqual(await protectedResponse.json(), { userId })
})

const invalidBodies: [description: string, body: unknown][] = [
  ['absent body', undefined],
  ['empty object', {}],
  ['missing email', { password }],
  ['missing password', { email }],
  ['empty email', { email: '', password }],
  ['empty password', { email, password: '' }],
  ['invalid email', { email: 'invalid', password }],
  ['non-string email', { email: 123, password }],
  ['non-string password', { email, password: 123 }],
  ['array body', []],
  ['password over 72 bytes', { email, password: 'a'.repeat(73) }],
  ['UTF-8 password over 72 bytes', { email, password: '😀'.repeat(19) }],
]

for (const [description, body] of invalidBodies) {
  void test(`request validation rejects ${description}`, async () => {
    const response = await validateBody(body)
    assert.equal(response.status, 400)
    const responseBody: unknown = await response.json()
    assert.ok(
      typeof responseBody === 'object' &&
        responseBody !== null &&
        'errors' in responseBody
    )
    assert.ok(Array.isArray(responseBody.errors))
  })
}

void test('unexpected errors use the generic server error response', async (t) => {
  t.mock.method(console, 'error', () => {})

  const response = await fetch(`${baseUrl}/__test/error`)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'error.server.unexpected' })
})

for (const body of ['null', '{"email":']) {
  void test(`JSON parsing rejects ${body} without logging credentials`, async (t) => {
    const log = t.mock.method(console, 'error', () => {})
    const response = await fetch(`${baseUrl}/__test/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'error.request.invalid',
    })
    assert.equal(log.mock.callCount(), 0)
  })
}

const sign = (
  payload: Record<string, unknown>,
  options: SignOptions = {},
  secret = testJwtSecret
) =>
  jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: 60 * 60,
    ...options,
  })

const validToken = createAccessToken(userId)
const invalidAuthorization: [
  description: string,
  authorization: string | undefined,
][] = [
  ['missing header', undefined],
  ['wrong scheme', `Basic ${validToken}`],
  ['missing token', 'Bearer'],
  ['extra header parts', `Bearer ${validToken} extra`],
  ['malformed token', 'Bearer not-a-jwt'],
  ['tampered token', `Bearer ${validToken}changed`],
  ['wrong secret', `Bearer ${sign({}, { subject: userId }, 'another-secret')}`],
  ['expired token', `Bearer ${sign({}, { subject: userId, expiresIn: -1 })}`],
  ['future token', `Bearer ${sign({}, { subject: userId, notBefore: 60 })}`],
  [
    'wrong algorithm',
    `Bearer ${sign({}, { subject: userId, algorithm: 'HS384' })}`,
  ],
  [
    'unsigned token',
    `Bearer ${jwt.sign({}, '', { algorithm: 'none', subject: userId })}`,
  ],
  ['missing user ID', `Bearer ${sign({})}`],
  ['zero user ID', `Bearer ${sign({}, { subject: '0' })}`],
  ['invalid user ID', `Bearer ${sign({}, { subject: 'not-a-user-id' })}`],
  [
    'numeric user ID',
    `Bearer ${jwt.sign(
      JSON.stringify({ sub: 123, exp: Math.floor(Date.now() / 1000) + 60 }),
      testJwtSecret
    )}`,
  ],
  [
    'missing expiration',
    `Bearer ${jwt.sign({}, testJwtSecret, { subject: userId })}`,
  ],
  [
    'fractional expiration',
    `Bearer ${jwt.sign(
      { exp: Math.floor(Date.now() / 1000) + 60.5 },
      testJwtSecret,
      { subject: userId }
    )}`,
  ],
  ['string payload', `Bearer ${jwt.sign('user', testJwtSecret)}`],
]

for (const [description, authorization] of invalidAuthorization) {
  void test(`authentication rejects ${description}`, async () => {
    const response = await authenticatedRequest(authorization)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: 'error.authentication.unauthorized',
    })
  })
}

void test('authentication accepts a case-insensitive bearer scheme', async () => {
  const response = await authenticatedRequest(`bearer ${validToken}`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { userId })
})

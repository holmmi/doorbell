import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'
import { after, before, test } from 'node:test'

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

Object.assign(process.env, {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'doorbell_test',
  DB_USER: 'doorbell_test',
  DB_PASSWORD: 'test-only-password',
  JWT_SECRET: 'test-only-jwt-secret-for-authentication',
})

const { default: app } = await import('../src/app.ts')
const { pool } = await import('../src/config/database.ts')
const { authenticate } = await import('../src/middlewares/authenticate.ts')
const { createAccessToken } = await import('../src/utils/jwt.ts')

// Exercise downstream identity without adding a production endpoint.
app.get('/__test/auth', authenticate, (request, response) => {
  response.json(request.auth)
})

const userId = '9007199254740993'
const email = 'user@example.com'
const password = ' correct password with spaces '
let passwordHash
let server
let baseUrl

before(async () => {
  passwordHash = await bcrypt.hash(password, 12)
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  await pool.end()
})

const login = (body) =>
  fetch(`${baseUrl}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const authenticatedRequest = (authorization) =>
  fetch(`${baseUrl}/__test/auth`, {
    headers:
      authorization === undefined ? {} : { Authorization: authorization },
  })

test('login issues an expiring JWT that authenticates the same string ID', async (t) => {
  const query = t.mock.method(pool, 'query', async () => ({
    rows: [{ id: userId, passwordHash }],
  }))

  const response = await login({ email, password, userId: '123' })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(Object.keys(body), ['token'])
  assert.equal(typeof body.token, 'string')

  const payload = jwt.verify(body.token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
  })
  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'sub'])
  assert.equal(payload.sub, userId)
  assert.equal(payload.exp - payload.iat, 60 * 60)

  const [sql, values] = query.mock.calls[0].arguments
  assert.match(sql, /SELECT id, password AS "passwordHash"/)
  assert.match(sql, /WHERE email = \$1/)
  assert.deepEqual(values, [email])

  const protectedResponse = await authenticatedRequest(`Bearer ${body.token}`)
  assert.equal(protectedResponse.status, 200)
  assert.deepEqual(await protectedResponse.json(), { userId })
})

const invalidBodies = [
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
  test(`login rejects ${description} before querying the database`, async (t) => {
    const query = t.mock.method(pool, 'query', async () => ({ rows: [] }))
    const response = await login(body)
    assert.equal(response.status, 400)
    assert.ok(Array.isArray((await response.json()).errors))
    assert.equal(query.mock.callCount(), 0)
  })
}

test('unknown email and incorrect password have identical unauthorized responses', async (t) => {
  t.mock.method(pool, 'query', async (_sql, values) => ({
    rows: values[0] === email ? [{ id: userId, passwordHash }] : [],
  }))
  const compare = t.mock.method(bcrypt, 'compare')

  // Even matching the dummy hash must never authenticate an unknown user.
  const unknown = await login({
    email: 'unknown@example.com',
    password: 'dummy-login-password',
  })
  const incorrect = await login({ email, password: 'incorrect-password' })

  assert.equal(unknown.status, 401)
  assert.equal(incorrect.status, 401)
  const expected = { error: 'error.login.invalidCredentials' }
  assert.deepEqual(await unknown.json(), expected)
  assert.deepEqual(await incorrect.json(), expected)
  assert.equal(compare.mock.callCount(), 2)
  for (const call of compare.mock.calls) {
    assert.match(call.arguments[1], /^\$2b\$12\$/)
  }
})

test('database failures use the generic server error response', async (t) => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(pool, 'query', async () => {
    throw new Error('private-database-error')
  })

  const response = await login({ email, password })
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Internal server error' })
})

for (const body of ['null', '{"email":']) {
  test(`login rejects invalid JSON ${body} without logging credentials`, async (t) => {
    const query = t.mock.method(pool, 'query', async () => ({ rows: [] }))
    const log = t.mock.method(console, 'error', () => {})
    const response = await fetch(`${baseUrl}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'error.request.invalidJson',
    })
    assert.equal(query.mock.callCount(), 0)
    assert.equal(log.mock.callCount(), 0)
  })
}

const sign = (payload, options = {}, secret = process.env.JWT_SECRET) =>
  jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: 60 * 60,
    ...options,
  })

const validToken = createAccessToken(userId)
const invalidAuthorization = [
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
    'missing expiration',
    `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: userId })}`,
  ],
  ['string payload', `Bearer ${jwt.sign('user', process.env.JWT_SECRET)}`],
]

for (const [description, authorization] of invalidAuthorization) {
  test(`authentication rejects ${description}`, async () => {
    const response = await authenticatedRequest(authorization)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: 'error.authentication.unauthorized',
    })
  })
}

test('authentication accepts a case-insensitive bearer scheme', async () => {
  const response = await authenticatedRequest(`bearer ${validToken}`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { userId })
})

for (const role of ['TENANT', 'LANDLORD']) {
  test(`a newly registered ${role} can log in`, async (t) => {
    let registeredUser
    t.mock.method(pool, 'query', async (sql, values) => {
      if (sql.includes('SELECT EXISTS')) {
        return { rows: [{ exists: false }] }
      }
      if (sql.includes('INSERT INTO "user"')) {
        assert.equal(values[4], role)
        assert.notEqual(values[3], password)
        registeredUser = { id: userId, passwordHash: values[3] }
        return { rows: [{ id: userId }] }
      }
      assert.match(sql, /WHERE email = \$1/)
      assert.deepEqual(values, [email])
      return { rows: [registeredUser] }
    })

    const registration = await fetch(`${baseUrl}/api/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email,
        role,
        password,
      }),
    })
    assert.equal(registration.status, 201)

    const response = await login({ email, password })
    assert.equal(response.status, 200)
    const payload = jwt.verify(
      (await response.json()).token,
      process.env.JWT_SECRET
    )
    assert.equal(payload.sub, userId)
  })
}

for (const secret of [undefined, '', '   ']) {
  test(`JWT configuration rejects ${JSON.stringify(secret)} secrets`, () => {
    const env = { ...process.env, DOTENV_CONFIG_PATH: '__test_missing_env__' }
    if (secret === undefined) {
      delete env.JWT_SECRET
    } else {
      env.JWT_SECRET = secret
    }

    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        "await import('./src/config/auth.ts')",
      ],
      {
        cwd: path.resolve(import.meta.dirname, '..'),
        env,
        encoding: 'utf8',
      }
    )
    assert.notEqual(result.status, 0)
    assert.match(
      result.stderr,
      /Missing required environment variable: JWT_SECRET/
    )
  })
}

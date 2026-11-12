import assert from 'node:assert/strict'
import { once } from 'node:events'
import { request as httpRequest, type Server } from 'node:http'
import { after, before, test, type TestContext } from 'node:test'

import jwt from 'jsonwebtoken'
import type { QueryResult } from 'pg'

import type { UserInfo } from '../../types/user.js'

const testJwtSecret = 'test-only-jwt-secret-for-user-info'
Object.assign(process.env, {
  JWT_SECRET: testJwtSecret,
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_NAME: 'user_info_test',
  DB_USER: 'user_info_test',
  DB_PASSWORD: 'test-only-password',
  DB_SSL: 'false',
  DOTENV_CONFIG_PATH: '__test_missing_env__',
})

const { pool } = await import('../../config/database.js')
const { default: app } = await import('../../app.js')
const { createAccessToken } = await import('../../utils/jwt.js')

const tenant: UserInfo = {
  id: '9007199254740993',
  role: 'TENANT',
  firstName: 'Ada',
  lastName: 'Tenant',
  email: 'tenant@example.com',
  phone: null,
  picturePath: null,
}
const landlord: UserInfo = {
  id: '42',
  role: 'LANDLORD',
  firstName: 'Sam',
  lastName: 'Landlord',
  email: 'landlord@example.com',
  phone: '+358401234567',
  picturePath: 'profiles/42/avatar.png',
}
const unauthorized = { error: 'error.authentication.unauthorized' }
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
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  } finally {
    await pool.end()
  }
})

const stubUserLookup = (t: TestContext, users: UserInfo[]) =>
  t.mock.method(pool, 'query', (query: string, values: unknown[]) => {
    assert.match(query, /WHERE\s+id\s*=\s*\$1/)
    const rows = users.filter((user) => user.id === values[0])
    const result: QueryResult<UserInfo> = {
      command: 'SELECT',
      rowCount: rows.length,
      oid: 0,
      fields: [],
      rows,
    }
    return Promise.resolve(result)
  })

const getInfo = (authorization?: string, query = '') =>
  fetch(`${baseUrl}/api/user/info${query}`, {
    headers:
      authorization === undefined ? {} : { Authorization: authorization },
  })

const patchInfo = (
  body: unknown,
  authorization: string | undefined,
  query = ''
) =>
  fetch(`${baseUrl}/api/user/info${query}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization === undefined ? {} : { Authorization: authorization }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

for (const user of [tenant, landlord]) {
  void test(`profile updates return only public fields for a ${user.role}`, async (t) => {
    const changes = {
      firstName: "Ada's new name",
      lastName: 'Example',
      phone: '+358409999999',
      picturePath: 'profiles/new.png',
    }
    const updated = { ...user, ...changes }
    const query = t.mock.method(
      pool,
      'query',
      (sql: string, values: unknown[]) => {
        assert.match(sql, /UPDATE "user"/)
        assert.match(sql, /WHERE id = \$1/)
        assert.deepEqual(values, [user.id, ...Object.values(changes)])
        assert.ok(!sql.includes(changes.firstName))
        return Promise.resolve({
          rows: [{ ...updated, password: 'private', internalNote: 'private' }],
        })
      }
    )
    const response = await patchInfo(
      changes,
      `Bearer ${createAccessToken(user.id)}`
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), updated)
    assert.equal(query.mock.callCount(), 1)
  })
}

void test('profile updates strip protected fields and use only the token subject', async (t) => {
  const query = t.mock.method(
    pool,
    'query',
    (sql: string, values: unknown[]) => {
      assert.match(sql, /SET first_name = \$2\s+WHERE id = \$1/)
      assert.deepEqual(values, [tenant.id, 'Updated'])
      return Promise.resolve({ rows: [{ ...tenant, firstName: 'Updated' }] })
    }
  )
  const token = jwt.sign(
    { userId: landlord.id, role: landlord.role },
    testJwtSecret,
    { algorithm: 'HS256', subject: tenant.id, expiresIn: '1h' }
  )
  const response = await patchInfo(
    {
      firstName: 'Updated',
      id: landlord.id,
      userId: landlord.id,
      role: 'LANDLORD',
      email: 'other@example.com',
      password: 'changed-password',
      passwordHash: 'changed-hash',
      first_name: 'Ignored',
    },
    `Bearer ${token}`,
    `?id=${landlord.id}&userId=${landlord.id}`
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ...tenant, firstName: 'Updated' })
  assert.equal(query.mock.callCount(), 1)
})

for (const field of ['phone', 'picturePath'] as const) {
  void test(`profile updates can clear only ${field}`, async (t) => {
    const column = field === 'phone' ? 'phone' : 'picture_path'
    t.mock.method(pool, 'query', (sql: string, values: unknown[]) => {
      assert.ok(sql.includes(`SET ${column} = $2\n`))
      assert.deepEqual(values, [landlord.id, null])
      return Promise.resolve({ rows: [{ ...landlord, [field]: null }] })
    })
    const response = await patchInfo(
      { [field]: null },
      `Bearer ${createAccessToken(landlord.id)}`
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ...landlord, [field]: null })
  })
}

const invalidUpdates: [string, unknown][] = [
  ['missing body', undefined],
  ['empty object', {}],
  ['unknown fields only', { unknown: 'value' }],
  [
    'protected fields only',
    { id: '42', role: 'TENANT', email: 'a@b.com', password: 'password' },
  ],
  ['array', []],
  ...['firstName', 'lastName', 'phone', 'picturePath'].flatMap(
    (field): [string, unknown][] =>
      ['', 42, false, [], {}].map((value) => [
        `invalid ${field}: ${JSON.stringify(value)}`,
        { firstName: 'Valid', [field]: value },
      ])
  ),
  ['null first name', { firstName: null }],
  ['null last name', { lastName: null }],
]

for (const [description, body] of invalidUpdates) {
  void test(`profile updates reject ${description} with validation issues`, async (t) => {
    const query = stubUserLookup(t, [tenant])
    const response = await patchInfo(
      body,
      `Bearer ${createAccessToken(tenant.id)}`
    )
    const result = (await response.json()) as {
      errors: { code: string; path: unknown[]; message: string }[]
    }

    assert.equal(response.status, 400)
    assert.ok(result.errors.length > 0)
    for (const issue of result.errors) {
      assert.equal(typeof issue.code, 'string')
      assert.ok(Array.isArray(issue.path))
      assert.equal(typeof issue.message, 'string')
    }
    assert.equal(query.mock.callCount(), 0)
  })
}

for (const body of ['null', '"text"', '42', '{']) {
  void test(`profile updates reject invalid JSON body ${body}`, async (t) => {
    const query = stubUserLookup(t, [tenant])
    const response = await fetch(`${baseUrl}/api/user/info`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${createAccessToken(tenant.id)}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'error.request.invalid' })
    assert.equal(query.mock.callCount(), 0)
  })
}

for (const user of [tenant, landlord]) {
  void test(`user info returns the ${user.role} account with its stored profile values`, async (t) => {
    const query = stubUserLookup(t, [tenant, landlord])
    const response = await getInfo(`Bearer ${createAccessToken(user.id)}`)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), user)
    assert.equal(query.mock.callCount(), 1)
    assert.deepEqual(query.mock.calls[0].arguments[1], [user.id])
  })
}

void test('user info ignores another account ID in query parameters', async (t) => {
  const query = stubUserLookup(t, [tenant, landlord])
  const response = await getInfo(
    `Bearer ${createAccessToken(tenant.id)}`,
    `?id=${landlord.id}&userId=${landlord.id}`
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), tenant)
  assert.equal(query.mock.callCount(), 1)
  assert.deepEqual(query.mock.calls[0].arguments[1], [tenant.id])
})

void test('user info ignores another account ID in a GET request body', async (t) => {
  const query = stubUserLookup(t, [tenant, landlord])
  const body = JSON.stringify({ id: landlord.id, userId: landlord.id })
  const result = await new Promise<{
    status: number | undefined
    body: string
  }>((resolve, reject) => {
    const request = httpRequest(
      `${baseUrl}/api/user/info`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${createAccessToken(tenant.id)}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          responseBody += chunk
        })
        response.on('error', reject)
        response.on('end', () => {
          resolve({ status: response.statusCode, body: responseBody })
        })
      }
    )
    request.on('error', reject)
    request.end(body)
  })

  assert.equal(result.status, 200)
  assert.deepEqual(JSON.parse(result.body), tenant)
  assert.equal(query.mock.callCount(), 1)
  assert.deepEqual(query.mock.calls[0].arguments[1], [tenant.id])
})

void test('user info uses the token subject and current database profile instead of additional claims', async (t) => {
  const query = stubUserLookup(t, [tenant, landlord])
  const token = jwt.sign(
    { userId: landlord.id, role: landlord.role, email: 'stale@example.com' },
    testJwtSecret,
    { algorithm: 'HS256', subject: tenant.id, expiresIn: '1h' }
  )
  const response = await getInfo(`Bearer ${token}`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), tenant)
  assert.equal(query.mock.callCount(), 1)
  assert.deepEqual(query.mock.calls[0].arguments[1], [tenant.id])
})

const invalidAuthorization: [string, string | undefined][] = [
  ['missing credentials', undefined],
  ['malformed token', 'Bearer not-a-jwt'],
  [
    'invalid signature',
    `Bearer ${jwt.sign({}, 'another-secret', {
      algorithm: 'HS256',
      subject: tenant.id,
      expiresIn: '1h',
    })}`,
  ],
  [
    'expired token',
    `Bearer ${jwt.sign({}, testJwtSecret, {
      algorithm: 'HS256',
      subject: tenant.id,
      expiresIn: -1,
    })}`,
  ],
]

for (const [description, authorization] of invalidAuthorization) {
  void test(`profile updates reject ${description} without querying the database`, async (t) => {
    const query = stubUserLookup(t, [tenant, landlord])
    const response = await patchInfo({ firstName: 'Updated' }, authorization)

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), unauthorized)
    assert.equal(query.mock.callCount(), 0)
  })

  void test(`user info rejects ${description} without querying the database`, async (t) => {
    const query = stubUserLookup(t, [tenant, landlord])
    const response = await getInfo(authorization)

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), unauthorized)
    assert.equal(query.mock.callCount(), 0)
  })
}

void test('user info rejects a valid token for an account that no longer exists', async (t) => {
  const query = stubUserLookup(t, [])
  const response = await getInfo(`Bearer ${createAccessToken(tenant.id)}`)

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), unauthorized)
  assert.equal(query.mock.callCount(), 1)
  assert.deepEqual(query.mock.calls[0].arguments[1], [tenant.id])
})

void test('user info excludes passwords and internal properties from repository rows', async (t) => {
  const privateUser = {
    ...tenant,
    password: 'private-password-sentinel',
    passwordHash: 'private-hash-sentinel',
    internalNote: 'private-note-sentinel',
  }
  stubUserLookup(t, [privateUser])
  const response = await getInfo(`Bearer ${createAccessToken(tenant.id)}`)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), tenant)
})

void test('user info returns the generic server error when the database fails', async (t) => {
  t.mock.method(console, 'error', () => {})
  const query = t.mock.method(pool, 'query', () =>
    Promise.reject(new Error('private-database-error'))
  )
  const response = await getInfo(`Bearer ${createAccessToken(tenant.id)}`)

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'error.server.unexpected' })
  assert.equal(query.mock.callCount(), 1)
})

void test('profile updates reject a deleted account', async (t) => {
  const query = stubUserLookup(t, [])
  const response = await patchInfo(
    { firstName: 'Updated' },
    `Bearer ${createAccessToken(tenant.id)}`
  )

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), unauthorized)
  assert.equal(query.mock.callCount(), 1)
})

void test('profile updates return the generic server error when the database fails', async (t) => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(pool, 'query', () =>
    Promise.reject(new Error('private-database-error'))
  )
  const response = await patchInfo(
    { phone: null },
    `Bearer ${createAccessToken(tenant.id)}`
  )

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'error.server.unexpected' })
})

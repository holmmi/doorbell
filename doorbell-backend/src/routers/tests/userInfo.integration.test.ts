import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { describe, test } from 'node:test'

import jwt from 'jsonwebtoken'

import type { UserInfo, UserInfoResponse } from '../../types/user.js'
import { baseUrl, pool } from './helpers/integration.js'

const request = async (
  userId: string,
  method: string,
  body?: unknown,
  authorization?: string | null
) => {
  const { createAccessToken } = await import('../../utils/jwt.js')
  return fetch(new URL('/api/user/info?id=1&userId=1', baseUrl), {
    method,
    headers: {
      ...(authorization === null
        ? {}
        : {
            Authorization:
              authorization ?? `Bearer ${createAccessToken(userId)}`,
          }),
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  })
}

const storedUsers = async () =>
  (
    await pool.query<Record<string, unknown>>(
      'SELECT * FROM "user" ORDER BY id'
    )
  ).rows

const seedUser = async (role: UserInfo['role'] = 'TENANT') => {
  const user: UserInfoResponse = {
    id: '9007199254740993',
    role,
    firstName: 'Ada',
    lastName: 'Example',
    email: 'ada@example.com',
    phone: role === 'LANDLORD' ? '+358401234567' : null,
    pictureKey: role === 'LANDLORD' ? 'profiles/42/avatar.png' : null,
    pictureUrl: null,
  }
  await pool.query(
    `INSERT INTO "user" (id, first_name, last_name, email, password, role, phone, picture_key)
     VALUES ($1, $2, $3, $4, 'private-password-sentinel', $5, $6, $7)`,
    [
      user.id,
      user.firstName,
      user.lastName,
      user.email,
      role,
      user.phone,
      user.pictureKey,
    ]
  )
  return user
}

const invalidUpdates: [string, unknown][] = [
  ['missing body', undefined],
  ['empty object', {}],
  ['unknown fields only', { unknown: 'value' }],
  ['legacy picture field only', { picturePath: null }],
  [
    'protected fields only',
    { id: '42', role: 'TENANT', email: 'a@b.com', password: 'password' },
  ],
  ['array', []],
  ...['firstName', 'lastName', 'phone', 'pictureKey'].flatMap(
    (field): [string, unknown][] =>
      ['', 42, false, [], {}].map((value) => [
        `invalid ${field}: ${JSON.stringify(value)}`,
        { firstName: 'Valid', [field]: value },
      ])
  ),
  ['null first name', { firstName: null }],
  ['null last name', { lastName: null }],
]

void describe('user info and profile updates', { concurrency: false }, () => {
  for (const role of ['TENANT', 'LANDLORD'] as const) {
    void test(`${role} can update and clear profile fields without changing protected data or other accounts`, async () => {
      const {
        rows: [original],
      } = await pool.query<UserInfo>(
        `INSERT INTO "user" (id, first_name, last_name, email, password, role)
         VALUES (9007199254740993, 'Ada', 'Example', 'ada@example.com', 'private-hash', $1)
         RETURNING id, role, first_name AS "firstName", last_name AS "lastName",
           email, phone, picture_key AS "pictureKey"`,
        [role]
      )
      const otherBefore = await pool.query('SELECT * FROM "user" WHERE id = 1')
      const changes = {
        firstName: "Ada's new name",
        lastName: 'Lovelace',
        phone: '+358401234567',
        pictureKey: null,
      }
      const response = await request(original.id, 'PATCH', {
        ...changes,
        id: '1',
        userId: '1',
        role: role === 'TENANT' ? 'LANDLORD' : 'TENANT',
        email: 'changed@example.com',
        password: 'changed-password',
        passwordHash: 'changed-hash',
      })
      const expected: UserInfoResponse = {
        ...original,
        ...changes,
        pictureUrl: null,
      }
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), expected)
      const persisted = await request(original.id, 'GET')
      assert.equal(persisted.status, 200)
      assert.deepEqual(await persisted.json(), expected)

      const renamed = await request(original.id, 'PATCH', { lastName: 'Byron' })
      expected.lastName = 'Byron'
      assert.equal(renamed.status, 200)
      assert.deepEqual(await renamed.json(), expected)

      for (const field of ['phone', 'pictureKey'] as const) {
        const cleared = await request(original.id, 'PATCH', { [field]: null })
        expected[field] = null
        assert.equal(cleared.status, 200)
        assert.deepEqual(await cleared.json(), expected)
        const readBack = await request(original.id, 'GET')
        assert.equal(readBack.status, 200)
        assert.deepEqual(await readBack.json(), expected)
      }

      const password = await pool.query<{ password: string }>(
        'SELECT password FROM "user" WHERE id = $1',
        [original.id]
      )
      assert.equal(password.rows[0].password, 'private-hash')
      const otherAfter = await pool.query('SELECT * FROM "user" WHERE id = 1')
      assert.deepEqual(otherAfter.rows, otherBefore.rows)

      await pool.query('DELETE FROM "user" WHERE id = $1', [original.id])
      for (const method of ['GET', 'PATCH']) {
        const deleted = await request(
          original.id,
          method,
          method === 'PATCH' ? { firstName: 'Updated' } : undefined
        )
        assert.equal(deleted.status, 401)
        assert.deepEqual(await deleted.json(), {
          error: 'error.authentication.unauthorized',
        })
      }
    })

    void test(`GET returns only the ${role}'s public stored fields and ignores query parameters`, async () => {
      const user = await seedUser(role)
      const response = await request(user.id, 'GET')
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), user)
    })
  }

  void test('GET and PATCH use the subject and current database values instead of stale claims', async () => {
    const user = await seedUser()
    const before = await storedUsers()
    const token = jwt.sign(
      { userId: '1', role: 'LANDLORD', email: 'stale@example.com' },
      process.env.JWT_SECRET as string,
      { algorithm: 'HS256', subject: user.id, expiresIn: '1h' }
    )
    await pool.query('UPDATE "user" SET last_name = $1 WHERE id = $2', [
      'Current database value',
      user.id,
    ])
    user.lastName = 'Current database value'
    const read = await request(user.id, 'GET', undefined, `Bearer ${token}`)
    assert.equal(read.status, 200)
    assert.deepEqual(await read.json(), user)

    const updated = await request(
      user.id,
      'PATCH',
      {
        firstName: 'Updated',
        id: '1',
        userId: '1',
        role: 'LANDLORD',
        email: 'other@example.com',
        password: 'changed-password',
        passwordHash: 'changed-hash',
        first_name: 'Ignored',
      },
      `Bearer ${token}`
    )
    assert.equal(updated.status, 200)
    assert.deepEqual(await updated.json(), { ...user, firstName: 'Updated' })
    const after = await storedUsers()
    assert.deepEqual(after[0], before[0])
    assert.deepEqual(after[1], {
      ...before[1],
      first_name: 'Updated',
      last_name: user.lastName,
    })
  })

  void test('GET ignores another account ID in a request body', async () => {
    const user = await seedUser()
    const { createAccessToken } = await import('../../utils/jwt.js')
    const body = JSON.stringify({ id: '1', userId: '1' })
    const result = await new Promise<{ status?: number; body: string }>(
      (resolve, reject) => {
        const req = httpRequest(
          new URL('/api/user/info', baseUrl),
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${createAccessToken(user.id)}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
            signal: AbortSignal.timeout(15_000),
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
        req.on('error', reject)
        req.end(body)
      }
    )
    assert.equal(result.status, 200)
    assert.deepEqual(JSON.parse(result.body), user)
  })

  for (const [description, body] of invalidUpdates) {
    void test(`PATCH rejects ${description} with validation issues and leaves stored data unchanged`, async () => {
      const before = await storedUsers()
      const response = await request('1', 'PATCH', body)
      assert.equal(response.status, 400)
      const result = (await response.json()) as {
        errors: { code: string; path: unknown[]; message: string }[]
      }
      assert.ok(result.errors.length > 0)
      for (const issue of result.errors) {
        assert.equal(typeof issue.code, 'string')
        assert.ok(Array.isArray(issue.path))
        assert.equal(typeof issue.message, 'string')
      }
      assert.deepEqual(await storedUsers(), before)
    })
  }

  for (const body of ['null', '"text"', '42', '{']) {
    void test(`PATCH rejects invalid JSON body ${body}`, async () => {
      const { createAccessToken } = await import('../../utils/jwt.js')
      const before = await storedUsers()
      const response = await fetch(new URL('/api/user/info', baseUrl), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${createAccessToken('1')}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: 'error.request.invalid',
      })
      assert.deepEqual(await storedUsers(), before)
    })
  }

  void test('GET and PATCH reject missing, malformed, invalid and expired credentials', async () => {
    const before = await storedUsers()
    const invalidAuthorization = [
      null,
      'Bearer not-a-jwt',
      `Bearer ${jwt.sign({}, 'another-secret', {
        algorithm: 'HS256',
        subject: '1',
        expiresIn: '1h',
      })}`,
      `Bearer ${jwt.sign({}, process.env.JWT_SECRET as string, {
        algorithm: 'HS256',
        subject: '1',
        expiresIn: -1,
      })}`,
    ]
    for (const method of ['GET', 'PATCH']) {
      for (const authorization of invalidAuthorization) {
        const response = await request(
          '1',
          method,
          method === 'PATCH' ? { firstName: 'Updated' } : undefined,
          authorization
        )
        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), {
          error: 'error.authentication.unauthorized',
        })
      }
    }
    assert.deepEqual(await storedUsers(), before)
  })

  void test('GET and PATCH return a generic server error for a real database failure', async (t) => {
    t.mock.method(console, 'error', () => {})
    const before = await storedUsers()
    await pool.query('ALTER TABLE "user" RENAME TO unavailable_user')
    try {
      for (const method of ['GET', 'PATCH']) {
        const response = await request(
          '1',
          method,
          method === 'PATCH' ? { phone: null } : undefined
        )
        assert.equal(response.status, 500)
        assert.deepEqual(await response.json(), {
          error: 'error.server.unexpected',
        })
      }
    } finally {
      await pool.query('ALTER TABLE unavailable_user RENAME TO "user"')
    }
    assert.deepEqual(await storedUsers(), before)
  })
})

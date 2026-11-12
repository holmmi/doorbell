import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { UserInfo, UserInfoResponse } from '../../types/user.js'
import { baseUrl, pool } from './helpers/integration.js'

const request = async (userId: string, method: string, body?: unknown) => {
  const { createAccessToken } = await import('../../utils/jwt.js')
  return fetch(new URL('/api/user/info?id=999&userId=999', baseUrl), {
    method,
    headers: {
      Authorization: `Bearer ${createAccessToken(userId)}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  })
}

void describe('profile updates persist', { concurrency: false }, () => {
  for (const role of ['TENANT', 'LANDLORD'] as const) {
    void test(`${role} can update and clear profile fields without changing protected data or other accounts`, async () => {
      const {
        rows: [original],
      } = await pool.query<UserInfo>(
        `INSERT INTO "user" (id, first_name, last_name, email, password, role)
         VALUES (9007199254740993, 'Ada', 'Example', 'ada@example.com', 'private-hash', $1)
         RETURNING id, role, first_name AS "firstName", last_name AS "lastName",
           email, phone, picture_path AS "picturePath"`,
        [role]
      )
      const otherBefore = await pool.query('SELECT * FROM "user" WHERE id = 1')
      const changes = {
        firstName: "Ada's new name",
        lastName: 'Lovelace',
        phone: '+358401234567',
        picturePath: null,
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

      for (const field of ['phone', 'picturePath'] as const) {
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
      const deleted = await request(original.id, 'PATCH', {
        firstName: 'Updated',
      })
      assert.equal(deleted.status, 401)
      assert.deepEqual(await deleted.json(), {
        error: 'error.authentication.unauthorized',
      })
    })
  }
})

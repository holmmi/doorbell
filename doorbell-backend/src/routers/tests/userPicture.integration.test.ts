import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { describe, test } from 'node:test'
import { promisify } from 'node:util'

import { HeadObjectCommand, S3ServiceException } from '@aws-sdk/client-s3'
import jwt from 'jsonwebtoken'

import type { PresignedImage } from '../../types/listing.js'
import type { UserInfoResponse } from '../../types/user.js'
import {
  baseUrl,
  head,
  imageBytes,
  pool,
  storage,
  waitForBlockedConnection,
} from './helpers/integration.js'

const request = async (
  method: string,
  path: string,
  body?: unknown,
  userId = '1',
  authorization?: string
) => {
  const { createAccessToken } = await import('../../utils/jwt.js')
  return fetch(new URL(`/api/user/${path}?userId=999`, baseUrl), {
    method,
    headers: {
      Authorization: authorization ?? `Bearer ${createAccessToken(userId)}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  })
}

const presign = async (contentType = 'image/png', userId = '1') => {
  const response = await request(
    'POST',
    'picture/presign',
    {
      contentType,
      userId: '999',
      objectKey: 'users/999/overwrite.png',
    },
    userId
  )
  assert.equal(response.status, 200)
  const image = (await response.json()) as PresignedImage
  assert.match(
    image.objectKey,
    new RegExp(`^users/${userId}/[0-9a-f-]{36}\\.(png|jpg|jpeg)$`)
  )
  assert.equal(image.expiresIn, 900)
  return image
}

const upload = async (
  image: PresignedImage,
  contentType = 'image/png',
  body = imageBytes
) => {
  const response = await fetch(image.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
    signal: AbortSignal.timeout(15_000),
  })
  assert.equal(response.status, 200)
}

const save = (picturePath: string | null, fields = {}, userId = '1') =>
  request('PATCH', 'info', { ...fields, picturePath }, userId)

const read = async (userId = '1') => {
  const response = await request('GET', 'info', undefined, userId)
  assert.equal(response.status, 200)
  return (await response.json()) as UserInfoResponse
}

const addPicture = async () => {
  const image = await presign()
  await upload(image)
  assert.equal((await save(image.objectKey)).status, 200)
  return image
}

const cleanup = async () => {
  const { cleanUpImages } =
    await import('../../repositories/imageCleanupRepository.js')
  const { deleteImageObject } = await import('../../services/imageService.js')
  await cleanUpImages(deleteImageObject)
}

const makeCleanupDue = () =>
  pool.query(
    "UPDATE listing_image_cleanup SET available_after = CURRENT_TIMESTAMP - INTERVAL '1 second'"
  )

const assertMissing = (key: string) =>
  assert.rejects(
    head(key),
    (error: unknown) =>
      error instanceof S3ServiceException &&
      error.$metadata.httpStatusCode === 404
  )

const assertError = async (response: Response, status: number, key: string) => {
  assert.equal(response.status, status)
  assert.deepEqual(await response.json(), { error: key })
}

void describe('profile picture lifecycle', { concurrency: false }, () => {
  for (const role of ['TENANT', 'LANDLORD']) {
    for (const contentType of ['image/png', 'image/jpg', 'image/jpeg']) {
      void test(`${role} can upload, display, replace and remove ${contentType}`, async () => {
        const userId = '9007199254740993'
        await pool.query(
          `INSERT INTO "user" (id, first_name, last_name, email, password, role)
           VALUES ($1, 'Ada', 'Example', 'ada@example.com', 'private', $2)`,
          [userId, role]
        )
        const initial = await read(userId)
        const first = await presign(contentType, userId)
        assert.deepEqual(await read(userId), initial)
        await upload(first, contentType)
        assert.deepEqual(await read(userId), initial)

        const response = await save(
          first.objectKey,
          { firstName: 'Updated', phone: '123' },
          userId
        )
        assert.equal(response.status, 200)
        const saved = (await response.json()) as UserInfoResponse
        assert.equal(saved.picturePath, first.objectKey)
        assert.equal(saved.firstName, 'Updated')
        assert.equal(saved.phone, '123')
        assert.deepEqual(
          Object.keys(saved).sort(),
          [
            'id',
            'role',
            'firstName',
            'lastName',
            'email',
            'phone',
            'picturePath',
            'pictureUrl',
          ].sort()
        )
        for (const profile of [saved, await read(userId)]) {
          assert.ok(profile.pictureUrl)
          const url = new URL(profile.pictureUrl)
          assert.equal(url.searchParams.get('X-Amz-Expires'), '900')
          assert.ok(url.searchParams.get('X-Amz-Signature'))
          assert.ok(url.pathname.endsWith(first.objectKey))
          const download = await fetch(url)
          assert.equal(download.status, 200)
          assert.deepEqual(
            Buffer.from(await download.arrayBuffer()),
            imageBytes
          )
        }
        const partial = await request('PATCH', 'info', { phone: null }, userId)
        assert.equal(partial.status, 200)
        assert.equal(
          ((await partial.json()) as UserInfoResponse).picturePath,
          first.objectKey
        )
        assert.equal((await save(first.objectKey, {}, userId)).status, 200)
        assert.equal(
          (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
          0
        )

        const second = await presign(contentType, userId)
        assert.notEqual(second.objectKey, first.objectKey)
        await upload(second, contentType)
        assert.equal((await save(second.objectKey, {}, userId)).status, 200)
        await cleanup()
        await head(first.objectKey)
        await makeCleanupDue()
        await cleanup()
        await assertMissing(first.objectKey)
        await head(second.objectKey)
        await assertError(
          await save(first.objectKey, {}, userId),
          400,
          'error.user.picture.invalidKey'
        )
        const removed = await save(null, {}, userId)
        assert.equal(removed.status, 200)
        const cleared = (await removed.json()) as UserInfoResponse
        assert.equal(cleared.picturePath, null)
        assert.equal(cleared.pictureUrl, null)
        await makeCleanupDue()
        await cleanup()
        await assertMissing(second.objectKey)
        assert.equal((await read()).picturePath, null)
      })
    }
  }

  void test('presign requires valid credentials and an existing account', async () => {
    const expired = jwt.sign({}, process.env.JWT_SECRET as string, {
      algorithm: 'HS256',
      subject: '1',
      expiresIn: -1,
    })
    const invalid = jwt.sign({}, 'wrong-secret', {
      algorithm: 'HS256',
      subject: '1',
      expiresIn: '1h',
    })
    for (const authorization of [
      '',
      'Bearer invalid',
      `Bearer ${expired}`,
      `Bearer ${invalid}`,
    ]) {
      await assertError(
        await request(
          'POST',
          'picture/presign',
          { contentType: 'image/png' },
          '1',
          authorization
        ),
        401,
        'error.authentication.unauthorized'
      )
    }
    await assertError(
      await request(
        'POST',
        'picture/presign',
        { contentType: 'image/png' },
        '999'
      ),
      401,
      'error.authentication.unauthorized'
    )
    assert.equal(
      (await pool.query('SELECT * FROM user_picture_upload')).rowCount,
      0
    )
  })

  void test('presign validates supported MIME types', async () => {
    for (const body of [
      {},
      { contentType: 'image/gif' },
      { contentType: 42 },
    ]) {
      const response = await request('POST', 'picture/presign', body)
      assert.equal(response.status, 400)
      assert.ok(
        ((await response.json()) as { errors: unknown[] }).errors.length
      )
    }
  })

  void test('rejects foreign, listing, fabricated, URL and expired keys atomically', async () => {
    const original = await addPicture()
    await pool.query(`INSERT INTO "user" (first_name, last_name, email, password, role)
      VALUES ('Other', 'User', 'other@example.com', 'private', 'TENANT')`)
    const foreign = await presign('image/png', '2')
    await upload(foreign)
    const expired = await presign()
    await upload(expired)
    await pool.query(
      "UPDATE user_picture_upload SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE object_key = $1",
      [expired.objectKey]
    )
    for (const key of [
      foreign.objectKey,
      'listings/1/image.png',
      'users/1/fabricated.png',
      'https://example.com/avatar.png',
      expired.objectKey,
    ]) {
      await assertError(
        await save(key, { firstName: 'Must roll back', phone: '123' }),
        400,
        'error.user.picture.invalidKey'
      )
      const current = await read()
      assert.equal(current.picturePath, original.objectKey)
      assert.equal(current.firstName, 'Owner')
      assert.equal(current.phone, null)
      assert.equal(
        (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
        0
      )
    }
    await head(original.objectKey)
    await head(foreign.objectKey)
    assert.equal((await save(foreign.objectKey, {}, '2')).status, 200)
  })

  void test('missing, empty and mismatched uploads preserve the profile and can be retried', async () => {
    const original = await addPicture()
    const image = await presign()
    await assertError(
      await save(image.objectKey, { lastName: 'Changed' }),
      409,
      'error.user.picture.notUploaded'
    )
    // S3Mock does not enforce signed headers; deliberately upload bad metadata.
    for (const [type, bytes] of [
      ['image/png', Buffer.alloc(0)],
      ['image/jpeg', imageBytes],
      ['text/plain', imageBytes],
    ] as const) {
      await upload(image, type, bytes)
      await assertError(
        await save(image.objectKey, { lastName: 'Changed' }),
        400,
        'error.user.picture.invalidObject'
      )
      assert.equal((await read()).picturePath, original.objectKey)
      assert.equal((await read()).lastName, 'One')
    }
    assert.equal(
      (
        await pool.query(
          'SELECT * FROM user_picture_upload WHERE object_key = $1',
          [image.objectKey]
        )
      ).rowCount,
      1
    )
    await upload(image)
    assert.equal((await save(image.objectKey)).status, 200)
  })

  void test('storage verification failures roll back staged consumption and all fields', async (t) => {
    const original = await addPicture()
    const replacement = await presign()
    await upload(replacement)
    const send = storage.send.bind(storage)
    const mock = t.mock.method(
      storage,
      'send',
      (command: HeadObjectCommand) => {
        if (command instanceof HeadObjectCommand)
          throw new Error('storage offline')
        return send(command)
      }
    )
    await assertError(
      await save(replacement.objectKey, { firstName: 'Changed' }),
      503,
      'error.user.picture.storageUnavailable'
    )
    mock.mock.restore()
    assert.equal((await read()).picturePath, original.objectKey)
    assert.equal((await read()).firstName, 'Owner')
    assert.equal(
      (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
      0
    )
    assert.equal((await save(replacement.objectKey)).status, 200)
  })

  void test('signing failures preserve saved data and report a storage error', async () => {
    const original = await addPicture()
    const bucket = process.env.S3_BUCKET
    delete process.env.S3_BUCKET
    try {
      await assertError(
        await request('POST', 'picture/presign', { contentType: 'image/png' }),
        503,
        'error.user.picture.storageUnavailable'
      )
      await assertError(
        await request('PATCH', 'info', { firstName: 'Changed' }),
        503,
        'error.user.picture.storageUnavailable'
      )
      await assertError(
        await request('GET', 'info'),
        503,
        'error.user.picture.storageUnavailable'
      )
    } finally {
      process.env.S3_BUCKET = bucket
    }
    assert.equal((await read()).firstName, 'Owner')
    assert.equal((await read()).picturePath, original.objectKey)
  })

  void test('a commit failure rolls back the profile, staging and cleanup together', async (t) => {
    const original = await addPicture()
    const replacement = await presign()
    await upload(replacement)
    t.mock.method(console, 'error', () => {})
    await pool.query(`
      CREATE FUNCTION reject_profile_save() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test commit failure'; END $$;
      CREATE CONSTRAINT TRIGGER reject_profile_save AFTER UPDATE ON "user"
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_profile_save();
    `)
    try {
      for (const picture of [replacement.objectKey, null]) {
        await assertError(
          await save(picture, { firstName: 'Changed', phone: '123' }),
          500,
          'error.server.unexpected'
        )
        assert.equal((await read()).picturePath, original.objectKey)
        assert.equal((await read()).firstName, 'Owner')
        assert.equal((await read()).phone, null)
        assert.equal(
          (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
          0
        )
        await cleanup()
        await head(original.objectKey)
      }
    } finally {
      await pool.query(
        'DROP TRIGGER reject_profile_save ON "user"; DROP FUNCTION reject_profile_save()'
      )
    }
    assert.equal((await save(replacement.objectKey)).status, 200)
  })

  void test('abandoned uploads and retired pictures survive cleanup failures and worker restarts', async (t) => {
    const retired = await addPicture()
    const saved = await addPicture()
    const abandoned = await presign()
    await upload(abandoned)
    await pool.query(
      "UPDATE user_picture_upload SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'"
    )
    await makeCleanupDue()
    const { cleanUpImages } =
      await import('../../repositories/imageCleanupRepository.js')
    t.mock.method(console, 'error', () => {})
    await cleanUpImages(() => Promise.reject(new Error('storage offline')))
    const queued = await pool.query<{ object_key: string; delayed: boolean }>(
      'SELECT object_key, available_after > CURRENT_TIMESTAMP AS delayed FROM listing_image_cleanup'
    )
    assert.deepEqual(
      new Set(queued.rows.map((row) => row.object_key)),
      new Set([retired.objectKey, abandoned.objectKey])
    )
    assert.ok(queued.rows.every((row) => row.delayed))
    assert.equal(
      (await pool.query('SELECT * FROM user_picture_upload')).rowCount,
      0
    )
    assert.equal((await read()).picturePath, saved.objectKey)
    // Restart in a separate process: recovery must use only durable DB state.
    await makeCleanupDue()
    const repositoryUrl = new URL(
      '../../repositories/imageCleanupRepository.js',
      import.meta.url
    ).href
    const serviceUrl = new URL(
      '../../services/imageService.js',
      import.meta.url
    ).href
    const databaseUrl = new URL('../../config/database.js', import.meta.url)
      .href
    await promisify(execFile)(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `
        const { cleanUpImages } = await import(${JSON.stringify(repositoryUrl)});
        const { deleteImageObject } = await import(${JSON.stringify(serviceUrl)});
        const { pool } = await import(${JSON.stringify(databaseUrl)});
        try { await cleanUpImages(deleteImageObject); } finally { await pool.end(); }
      `,
      ],
      { timeout: 30_000 }
    )
    await cleanup()
    await assertMissing(retired.objectKey)
    await assertMissing(abandoned.objectKey)
    await head(saved.objectKey)
    assert.equal(
      (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
      0
    )
  })

  for (const sameKey of [false, true]) {
    void test(`concurrent saves preserve the selected picture (same key: ${sameKey})`, async () => {
      const original = await addPicture()
      const first = await presign()
      await upload(first)
      const second = sameKey ? first : await presign()
      if (!sameKey) await upload(second)
      const barrier = await pool.connect()
      const pending: Promise<Response>[] = []
      try {
        await barrier.query('BEGIN')
        await barrier.query('SELECT id FROM "user" WHERE id = 1 FOR UPDATE')
        const {
          rows: [backend],
        } = await barrier.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid'
        )
        pending.push(save(first.objectKey))
        await waitForBlockedConnection(backend.pid)
        pending.push(save(second.objectKey))
        await barrier.query('COMMIT')
        const responses = await Promise.all(pending)
        for (const response of responses) assert.equal(response.status, 200)
        const current = await read()
        const queued = await pool.query<{ object_key: string }>(
          'SELECT object_key FROM listing_image_cleanup'
        )
        const expected = new Set([
          original.objectKey,
          first.objectKey,
          second.objectKey,
        ])
        expected.delete(current.picturePath as string)
        assert.deepEqual(
          new Set(queued.rows.map((row) => row.object_key)),
          expected
        )
        await makeCleanupDue()
        await cleanup()
        await head(current.picturePath as string)
        for (const key of expected) await assertMissing(key)
      } finally {
        await barrier.query('ROLLBACK')
        barrier.release()
        await Promise.allSettled(pending)
      }
    })
  }

  void test('legacy foreign references are neither signed nor deleted', async () => {
    await pool.query('UPDATE "user" SET picture_path = $1 WHERE id = 1', [
      'listings/1/protected.png',
    ])
    assert.equal((await read()).pictureUrl, null)
    assert.equal((await save(null)).status, 200)
    assert.equal(
      (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
      0
    )
  })

  void test('a stale concurrent save cannot reattach a picture being removed', async () => {
    const original = await addPicture()
    await pool.query(`
      CREATE FUNCTION pause_profile_removal() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.picture_path IS NULL THEN PERFORM pg_advisory_xact_lock(565656); END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER pause_profile_removal BEFORE UPDATE ON "user"
        FOR EACH ROW EXECUTE FUNCTION pause_profile_removal();
    `)
    const barrier = await pool.connect()
    const pending: Promise<Response>[] = []
    try {
      await barrier.query('BEGIN')
      await barrier.query('SELECT pg_advisory_xact_lock(565656)')
      const {
        rows: [backend],
      } = await barrier.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
      pending.push(save(null))
      const removingPid = await waitForBlockedConnection(backend.pid)
      pending.push(save(original.objectKey, { firstName: 'Stale save' }))
      await waitForBlockedConnection(removingPid)
      // The retirement is uncommitted and invisible to the cleanup worker.
      assert.equal(
        (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
        0
      )
      await cleanup()
      await head(original.objectKey)
      await barrier.query('COMMIT')
      const [removed, stale] = await Promise.all(pending)
      assert.equal(removed.status, 200)
      await assertError(stale, 400, 'error.user.picture.invalidKey')
      assert.equal((await read()).picturePath, null)
      assert.equal((await read()).firstName, 'Owner')
      await makeCleanupDue()
      await cleanup()
      await assertMissing(original.objectKey)
    } finally {
      await barrier.query('ROLLBACK')
      barrier.release()
      await Promise.allSettled(pending)
      await pool.query(
        'DROP TRIGGER pause_profile_removal ON "user"; DROP FUNCTION pause_profile_removal()'
      )
    }
  })

  void test('cleanup skips a referenced picture and retains abandoned uploads after account deletion', async () => {
    const saved = await addPicture()
    await pool.query(
      'INSERT INTO listing_image_cleanup (object_key, available_after) VALUES ($1, CURRENT_TIMESTAMP)',
      [saved.objectKey]
    )
    await cleanup()
    await head(saved.objectKey)
    const staged = await presign()
    await upload(staged)
    await pool.query('DELETE FROM "user" WHERE id = 1')
    await assertError(
      await request('POST', 'picture/presign', { contentType: 'image/png' }),
      401,
      'error.authentication.unauthorized'
    )
    await pool.query(
      "UPDATE user_picture_upload SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'"
    )
    await cleanup()
    await assertMissing(staged.objectKey)
  })
})

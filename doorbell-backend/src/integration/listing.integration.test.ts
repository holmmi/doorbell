import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile, readdir } from 'node:fs/promises'
import type { Server } from 'node:http'
import { after, before, beforeEach, describe, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import {
  S3MockContainer,
  type StartedS3MockContainer,
} from '@testcontainers/s3mock'
import type { Pool } from 'pg'

import type {
  ListingDetails,
  ListingImage,
  ListingImageInput,
  PresignedImage,
} from '../types/listing.js'

const bucket = 'listing-integration'
const imageBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64'
)
const listingInput = {
  neighborhood: 'Kallio',
  city: 'Helsinki',
  availableFrom: '2026-11-01',
  rent: 1250,
  squareMeters: 42.5,
  rooms: 'ONE_ROOM_AND_KITCHEN',
}

let postgres: StartedPostgreSqlContainer | undefined
let s3mock: StartedS3MockContainer | undefined
let pool: Pool
let storage: S3Client
let server: Server | undefined
let baseUrl: string
let token: string

before(
  async () => {
    // Dedicated containers and random host ports keep development data untouched.
    postgres = await new PostgreSqlContainer('postgres:18.6')
      .withDatabase('listing_integration')
      .withUsername('listing_test')
      .withPassword('test-only-password')
      .withStartupTimeout(120_000)
      .start()
    s3mock = await new S3MockContainer('adobe/s3mock:5.2.3')
      .withStartupTimeout(120_000)
      .start()

    // Database configuration is read on import, so load the app only after startup.
    Object.assign(process.env, {
      DOTENV_CONFIG_PATH: '__test_missing_env__',
      JWT_SECRET: 'test-only-listing-integration-secret',
      DB_HOST: postgres.getHost(),
      DB_PORT: String(postgres.getPort()),
      DB_NAME: postgres.getDatabase(),
      DB_USER: postgres.getUsername(),
      DB_PASSWORD: postgres.getPassword(),
      S3_ENDPOINT: s3mock.getHttpConnectionUrl(),
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: s3mock.getAccessKeyId(),
      S3_SECRET_KEY: s3mock.getSecretAccessKey(),
      S3_BUCKET: bucket,
      S3_FORCE_PATH_STYLE: 'true',
    })
    ;({ pool } = await import('../config/database.js'))
    const migrations = new URL('../../../migrations/', import.meta.url)
    const filenames = (await readdir(migrations))
      .filter((name) => /^V\d+__.*\.sql$/.test(name))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    for (const filename of filenames) {
      await pool.query(await readFile(new URL(filename, migrations), 'utf8'))
    }

    const { getObjectStorage } = await import('../config/objectStorage.js')
    storage = getObjectStorage().client
    await storage.send(new CreateBucketCommand({ Bucket: bucket }))
    const { default: app } = await import('../app.js')
    const { createAccessToken } = await import('../utils/jwt.js')
    token = createAccessToken('1')
    server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    baseUrl = `http://127.0.0.1:${address.port}/api/listing`
  },
  { timeout: 300_000 }
)

after(async () => {
  // Also release resources when setup or a test fails partway through.
  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()))
      })
    }
  } finally {
    storage?.destroy()
    try {
      await pool?.end()
    } finally {
      await Promise.all([s3mock?.stop(), postgres?.stop()])
    }
  }
})

beforeEach(async () => {
  const objects = await storage.send(
    new ListObjectsV2Command({ Bucket: bucket })
  )
  if (objects.Contents?.length) {
    await storage.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects.Contents.map(({ Key }) => ({ Key })) },
      })
    )
  }
  await pool.query(`
    TRUNCATE "user", rental_listing, rental_listing_image,
      rental_listing_image_upload, listing_image_cleanup RESTART IDENTITY CASCADE;
    INSERT INTO "user" (first_name, last_name, email, password, role)
      VALUES ('Owner', 'One', 'owner@example.com', 'unused', 'LANDLORD');
  `)
  const response = await request('POST', '', listingInput)
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { id: '1' })
})

const request = (method: string, path: string, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  })

const readListing = async () => {
  const response = await request('GET', '/1')
  assert.equal(response.status, 200)
  return (await response.json()) as ListingDetails
}

const update = (images: ListingImageInput[], neighborhood = 'Kallio') =>
  request('PUT', '/1', { ...listingInput, neighborhood, images })

const presign = async () => {
  const response = await request('POST', '/1/images/presign', {
    contentType: 'image/png',
  })
  assert.equal(response.status, 200)
  return (await response.json()) as PresignedImage
}

const upload = async (image: PresignedImage) => {
  const response = await fetch(image.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: imageBytes,
    signal: AbortSignal.timeout(15_000),
  })
  assert.equal(response.status, 200, await response.text())
}

const addImage = async (displayOrder: number) => {
  const image = await presign()
  await upload(image)
  const response = await request('POST', '/1/images', {
    objectKey: image.objectKey,
    displayOrder,
  })
  assert.equal(response.status, 201)
  return (await response.json()) as ListingImage
}

const head = (Key: string) =>
  storage.send(new HeadObjectCommand({ Bucket: bucket, Key }))

// Observe actual PostgreSQL waiters rather than assuming a request has reached
// a lock after a fixed sleep. Polling is bounded so regressions fail promptly.
const waitForBlockedConnection = async (
  blockingPid: number
): Promise<number> => {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const result = await pool.query<{ pid: number }>(
      `SELECT pid FROM pg_stat_activity
       WHERE datname = current_database() AND $1 = ANY(pg_blocking_pids(pid))`,
      [blockingPid]
    )
    if (result.rows.length > 0) return result.rows[0].pid
    await delay(25)
  }
  throw new Error(`No connection blocked by PostgreSQL PID ${blockingPid}`)
}

void describe(
  'listing integration with PostgreSQL and S3Mock',
  // Include time for cold image pulls and container startup in the suite budget.
  { concurrency: false, timeout: 360_000 },
  () => {
    void test('uploads bytes through the presigned URL and retries finalization after a missing object', async () => {
      const image = await presign()
      const body = { objectKey: image.objectKey, displayOrder: 1 }
      const missing = await request('POST', '/1/images', body)
      assert.equal(missing.status, 409)
      assert.deepEqual(await missing.json(), {
        error: 'error.listing.image.notUploaded',
      })
      assert.equal(
        (await pool.query('SELECT * FROM rental_listing_image_upload'))
          .rowCount,
        1
      )
      assert.equal((await readListing()).ready, false)

      await upload(image)
      const object = await storage.send(
        new GetObjectCommand({ Bucket: bucket, Key: image.objectKey })
      )
      assert.ok(object.Body)
      assert.deepEqual(
        Buffer.from(await object.Body.transformToByteArray()),
        imageBytes
      )
      assert.equal(object.ContentType, 'image/png')
      assert.equal((await request('POST', '/1/images', body)).status, 201)
      const listing = await readListing()
      assert.equal(listing.ready, true)
      assert.equal(listing.images[0].imagePath, image.objectKey)
      assert.equal(
        (await pool.query('SELECT * FROM rental_listing_image_upload'))
          .rowCount,
        0
      )
      assert.equal((await request('POST', '/1/publish')).status, 200)
      assert.equal((await readListing()).published, true)
    })

    void test('replaces and removes images, then deletes retired objects after the cleanup grace period', async () => {
      const first = await addImage(1)
      const second = await addImage(2)
      const replacement = await presign()
      await upload(replacement)
      assert.equal((await request('POST', '/1/publish')).status, 200)
      assert.equal(
        (
          await update([
            { id: first.id, objectKey: replacement.objectKey, displayOrder: 1 },
          ])
        ).status,
        200
      )
      const listing = await readListing()
      assert.deepEqual(listing.images, [
        { ...first, imagePath: replacement.objectKey },
      ])
      assert.equal(listing.published, true)
      const queued = await pool.query<{ object_key: string }>(
        'SELECT object_key FROM listing_image_cleanup'
      )
      assert.deepEqual(
        new Set(queued.rows.map((row) => row.object_key)),
        new Set([first.imagePath, second.imagePath])
      )

      const { cleanUpListingImages } =
        await import('../repositories/imageCleanupRepository.js')
      const { deleteImageObject } = await import('../services/imageService.js')
      await cleanUpListingImages(deleteImageObject)
      await head(first.imagePath)
      await head(second.imagePath)
      // Advance eligibility in the isolated database instead of waiting 15 minutes.
      await pool.query(
        "UPDATE listing_image_cleanup SET available_after = CURRENT_TIMESTAMP - INTERVAL '1 second'"
      )
      await cleanUpListingImages(deleteImageObject)
      for (const key of [first.imagePath, second.imagePath]) {
        await assert.rejects(
          head(key),
          (error: unknown) =>
            error instanceof S3ServiceException &&
            error.$metadata.httpStatusCode === 404
        )
      }
      assert.equal(
        (await head(replacement.objectKey)).ContentLength,
        imageBytes.length
      )
      assert.equal(
        (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
        0
      )
    })

    void test('swaps positions and rolls back a deferred uniqueness violation at commit', async () => {
      const first = await addImage(1)
      const second = await addImage(2)
      const response = await update([
        { id: first.id, displayOrder: 2 },
        { id: second.id, displayOrder: 1 },
      ])
      assert.equal(response.status, 200)
      const listing = await readListing()
      assert.deepEqual(listing.images, [
        { ...second, displayOrder: 1 },
        { ...first, displayOrder: 2 },
      ])

      const { withOwnedListing, updateListingImage } =
        await import('../repositories/listingRepository.js')
      await assert.rejects(
        withOwnedListing('1', '1', async (client) => {
          await client.query(
            'SET CONSTRAINTS rental_listing_image_listing_display_order_key DEFERRED'
          )
          await updateListingImage(client, '1', { ...first, displayOrder: 1 })
          await client.query(
            "UPDATE rental_listing SET neighborhood = 'Must roll back' WHERE id = 1"
          )
        }),
        { status: 409, message: 'error.listing.image.conflict' }
      )
      assert.deepEqual(await readListing(), listing)
    })

    void test('overlapping HTTP updates wait for the row lock and validate the latest committed image set', async () => {
      const first = await addImage(1)
      const second = await addImage(2)
      // A test-only trigger pauses the first HTTP update just before it saves
      // details, while its image changes and parent-row lock are still uncommitted.
      await pool.query(`
      CREATE FUNCTION pause_listing_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.neighborhood = 'First concurrent update' THEN
          PERFORM pg_advisory_xact_lock(246810);
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER pause_listing_update BEFORE UPDATE ON rental_listing
        FOR EACH ROW EXECUTE FUNCTION pause_listing_update();
    `)
      const barrier = await pool.connect()
      const pending: Promise<Response>[] = []
      try {
        await barrier.query('BEGIN')
        await barrier.query('SELECT pg_advisory_xact_lock(246810)')
        const {
          rows: [{ pid }],
        } = await barrier.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid'
        )
        pending.push(
          update(
            [{ id: second.id, displayOrder: 1 }],
            'First concurrent update'
          )
        )
        const firstPid = await waitForBlockedConnection(pid)
        pending.push(
          update(
            [
              { id: first.id, displayOrder: 1 },
              { id: second.id, displayOrder: 2 },
            ],
            'Second concurrent update'
          )
        )
        const secondPid = await waitForBlockedConnection(firstPid)
        assert.notEqual(firstPid, secondPid)
        await barrier.query('COMMIT')

        const [firstResponse, secondResponse] = await Promise.all(pending)
        assert.equal(firstResponse.status, 200)
        assert.equal(secondResponse.status, 404)
        assert.deepEqual(await secondResponse.json(), {
          error: 'error.listing.image.notFound',
        })
        const listing = await readListing()
        assert.equal(listing.neighborhood, 'First concurrent update')
        assert.deepEqual(listing.images, [{ ...second, displayOrder: 1 }])
      } finally {
        await barrier.query('ROLLBACK')
        barrier.release()
        await Promise.allSettled(pending)
        await pool.query(
          'DROP TRIGGER pause_listing_update ON rental_listing; DROP FUNCTION pause_listing_update()'
        )
      }
    })
  }
)

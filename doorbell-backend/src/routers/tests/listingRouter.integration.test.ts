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
  ListingDetailsResponse,
  ListingImage,
  ListingImageInput,
  PresignedImage,
} from '../../types/listing.js'

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
    ;({ pool } = await import('../../config/database.js'))
    const migrations = new URL('../../../../migrations/', import.meta.url)
    const filenames = (await readdir(migrations))
      .filter((name) => /^V\d+__.*\.sql$/.test(name))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    for (const filename of filenames) {
      await pool.query(await readFile(new URL(filename, migrations), 'utf8'))
    }

    const { getObjectStorage } = await import('../../config/objectStorage.js')
    storage = getObjectStorage().client
    await storage.send(new CreateBucketCommand({ Bucket: bucket }))
    const { default: app } = await import('../../app.js')
    const { createAccessToken } = await import('../../utils/jwt.js')
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

const publicRequest = (method: string, path: string) =>
  fetch(`${baseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(15_000),
  })

const requestAs = (authToken: string, method: string, path: string) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })

const seedPublishedListing = async (ownerId: number, imagePath: string) => {
  const listing = await pool.query<{ id: string }>(
    `INSERT INTO rental_listing (
       owner_id, monthly_price, square_meters, neighborhood, city,
       available_from, extra_costs, rooms, published
     ) VALUES ($1, 1000, 40, 'Kallio', 'Helsinki', '2026-11-01', '', 'STUDIO', TRUE)
     RETURNING id`,
    [ownerId]
  )
  await pool.query(
    `INSERT INTO rental_listing_image
       (rental_listing_id, image_path, display_order)
     VALUES ($1, $2, 1)`,
    [listing.rows[0].id, imagePath]
  )
  return listing.rows[0].id
}

const createListing = async () => {
  const response = await request('POST', '', listingInput)
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { id: '1' })
}

const readListing = async () => {
  const response = await request('GET', '/1')
  assert.equal(response.status, 200)
  return (await response.json()) as ListingDetailsResponse
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
  'listing router tests',
  // Include time for cold image pulls and container startup in the suite budget.
  { concurrency: false, timeout: 360_000 },
  () => {
    void describe('listings', () => {
      void test('listing feed returns 2 listings with image URLs', async () => {
        await pool.query(`
          INSERT INTO "user" (first_name, last_name, email, password, role)
          VALUES ('Owner', 'Two', 'owner2@example.com', 'unused', 'LANDLORD')
        `)
        const firstId = await seedPublishedListing(
          1,
          'listings/1/public-first.png'
        )
        await seedPublishedListing(2, 'listings/2/public-second.png')
        await seedPublishedListing(2, 'listings/2/public-third.png')

        const response = await publicRequest('GET', '')
        assert.equal(response.status, 200)
        const listings = (await response.json()) as Array<{
          id: string
          images: Array<{ imageUrl: string }>
        }>
        assert.equal(listings.length, 2)
        assert.deepEqual(
          listings.map((listing) => listing.id),
          [firstId, '2']
        )
        assert.match(listings[0].images[0].imageUrl, /^http/)
      })

      void test('authenticated feed excludes owned and reviewed listings and returns 10 results', async () => {
        await pool.query(`
          INSERT INTO "user" (first_name, last_name, email, password, role)
          VALUES
            ('Tenant', 'Two', 'tenant@example.com', 'unused', 'TENANT'),
            ('Owner', 'Two', 'owner2@example.com', 'unused', 'LANDLORD')
        `)
        const ownedId = await seedPublishedListing(2, 'listings/2/owned.png')
        const reviewedId = await seedPublishedListing(
          1,
          'listings/1/reviewed.png'
        )
        for (let index = 0; index < 10; index += 1) {
          await seedPublishedListing(1, `listings/1/feed-${index}.png`)
        }
        await pool.query(
          `INSERT INTO rental_listing_preference
             (tenant_user_id, rental_listing_id, liked)
           VALUES (2, $1, TRUE)`,
          [reviewedId]
        )

        const { createAccessToken } = await import('../../utils/jwt.js')
        const response = await requestAs(createAccessToken('2'), 'GET', '')
        assert.equal(response.status, 200)
        const listings = (await response.json()) as Array<{ id: string }>
        assert.equal(listings.length, 10)
        assert.equal(
          listings.some((listing) => listing.id === ownedId),
          false
        )
        assert.equal(
          listings.some((listing) => listing.id === reviewedId),
          false
        )
      })

      void test('creating a listing succeeds', async () => {
        const response = await request('POST', '', listingInput)
        assert.equal(response.status, 201)
        assert.deepEqual(await response.json(), { id: '1' })

        const listing = await readListing()
        assert.equal(listing.id, '1')
        assert.equal(listing.ownerId, '1')
        assert.equal(listing.published, false)
        assert.equal(listing.ready, false)
        assert.deepEqual(listing.images, [])
      })

      void test('retrieving a listing succeeds and returns images in display order', async () => {
        await createListing()
        const second = await addImage(2)
        const first = await addImage(1)

        const response = await request('GET', '/1')
        assert.equal(response.status, 200)
        const listing = (await response.json()) as ListingDetailsResponse
        assert.equal(listing.neighborhood, listingInput.neighborhood)
        assert.equal(listing.city, listingInput.city)
        assert.equal(listing.monthlyPrice, '1250.00')
        assert.equal(listing.squareMeters, '42.50')
        assert.equal(listing.rooms, listingInput.rooms)
        assert.equal(listing.createdAt, '2026-10-19')
        assert.equal(listing.availableFrom, listingInput.availableFrom)
        assert.equal(listing.ready, true)
        assert.deepEqual(
          listing.images.map(({ id, displayOrder }) => ({ id, displayOrder })),
          [
            { id: first.id, displayOrder: first.displayOrder },
            { id: second.id, displayOrder: second.displayOrder },
          ]
        )
        assert.match(listing.images[0].imageUrl, /^http/)
      })

      void test('updating listing details succeeds and preserves its images', async () => {
        await createListing()
        const image = await addImage(1)

        const response = await request('PUT', '/1', {
          ...listingInput,
          neighborhood: 'Kamppi',
          rent: 1400,
          extraCosts: 'Water 25 EUR/month',
        })
        assert.equal(response.status, 200)
        const listing = (await response.json()) as ListingDetailsResponse
        assert.equal(listing.neighborhood, 'Kamppi')
        assert.equal(listing.monthlyPrice, '1400.00')
        assert.equal(listing.extraCosts, 'Water 25 EUR/month')
        assert.deepEqual(
          listing.images.map(({ id, displayOrder }) => ({ id, displayOrder })),
          [{ id: image.id, displayOrder: image.displayOrder }]
        )
        assert.match(listing.images[0].imageUrl, /^http/)
        const current = await readListing()
        assert.deepEqual(
          current.images.map(({ id, displayOrder }) => ({ id, displayOrder })),
          [{ id: image.id, displayOrder: image.displayOrder }]
        )
      })
    })

    void describe('uploads', () => {
      beforeEach(createListing)

      void test('finalizing an uploaded image succeeds', async () => {
        const image = await presign()
        await upload(image)

        const response = await request('POST', '/1/images', {
          objectKey: image.objectKey,
          displayOrder: 1,
        })
        assert.equal(response.status, 201)
        const finalized =
          (await response.json()) as ListingDetailsResponse['images'][number]
        assert.equal(finalized.id, '1')
        assert.equal(finalized.displayOrder, 1)
        assert.match(finalized.imageUrl, /^http/)
        assert.deepEqual(finalized, {
          id: '1',
          displayOrder: 1,
          imageUrl: finalized.imageUrl,
        })
        const listing = await readListing()
        assert.equal(listing.ready, true)
        assert.equal(listing.published, false)
        assert.deepEqual(
          listing.images.map(({ id, displayOrder }) => ({ id, displayOrder })),
          [{ id: finalized.id, displayOrder: finalized.displayOrder }]
        )
        assert.equal(
          (await pool.query('SELECT * FROM rental_listing_image_upload'))
            .rowCount,
          0
        )

        const object = await storage.send(
          new GetObjectCommand({ Bucket: bucket, Key: image.objectKey })
        )
        assert.ok(object.Body)
        assert.deepEqual(
          Buffer.from(await object.Body.transformToByteArray()),
          imageBytes
        )
        assert.equal(object.ContentType, 'image/png')
      })

      void test('finalizing an image fails when it has not been uploaded', async () => {
        const original = await readListing()
        const image = await presign()

        const response = await request('POST', '/1/images', {
          objectKey: image.objectKey,
          displayOrder: 1,
        })
        assert.equal(response.status, 409)
        assert.deepEqual(await response.json(), {
          error: 'error.listing.image.notUploaded',
        })
        assert.deepEqual(await readListing(), original)
        const pending = await pool.query<{ object_key: string }>(
          'SELECT object_key FROM rental_listing_image_upload'
        )
        assert.deepEqual(pending.rows, [{ object_key: image.objectKey }])
      })

      void test('retrying finalization succeeds after uploading the missing image', async () => {
        const image = await presign()
        const body = { objectKey: image.objectKey, displayOrder: 1 }
        assert.equal((await request('POST', '/1/images', body)).status, 409)
        await upload(image)

        const response = await request('POST', '/1/images', body)
        assert.equal(response.status, 201)
        assert.deepEqual((await readListing()).images, [await response.json()])
        assert.equal(
          (await pool.query('SELECT * FROM rental_listing_image_upload'))
            .rowCount,
          0
        )
      })
    })

    void describe('publication', () => {
      beforeEach(createListing)

      void test('publishing a listing with a finalized image succeeds', async () => {
        await addImage(1)

        const response = await request('POST', '/1/publish')
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { id: '1', published: true })
        assert.equal((await readListing()).published, true)
      })

      void test('publishing a listing without finalized images fails', async () => {
        const response = await request('POST', '/1/publish')
        assert.equal(response.status, 409)
        assert.deepEqual(await response.json(), {
          error: 'error.listing.images.incomplete',
        })
        assert.equal((await readListing()).published, false)
      })
    })

    void describe('updates', () => {
      beforeEach(createListing)

      void test('replacing a listing image succeeds and preserves publication', async () => {
        const original = await addImage(1)
        const replacement = await presign()
        await upload(replacement)
        assert.equal((await request('POST', '/1/publish')).status, 200)

        const response = await update([
          {
            id: original.id,
            objectKey: replacement.objectKey,
            displayOrder: 1,
          },
        ])
        assert.equal(response.status, 200)
        const listing = (await response.json()) as ListingDetailsResponse
        assert.equal(listing.images[0].id, original.id)
        assert.equal(listing.images[0].displayOrder, original.displayOrder)
        assert.match(listing.images[0].imageUrl, /^http/)
        assert.equal(listing.published, true)
        const current = await readListing()
        assert.deepEqual(
          current.images.map(({ id, displayOrder }) => ({ id, displayOrder })),
          [{ id: original.id, displayOrder: original.displayOrder }]
        )
      })

      void test('removing the last listing image succeeds and unpublishes the listing', async () => {
        await addImage(1)
        assert.equal((await request('POST', '/1/publish')).status, 200)

        const response = await update([])
        assert.equal(response.status, 200)
        const listing = (await response.json()) as ListingDetails
        assert.deepEqual(listing.images, [])
        assert.equal(listing.ready, false)
        assert.equal(listing.published, false)
        assert.deepEqual(await readListing(), listing)
      })

      void test('reordering listing images succeeds', async () => {
        const first = await addImage(1)
        const second = await addImage(2)

        const response = await update([
          { id: first.id, displayOrder: 2 },
          { id: second.id, displayOrder: 1 },
        ])
        assert.equal(response.status, 200)
        const listing = (await response.json()) as ListingDetailsResponse
        assert.deepEqual(
          listing.images.map(({ id, displayOrder }) => ({ id, displayOrder })),
          [
            { id: second.id, displayOrder: 1 },
            { id: first.id, displayOrder: 2 },
          ]
        )
        const current = await readListing()
        assert.deepEqual(
          current.images.map(({ id, displayOrder }) => ({ id, displayOrder })),
          [
            { id: second.id, displayOrder: 1 },
            { id: first.id, displayOrder: 2 },
          ]
        )
      })

      void test('updating images rejects unknown IDs without changing the listing', async () => {
        await addImage(1)
        const original = await readListing()

        // Unknown IDs are rejected before they can reach a database write.
        for (const id of [
          '999',
          '0',
          '01',
          'not-an-id',
          '9223372036854775808',
        ]) {
          const response = await update(
            [{ id, displayOrder: 1 }],
            'Must not be saved'
          )
          assert.equal(response.status, 404)
          assert.deepEqual(await response.json(), {
            error: 'error.listing.image.notFound',
          })
          assert.deepEqual(await readListing(), original)
        }
      })

      void test('updating images with duplicate display orders fails without changing the listing', async () => {
        const first = await addImage(1)
        const second = await addImage(2)
        const original = await readListing()

        const response = await update(
          [
            { id: first.id, displayOrder: 1 },
            { id: second.id, displayOrder: 1 },
          ],
          'Must not be saved'
        )
        assert.equal(response.status, 400)
        const body = (await response.json()) as {
          errors: { path: string[]; message: string }[]
        }
        assert.ok(
          body.errors.some(
            (error) =>
              error.message === 'error.listing.image.duplicate.displayOrder' &&
              error.path[0] === 'images'
          )
        )
        assert.deepEqual(await readListing(), original)
      })

      void test('updating images fails when an upload is missing and preserves pending uploads', async () => {
        const first = await addImage(1)
        const original = await readListing()
        const replacement = await presign()
        await upload(replacement)
        const missing = await presign()

        const response = await update(
          [
            { id: first.id, objectKey: replacement.objectKey, displayOrder: 1 },
            { objectKey: missing.objectKey, displayOrder: 2 },
          ],
          'Must not be saved'
        )
        assert.equal(response.status, 409)
        assert.deepEqual(await response.json(), {
          error: 'error.listing.image.notUploaded',
        })
        assert.deepEqual(await readListing(), original)
        const pending = await pool.query<{ object_key: string }>(
          'SELECT object_key FROM rental_listing_image_upload'
        )
        assert.deepEqual(
          new Set(pending.rows.map((row) => row.object_key)),
          new Set([replacement.objectKey, missing.objectKey])
        )
        assert.equal(
          (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
          0
        )
      })

      void test('updating a listing rolls back when image orders conflict at commit', async () => {
        const first = await addImage(1)
        const second = await addImage(2)
        const original = await readListing()
        const replacement = await presign()
        await upload(replacement)
        // Force a deferred constraint failure after the API has staged its changes.
        await pool.query(`
          CREATE FUNCTION conflict_listing_image_order() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            UPDATE rental_listing_image SET display_order = 1
              WHERE rental_listing_id = NEW.id;
            RETURN NEW;
          END $$;
          CREATE TRIGGER conflict_listing_image_order BEFORE UPDATE ON rental_listing
            FOR EACH ROW EXECUTE FUNCTION conflict_listing_image_order();
        `)
        try {
          const response = await update(
            [
              {
                id: first.id,
                objectKey: replacement.objectKey,
                displayOrder: 1,
              },
              { id: second.id, displayOrder: 2 },
            ],
            'Must roll back'
          )
          assert.equal(response.status, 409)
          assert.deepEqual(await response.json(), {
            error: 'error.listing.image.conflict',
          })
          assert.deepEqual(await readListing(), original)
          const pending = await pool.query<{ object_key: string }>(
            'SELECT object_key FROM rental_listing_image_upload'
          )
          assert.deepEqual(pending.rows, [
            { object_key: replacement.objectKey },
          ])
          assert.equal(
            (await pool.query('SELECT * FROM listing_image_cleanup')).rowCount,
            0
          )
          const image = await pool.query<{ image_path: string }>(
            'SELECT image_path FROM rental_listing_image WHERE id = $1',
            [first.id]
          )
          await head(image.rows[0].image_path)
        } finally {
          await pool.query(
            'DROP TRIGGER conflict_listing_image_order ON rental_listing; DROP FUNCTION conflict_listing_image_order()'
          )
        }
      })

      void test('updating a listing rejects an image removed by a concurrent update', async () => {
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
          assert.deepEqual(
            listing.images.map(({ id, displayOrder }) => ({
              id,
              displayOrder,
            })),
            [{ id: second.id, displayOrder: 1 }]
          )
        } finally {
          await barrier.query('ROLLBACK')
          barrier.release()
          await Promise.allSettled(pending)
          await pool.query(
            'DROP TRIGGER pause_listing_update ON rental_listing; DROP FUNCTION pause_listing_update()'
          )
        }
      })
    })

    void describe('cleanup', () => {
      beforeEach(createListing)

      void test('retired image objects are deleted only after the cleanup grace period', async () => {
        const first = await addImage(1)
        await addImage(2)
        const imagePaths = await pool.query<{
          id: string
          image_path: string
        }>(
          `SELECT id, image_path
           FROM rental_listing_image
           WHERE rental_listing_id = 1
           ORDER BY id`
        )
        const replacement = await presign()
        await upload(replacement)
        assert.equal(
          (
            await update([
              {
                id: first.id,
                objectKey: replacement.objectKey,
                displayOrder: 1,
              },
            ])
          ).status,
          200
        )
        const queued = await pool.query<{ object_key: string }>(
          'SELECT object_key FROM listing_image_cleanup'
        )
        assert.deepEqual(
          new Set(queued.rows.map((row) => row.object_key)),
          new Set(imagePaths.rows.map((row) => row.image_path))
        )

        const { cleanUpListingImages } =
          await import('../../repositories/imageCleanupRepository.js')
        const { deleteImageObject } =
          await import('../../services/imageService.js')
        await cleanUpListingImages(deleteImageObject)
        for (const { image_path: imagePath } of imagePaths.rows) {
          await head(imagePath)
        }
        // Advance eligibility in the isolated database instead of waiting 15 minutes.
        await pool.query(
          "UPDATE listing_image_cleanup SET available_after = CURRENT_TIMESTAMP - INTERVAL '1 second'"
        )
        await cleanUpListingImages(deleteImageObject)
        for (const { image_path: key } of imagePaths.rows) {
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
    })
  }
)

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
import type { Pool, PoolClient } from 'pg'

import type {
  ApplicantsResponse,
  MatchResponse,
} from '../../types/listingInteraction.js'

import type {
  ListingDetails,
  ListingDetailsResponse,
  ListingImage,
  ListingImageInput,
  ListingImageResponse,
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

const imageWithoutSignature = (image: ListingImageResponse) => {
  const url = new URL(image.imageUrl)
  // Fresh signatures can differ even when they refer to the same stored object.
  url.search = ''
  return { ...image, imageUrl: url.href }
}

const assertListingUnchanged = (
  actual: ListingDetailsResponse,
  expected: ListingDetailsResponse
) => {
  assert.deepEqual(
    { ...actual, images: actual.images.map(imageWithoutSignature) },
    { ...expected, images: expected.images.map(imageWithoutSignature) }
  )
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

const apiRequest = async (
  userId: string | undefined,
  method: string,
  path: string,
  body?: unknown,
  authorization?: string
) => {
  const { createAccessToken } = await import('../../utils/jwt.js')
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

const preference = (tenantId = '2', liked = true, listingId = '1') =>
  apiRequest(tenantId, 'PUT', `/listing/${listingId}/preference`, { liked })
const decision = (
  tenantId = '2',
  value = 'ACCEPTED',
  listingId = '1',
  ownerId = '1'
) =>
  apiRequest(
    ownerId,
    'PUT',
    `/listing/${listingId}/applicants/${tenantId}/decision`,
    { decision: value }
  )
const applicants = async (listingId = '1') => {
  const response = await apiRequest(
    '1',
    'GET',
    `/listing/${listingId}/applicants`
  )
  assert.equal(response.status, 200)
  return (await response.json()) as ApplicantsResponse
}
const matches = async (tenantId = '2') => {
  const response = await apiRequest(tenantId, 'GET', '/match')
  assert.equal(response.status, 200)
  return (await response.json()) as MatchResponse[]
}

// Pause the first write while it holds the parent listing lock, then prove that
// the competing HTTP request waits on that same lock before releasing it.
const raceInteractions = async (
  table: 'rental_listing_preference' | 'rental_listing_applicant_decision',
  first: () => Promise<Response>,
  second: () => Promise<Response>
) => {
  await pool.query(`
    CREATE FUNCTION pause_interaction() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(135791);
      RETURN NEW;
    END $$;
    CREATE TRIGGER pause_interaction BEFORE INSERT ON ${table}
      FOR EACH ROW EXECUTE FUNCTION pause_interaction();
  `)
  const barrier = await pool.connect()
  const pending: Promise<Response>[] = []
  try {
    await barrier.query('BEGIN')
    await barrier.query('SELECT pg_advisory_xact_lock(135791)')
    const {
      rows: [{ pid }],
    } = await barrier.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    pending.push(first())
    const firstPid = await waitForBlockedConnection(pid)
    pending.push(second())
    assert.notEqual(await waitForBlockedConnection(firstPid), firstPid)
    await barrier.query('COMMIT')
    return await Promise.all(pending)
  } finally {
    await barrier.query('ROLLBACK')
    barrier.release()
    await Promise.allSettled(pending)
    await pool.query(
      `DROP TRIGGER pause_interaction ON ${table}; DROP FUNCTION pause_interaction()`
    )
  }
}

const withLegacySchema = async (
  operation: (client: PoolClient, migration: string) => Promise<void>
) => {
  const client = await pool.connect()
  const directory = new URL('../../../../migrations/', import.meta.url)
  try {
    await client.query(
      'BEGIN; CREATE SCHEMA legacy_migration; SET LOCAL search_path TO legacy_migration'
    )
    for (const filename of [
      'V1__init.sql',
      'V2__listing_images_and_readiness.sql',
      'V3__listing_image_updates.sql',
    ]) {
      await client.query(await readFile(new URL(filename, directory), 'utf8'))
    }
    await client.query(`
      INSERT INTO "user" (first_name, last_name, email, password, role) VALUES
        ('Owner', 'One', 'owner@example.com', 'unused', 'LANDLORD'),
        ('Tenant', 'Two', 'tenant@example.com', 'unused', 'TENANT'),
        ('Owner', 'Three', 'other@example.com', 'unused', 'LANDLORD');
      INSERT INTO rental_listing (owner_id, monthly_price, square_meters, neighborhood, city, available_from, extra_costs, rooms)
        VALUES (1, 1000, 40, 'Kallio', 'Helsinki', '2026-11-01', '', 'STUDIO');
      INSERT INTO "match" (tenant_user_id, landlord_user_id, rental_listing_id) VALUES (2, 1, 1);
    `)
    await operation(
      client,
      await readFile(
        new URL('V4__listing_preferences_and_matches.sql', directory),
        'utf8'
      )
    )
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

void describe(
  'listing router tests',
  // Include time for cold image pulls and container startup in the suite budget.
  { concurrency: false, timeout: 360_000 },
  () => {
    void describe('preferences and matches', () => {
      beforeEach(async () => {
        await pool.query(`
          INSERT INTO "user" (first_name, last_name, email, password, role, picture_path) VALUES
            ('Ada', 'Tenant', 'ada@example.com', 'private-tenant-password', 'TENANT', 'profiles/2/avatar.png'),
            ('Ben', 'Tenant', 'ben@example.com', 'private-tenant-password', 'TENANT', NULL),
            ('Cal', 'Tenant', 'cal@example.com', 'private-tenant-password', 'TENANT', NULL),
            ('Other', 'Owner', 'other@example.com', 'private-owner-password', 'LANDLORD', NULL);
        `)
        await seedPublishedListing(1, 'listings/1/first.png')
      })

      void test('likes and dislikes persist once, cannot change, and both disappear from the feed', async () => {
        await seedPublishedListing(1, 'listings/2/second.png')
        for (const [listingId, liked] of [
          ['1', true],
          ['2', false],
        ] as const) {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const response = await preference('2', liked, listingId)
            assert.equal(response.status, 200)
            assert.deepEqual(await response.json(), {
              listingId,
              tenantId: '2',
              liked,
            })
          }
          assert.equal((await preference('2', !liked, listingId)).status, 409)
        }
        const stored = await pool.query(
          'SELECT rental_listing_id, tenant_user_id, liked FROM rental_listing_preference ORDER BY rental_listing_id'
        )
        assert.deepEqual(stored.rows, [
          { rental_listing_id: '1', tenant_user_id: '2', liked: true },
          { rental_listing_id: '2', tenant_user_id: '2', liked: false },
        ])
        assert.deepEqual(
          await (await apiRequest('2', 'GET', '/listing')).json(),
          []
        )
        assert.deepEqual(await matches(), [])
      })

      void test('pending applicants expose only profile fields, decisions update counts and preserve likes', async () => {
        assert.deepEqual(await applicants(), { applicants: [], count: 0 })
        await preference('2')
        await preference('3')
        await preference('4', false)
        assert.deepEqual(await applicants(), {
          applicants: [
            {
              tenantId: '2',
              firstName: 'Ada',
              lastName: 'Tenant',
              picturePath: 'profiles/2/avatar.png',
            },
            {
              tenantId: '3',
              firstName: 'Ben',
              lastName: 'Tenant',
              picturePath: null,
            },
          ],
          count: 2,
        })
        assert.equal((await decision('4')).status, 409)
        assert.equal((await decision('999')).status, 404)
        assert.equal((await decision('2', 'DECLINED')).status, 200)
        assert.equal((await decision('2', 'DECLINED')).status, 200)
        assert.equal((await decision('2')).status, 409)
        assert.equal((await applicants()).count, 1)
        const accepted = await decision('3')
        assert.equal(accepted.status, 200)
        assert.deepEqual(await accepted.json(), {
          listingId: '1',
          tenantId: '3',
          decision: 'ACCEPTED',
        })
        assert.equal((await decision('3', 'DECLINED')).status, 409)
        assert.deepEqual(await applicants(), { applicants: [], count: 0 })
        assert.deepEqual(await matches('2'), [])
        assert.deepEqual(await matches('4'), [])
        assert.equal((await matches('3')).length, 1)
        const stored = await pool.query(
          'SELECT liked FROM rental_listing_preference WHERE tenant_user_id = 2'
        )
        assert.deepEqual(stored.rows, [{ liked: true }])
        assert.deepEqual(
          await (await apiRequest('2', 'GET', '/listing')).json(),
          []
        )
      })

      void test('accepting multiple applicants preserves publication and other pending likes', async () => {
        for (const tenant of ['2', '3', '4']) await preference(tenant)
        await decision('2')
        const timestamp = (await matches('2'))[0].createdAt
        await decision('2')
        assert.equal((await matches('2'))[0].createdAt, timestamp)
        await decision('3')
        assert.deepEqual(
          (await applicants()).applicants.map(({ tenantId }) => tenantId),
          ['4']
        )
        assert.equal((await matches('2')).length, 1)
        assert.equal((await matches('3')).length, 1)
        assert.equal((await readListing()).published, true)
      })

      void test('matches return only accepted listings, newest first, with exact contacts and ordered signed images', async () => {
        await seedPublishedListing(5, 'listings/2/second.png')
        await seedPublishedListing(1, 'listings/3/pending.png')
        await seedPublishedListing(1, 'listings/4/declined.png')
        await seedPublishedListing(1, 'listings/5/disliked.png')
        await pool.query(`
          UPDATE "user" SET phone = '+358401234567' WHERE id = 5;
          INSERT INTO rental_listing_image (rental_listing_id, image_path, display_order)
            VALUES (2, 'listings/2/last.png', 3), (2, 'listings/2/middle.png', 2);
        `)
        for (const id of ['1', '2', '3', '4']) await preference('2', true, id)
        await preference('2', false, '5')
        await decision('2', 'ACCEPTED', '1')
        await decision('2', 'DECLINED', '4')
        await decision('2', 'ACCEPTED', '2', '5')
        const result = await matches()
        assert.deepEqual(
          result.map(({ listingId }) => listingId),
          ['2', '1']
        )
        assert.ok(
          Date.parse(result[0].createdAt) >= Date.parse(result[1].createdAt)
        )
        assert.deepEqual(Object.keys(result[0]).sort(), [
          'createdAt',
          'landlord',
          'listing',
          'listingId',
        ])
        assert.deepEqual(result[0].landlord, {
          firstName: 'Other',
          lastName: 'Owner',
          email: 'other@example.com',
          phone: '+358401234567',
        })
        assert.deepEqual(result[1].landlord, {
          firstName: 'Owner',
          lastName: 'One',
          email: 'owner@example.com',
          phone: null,
        })
        assert.deepEqual(
          Object.keys(result[0].listing).sort(),
          [
            'id',
            'ownerId',
            'createdAt',
            'monthlyPrice',
            'squareMeters',
            'neighborhood',
            'city',
            'availableFrom',
            'extraCosts',
            'rooms',
            'published',
            'images',
          ].sort()
        )
        assert.equal(result[0].listing.id, '2')
        assert.equal(result[0].listing.ownerId, '5')
        assert.equal(result[0].listing.monthlyPrice, '1000.00')
        assert.equal(result[0].listing.published, true)
        assert.deepEqual(
          result[0].listing.images.map(({ displayOrder }) => displayOrder),
          [1, 2, 3]
        )
        for (const image of result[0].listing.images) {
          assert.deepEqual(Object.keys(image).sort(), [
            'displayOrder',
            'id',
            'imageUrl',
          ])
          assert.equal(
            new URL(image.imageUrl).searchParams.get('X-Amz-Expires'),
            '900'
          )
        }
        assert.deepEqual(await matches('3'), [])
        assert.deepEqual(
          await (await apiRequest('3', 'GET', '/match?tenantId=2')).json(),
          []
        )
        // A lower listing ID can have the newest match; ID is only a tie-breaker.
        await pool.query(
          `UPDATE "match" SET created_at = CASE rental_listing_id
             WHEN 1 THEN '2026-10-22T10:00:00Z'::timestamptz
             ELSE '2026-10-21T10:00:00Z'::timestamptz END`
        )
        assert.deepEqual(
          (await matches()).map(({ listingId }) => listingId),
          ['1', '2']
        )
        await pool.query('UPDATE "match" SET created_at = $1', [
          '2026-10-21T10:00:00Z',
        ])
        assert.deepEqual(
          (await matches()).map(({ listingId }) => listingId),
          ['2', '1']
        )
      })

      void test('unpublication preserves contacts and identical retries but rejects new interactions', async () => {
        await preference('2')
        await preference('3')
        await preference('4')
        await decision('2')
        await decision('4', 'DECLINED')
        const original = (await matches())[0]
        assert.equal((await update([])).status, 200)
        assert.equal((await preference('2')).status, 200)
        assert.equal((await decision('2')).status, 200)
        assert.equal((await decision('4', 'DECLINED')).status, 200)
        assert.equal((await decision('3')).status, 409)
        assert.equal((await decision('4')).status, 409)
        assert.equal((await preference('2', false)).status, 409)
        const result = (await matches())[0]
        assert.equal(result.createdAt, original.createdAt)
        assert.equal(result.listing.published, false)
        assert.deepEqual(result.listing.images, [])
        assert.deepEqual(result.landlord, original.landlord)
        assert.equal((await applicants()).count, 1)
        await seedPublishedListing(1, 'listings/2/second.png')
        await pool.query(
          'UPDATE rental_listing SET published = FALSE WHERE id = 2'
        )
        assert.equal((await preference('2', true, '2')).status, 409)
        assert.equal((await preference('2', false, '2')).status, 409)
        await pool.query(
          'UPDATE rental_listing SET published = TRUE WHERE id = 1'
        )
        // Defend against a published flag without any finalized images, too.
        assert.equal((await decision('3')).status, 409)
      })

      void test('new preferences reject a published listing without finalized images', async () => {
        await pool.query(
          'DELETE FROM rental_listing_image WHERE rental_listing_id = 1'
        )
        assert.equal((await preference()).status, 409)
        assert.equal(
          (await pool.query('SELECT * FROM rental_listing_preference'))
            .rowCount,
          0
        )
      })

      void test('all interaction endpoints enforce authentication, roles and ownership', async () => {
        const endpoints = [
          {
            method: 'PUT',
            path: '/listing/1/preference',
            body: { liked: true },
            wrongRole: '1',
          },
          {
            method: 'GET',
            path: '/listing/1/applicants',
            body: undefined,
            wrongRole: '2',
          },
          {
            method: 'PUT',
            path: '/listing/1/applicants/2/decision',
            body: { decision: 'ACCEPTED' },
            wrongRole: '2',
          },
          { method: 'GET', path: '/match', body: undefined, wrongRole: '1' },
        ]
        for (const endpoint of endpoints) {
          for (const auth of [undefined, 'Bearer invalid-token']) {
            assert.equal(
              (
                await apiRequest(
                  undefined,
                  endpoint.method,
                  endpoint.path,
                  endpoint.body,
                  auth
                )
              ).status,
              401
            )
          }
          assert.equal(
            (
              await apiRequest(
                '999',
                endpoint.method,
                endpoint.path,
                endpoint.body
              )
            ).status,
            401
          )
          assert.equal(
            (
              await apiRequest(
                endpoint.wrongRole,
                endpoint.method,
                endpoint.path,
                endpoint.body
              )
            ).status,
            403
          )
        }
        await preference()
        assert.equal(
          (await apiRequest('5', 'GET', '/listing/1/applicants')).status,
          404
        )
        assert.equal((await decision('2', 'ACCEPTED', '1', '5')).status, 404)
        await decision()
        assert.equal((await decision('2', 'ACCEPTED', '1', '5')).status, 404)
        assert.equal((await preference('2', true, '999')).status, 404)
        assert.equal(
          (await apiRequest('1', 'GET', '/listing/999/applicants')).status,
          404
        )
        assert.equal((await decision('2', 'ACCEPTED', '999')).status, 404)
      })

      void test('invalid bodies and path IDs return 400; protected body fields cannot select the actor', async () => {
        for (const body of [
          undefined,
          null,
          [],
          {},
          { liked: 'true' },
          { liked: 1 },
        ]) {
          assert.equal(
            (await apiRequest('2', 'PUT', '/listing/1/preference', body))
              .status,
            400
          )
        }
        for (const body of [
          undefined,
          null,
          [],
          {},
          { decision: 'accepted' },
          { decision: true },
        ]) {
          assert.equal(
            (
              await apiRequest(
                '1',
                'PUT',
                '/listing/1/applicants/2/decision',
                body
              )
            ).status,
            400
          )
        }
        for (const id of [
          '0',
          '-1',
          '1.5',
          '1e2',
          'abc',
          '01',
          '9223372036854775808',
        ]) {
          assert.equal((await preference('2', true, id)).status, 400)
          assert.equal(
            (await apiRequest('1', 'GET', `/listing/${id}/applicants`)).status,
            400
          )
          assert.equal((await decision(id)).status, 400)
        }
        const response = await apiRequest('2', 'PUT', '/listing/1/preference', {
          liked: true,
          tenantId: '3',
          ownerId: '5',
        })
        assert.deepEqual(await response.json(), {
          listingId: '1',
          tenantId: '2',
          liked: true,
        })
        assert.equal(
          (
            await apiRequest('1', 'PUT', '/listing/1/applicants/2/decision', {
              decision: 'ACCEPTED',
              tenantId: '3',
              ownerId: '5',
            })
          ).status,
          200
        )
        assert.equal((await matches('2')).length, 1)
        assert.deepEqual(await matches('3'), [])
      })

      void test('BIGINT IDs survive preferences, applicants, decisions and matches without precision loss', async () => {
        const id = '9007199254740993'
        await pool.query('UPDATE "user" SET id = $1 WHERE id = 2', [id])
        await pool.query(
          'DELETE FROM rental_listing_image WHERE rental_listing_id = 1'
        )
        await pool.query('UPDATE rental_listing SET id = $1 WHERE id = 1', [id])
        await pool.query(
          'INSERT INTO rental_listing_image (rental_listing_id, image_path, display_order) VALUES ($1, $2, 1)',
          [id, `listings/${id}/image.png`]
        )
        assert.equal((await preference(id, true, id)).status, 200)
        assert.equal((await applicants(id)).applicants[0].tenantId, id)
        assert.equal((await decision(id, 'ACCEPTED', id)).status, 200)
        assert.equal((await matches(id))[0].listingId, id)
        assert.equal((await matches(id))[0].listing.id, id)
      })

      for (const same of [true, false]) {
        void test(`concurrent ${same ? 'identical' : 'opposite'} preferences keep one stored value`, async () => {
          const responses = await raceInteractions(
            'rental_listing_preference',
            () => preference(),
            () => preference('2', same)
          )
          assert.deepEqual(
            responses.map(({ status }) => status),
            [200, same ? 200 : 409]
          )
          assert.deepEqual(
            (await pool.query('SELECT liked FROM rental_listing_preference'))
              .rows,
            [{ liked: true }]
          )
        })
      }

      for (const [first, second] of [
        ['ACCEPTED', 'ACCEPTED'],
        ['DECLINED', 'DECLINED'],
        ['ACCEPTED', 'DECLINED'],
        ['DECLINED', 'ACCEPTED'],
      ]) {
        void test(`concurrent ${first}/${second} decisions have only one outcome`, async () => {
          await preference()
          const responses = await raceInteractions(
            'rental_listing_applicant_decision',
            () => decision('2', first),
            () => decision('2', second)
          )
          assert.deepEqual(
            responses.map(({ status }) => status),
            [200, first === second ? 200 : 409]
          )
          assert.deepEqual(
            (
              await pool.query(
                'SELECT decision FROM rental_listing_applicant_decision'
              )
            ).rows,
            [{ decision: first }]
          )
          assert.equal((await matches()).length, first === 'ACCEPTED' ? 1 : 0)
          assert.deepEqual(
            (await pool.query('SELECT liked FROM rental_listing_preference'))
              .rows,
            [{ liked: true }]
          )
        })
      }

      void test('a failed commit rolls back both acceptance and match, allowing a clean retry', async (t) => {
        await preference()
        t.mock.method(console, 'error', () => {})
        await pool.query(`
          CREATE FUNCTION reject_match_commit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'test-only commit failure'; END $$;
          CREATE CONSTRAINT TRIGGER reject_match_commit AFTER INSERT ON "match"
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_match_commit();
        `)
        try {
          const response = await decision()
          assert.equal(response.status, 500)
          assert.deepEqual(await response.json(), {
            error: 'error.server.unexpected',
          })
          assert.equal((await pool.query('SELECT * FROM "match"')).rowCount, 0)
          assert.equal(
            (
              await pool.query(
                'SELECT * FROM rental_listing_applicant_decision'
              )
            ).rowCount,
            0
          )
          assert.equal((await applicants()).count, 1)
        } finally {
          await pool.query(
            'DROP TRIGGER reject_match_commit ON "match"; DROP FUNCTION reject_match_commit()'
          )
        }
        assert.equal((await decision()).status, 200)
        assert.equal((await matches()).length, 1)
      })

      void test('unpublication waits for acceptance and preserves the committed match', async () => {
        await preference()
        const responses = await raceInteractions(
          'rental_listing_applicant_decision',
          () => decision(),
          () => update([])
        )
        assert.deepEqual(
          responses.map(({ status }) => status),
          [200, 200]
        )
        assert.equal((await matches())[0].listing.published, false)
      })

      void test('decisions waiting behind unpublication use its committed state', async () => {
        await preference()
        const client = await pool.connect()
        const pending: Promise<Response>[] = []
        try {
          await client.query('BEGIN')
          await client.query(
            'UPDATE rental_listing SET published = FALSE WHERE id = 1'
          )
          const {
            rows: [{ pid }],
          } = await client.query<{ pid: number }>(
            'SELECT pg_backend_pid() AS pid'
          )
          pending.push(decision())
          await waitForBlockedConnection(pid)
          await client.query('COMMIT')
          assert.equal((await pending[0]).status, 409)
          assert.deepEqual(await matches(), [])
          assert.equal((await applicants()).count, 1)
        } finally {
          await client.query('ROLLBACK')
          client.release()
          await Promise.allSettled(pending)
        }
      })

      void test('database constraints reject dislike decisions, non-accepted matches and the wrong landlord', async () => {
        await preference('2', false)
        await assert.rejects(
          pool.query(
            "INSERT INTO rental_listing_applicant_decision (tenant_user_id, rental_listing_id, decision) VALUES (2, 1, 'ACCEPTED')"
          ),
          { code: '23503' }
        )
        await preference('3')
        await decision('3', 'DECLINED')
        await assert.rejects(
          pool.query(
            'INSERT INTO "match" (tenant_user_id, rental_listing_id, landlord_user_id) VALUES (3, 1, 1)'
          ),
          { code: '23503' }
        )
        await preference('4')
        await pool.query(
          "INSERT INTO rental_listing_applicant_decision (tenant_user_id, rental_listing_id, decision) VALUES (4, 1, 'ACCEPTED')"
        )
        await assert.rejects(
          pool.query(
            'INSERT INTO "match" (tenant_user_id, rental_listing_id, landlord_user_id) VALUES (4, 1, 5)'
          ),
          { code: '23503' }
        )
      })

      for (const deletion of [
        'DELETE FROM rental_listing WHERE id = 1',
        'DELETE FROM "user" WHERE id = 1',
        'DELETE FROM "user" WHERE id = 2',
      ]) {
        void test(`dependent interaction records cascade: ${deletion}`, async () => {
          await preference()
          await decision()
          await pool.query(deletion)
          for (const table of [
            'rental_listing_preference',
            'rental_listing_applicant_decision',
            '"match"',
          ]) {
            assert.equal(
              (await pool.query(`SELECT * FROM ${table}`)).rowCount,
              0
            )
          }
        })
      }
    })

    void describe('legacy match migration', () => {
      void test('preserves legacy matches, backfills missing likes and uses migration time', async () => {
        await withLegacySchema(async (client, migration) => {
          await client.query(migration)
          assert.deepEqual(
            (await client.query('SELECT liked FROM rental_listing_preference'))
              .rows,
            [{ liked: true }]
          )
          assert.deepEqual(
            (
              await client.query(
                'SELECT decision FROM rental_listing_applicant_decision'
              )
            ).rows,
            [{ decision: 'ACCEPTED' }]
          )
          const result = await client.query(
            'SELECT tenant_user_id, landlord_user_id, rental_listing_id, created_at = CURRENT_TIMESTAMP AS migration_time FROM "match"'
          )
          assert.deepEqual(result.rows, [
            {
              tenant_user_id: '2',
              landlord_user_id: '1',
              rental_listing_id: '1',
              migration_time: true,
            },
          ])
        })
      })

      void test('preserves existing likes without creating duplicate preferences', async () => {
        await withLegacySchema(async (client, migration) => {
          await client.query(
            'INSERT INTO rental_listing_preference VALUES (2, 1, TRUE)'
          )
          await client.query(migration)
          assert.equal(
            (await client.query('SELECT * FROM rental_listing_preference'))
              .rowCount,
            1
          )
        })
      })

      for (const contradiction of [
        'INSERT INTO rental_listing_preference VALUES (2, 1, FALSE)',
        'UPDATE "match" SET landlord_user_id = 3',
        'UPDATE "user" SET role = \'LANDLORD\' WHERE id = 2',
        'UPDATE "user" SET role = \'TENANT\' WHERE id = 1',
        'INSERT INTO "match" VALUES (2, 3, 1)',
      ]) {
        void test(`rejects contradictory legacy data: ${contradiction}`, async () => {
          await withLegacySchema(async (client, migration) => {
            await client.query(contradiction)
            await client.query('SAVEPOINT before_migration')
            await assert.rejects(
              client.query(migration),
              /Cannot migrate contradictory legacy matches/
            )
            await client.query('ROLLBACK TO SAVEPOINT before_migration')
            assert.equal(
              (
                await client.query<{ table_name: string | null }>(
                  "SELECT to_regclass('rental_listing_applicant_decision') AS table_name"
                )
              ).rows[0].table_name,
              null
            )
          })
        })
      }
    })

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
        const createdAt = '2026-10-19'
        // Pin the stored date so this retrieval assertion is independent of CURRENT_DATE.
        await pool.query(
          'UPDATE rental_listing SET created_at = $1 WHERE id = $2',
          [createdAt, '1']
        )
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
        assert.equal(listing.createdAt, createdAt)
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
        assertListingUnchanged(await readListing(), original)
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
        const finalized = (await response.json()) as ListingImageResponse
        assert.deepEqual(
          (await readListing()).images.map(imageWithoutSignature),
          [imageWithoutSignature(finalized)]
        )
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
          assertListingUnchanged(await readListing(), original)
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
        assertListingUnchanged(await readListing(), original)
      })

      void test('updating images fails when an upload is missing and preserves pending uploads', async () => {
        const first = await addImage(1)
        const original = await readListing()
        // Cross a signing-second boundary to exercise comparison of refreshed URLs.
        await delay(1_100)
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
        assertListingUnchanged(await readListing(), original)
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
          assertListingUnchanged(await readListing(), original)
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

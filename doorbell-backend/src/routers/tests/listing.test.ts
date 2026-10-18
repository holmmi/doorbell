import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile, readdir } from 'node:fs/promises'
import type { Server } from 'node:http'
import { after, before, beforeEach, mock, test } from 'node:test'

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { PGlite } from '@electric-sql/pglite'

import type {
  ListingDetails,
  ListingImageInput,
  PresignedImage,
} from '../../types/listing.js'

Object.assign(process.env, {
  JWT_SECRET: 'test-only-listing-secret',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_NAME: 'listing_test',
  DB_USER: 'listing_test',
  DB_PASSWORD: 'test-only-password',
  DOTENV_CONFIG_PATH: '__test_missing_env__',
  S3_ENDPOINT: 'http://127.0.0.1:9090',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'test',
  S3_SECRET_KEY: 'test',
  S3_BUCKET: 'listing-test',
  S3_FORCE_PATH_STYLE: 'true',
})

const { pool } = await import('../../config/database.js')
const { default: app } = await import('../../app.js')
const { createAccessToken } = await import('../../utils/jwt.js')
const { cleanUpListingImages } =
  await import('../../repositories/imageCleanupRepository.js')
const { deleteImageObject } = await import('../../services/imageService.js')
const { createListingImage, withOwnedListing } =
  await import('../../repositories/listingRepository.js')

// Run the actual repository SQL and Flyway migrations on PostgreSQL in WASM.
// Match node-postgres: BIGINT and NUMERIC values are returned as strings.
const db = new PGlite({
  parsers: { 20: (value) => value, 1700: (value) => value },
})
const objects = new Map<
  string,
  { ContentType: string; ContentLength: number }
>()
const storageCalls: string[] = []
let failQuery: RegExp | undefined
let failStorage = false
let server: Server
let baseUrl: string
const oldKey = 'listings/1/original.png'
const secondKey = 'listings/1/second.png'
const listingInput = {
  neighborhood: 'Kallio',
  city: 'Helsinki',
  availableFrom: '2026-11-01',
  rent: 1250,
  squareMeters: 42.5,
  rooms: 'ONE_ROOM_AND_KITCHEN',
}

before(async () => {
  const migrations = new URL('../../../../migrations/', import.meta.url)
  for (const filename of (await readdir(migrations)).sort()) {
    await db.exec(await readFile(new URL(filename, migrations), 'utf8'))
  }
  const query = async (sql: string, values?: unknown[]) => {
    if (failQuery?.test(sql)) {
      failQuery = undefined
      throw new Error('Simulated database failure')
    }
    const result = await db.query(sql, values)
    return { ...result, rowCount: result.affectedRows ?? result.rows.length }
  }
  mock.method(pool, 'query', query)
  mock.method(pool, 'connect', () =>
    Promise.resolve({ query, release: () => {} })
  )
  mock.method(
    S3Client.prototype,
    'send',
    (command: HeadObjectCommand | DeleteObjectCommand) => {
      const key = command.input.Key as string
      storageCalls.push(key)
      if (failStorage) return Promise.reject(new Error('Storage unavailable'))
      if (command instanceof DeleteObjectCommand) {
        objects.delete(key)
        return Promise.resolve({})
      }
      assert.ok(command instanceof HeadObjectCommand)
      const object = objects.get(key)
      if (!object) {
        return Promise.reject(
          new S3ServiceException({
            name: 'NotFound',
            $fault: 'client',
            $metadata: { httpStatusCode: 404 },
          })
        )
      }
      return Promise.resolve(object)
    }
  )
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseUrl = `http://127.0.0.1:${address.port}/api/listing`
})

beforeEach(async () => {
  failQuery = undefined
  failStorage = false
  objects.clear()
  objects.set(oldKey, { ContentType: 'image/png', ContentLength: 10 })
  objects.set(secondKey, { ContentType: 'image/png', ContentLength: 20 })
  storageCalls.length = 0
  await db.exec(`
    TRUNCATE "user", rental_listing, rental_listing_image,
      rental_listing_image_upload, listing_image_cleanup RESTART IDENTITY CASCADE;
    INSERT INTO "user" (id, first_name, last_name, email, password, role) VALUES
      (1, 'Owner', 'One', 'one@example.com', 'unused', 'LANDLORD'),
      (2, 'Owner', 'Two', 'two@example.com', 'unused', 'LANDLORD'),
      (3, 'Tenant', 'Three', 'three@example.com', 'unused', 'TENANT');
    INSERT INTO rental_listing (
      owner_id, monthly_price, square_meters, neighborhood, city,
      available_from, extra_costs, rooms, published
    ) VALUES
      (1, 1000, 40, 'Original', 'Espoo', '2026-10-01', 'Water 20', 'STUDIO', TRUE),
      (2, 900, 30, 'Other', 'Turku', '2026-10-01', '', 'STUDIO', FALSE);
    INSERT INTO rental_listing_image (rental_listing_id, image_path, display_order)
      VALUES (1, '${oldKey}', 1), (1, '${secondKey}', 2),
             (2, 'listings/2/other.png', 1);
  `)
})

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
  mock.restoreAll()
  await pool.end()
  await db.close()
})

const request = (
  method: string,
  path: string,
  body?: unknown,
  userId: string | null = '1'
) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(userId
        ? { Authorization: `Bearer ${createAccessToken(userId)}` }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const update = (images?: ListingImageInput[]) =>
  request('PUT', '/1', { ...listingInput, ...(images ? { images } : {}) })

const readListing = async () => {
  const response = await request('GET', '/1')
  assert.equal(response.status, 200)
  return (await response.json()) as ListingDetails
}

const stageUpload = async (uploaded = true) => {
  const response = await request('POST', '/1/images/presign', {
    contentType: 'image/png',
  })
  assert.equal(response.status, 200)
  const upload = (await response.json()) as PresignedImage
  if (uploaded) {
    objects.set(upload.objectKey, {
      ContentType: 'image/png',
      ContentLength: 100,
    })
  }
  return upload
}

const snapshot = async () => {
  const result = await db.query(`
    SELECT
      (SELECT json_agg(t ORDER BY id) FROM rental_listing t) AS listings,
      (SELECT json_agg(t ORDER BY id) FROM rental_listing_image t) AS images,
      (SELECT json_agg(t ORDER BY object_key) FROM rental_listing_image_upload t) AS uploads,
      (SELECT json_agg(t ORDER BY object_key) FROM listing_image_cleanup t) AS cleanup
  `)
  return result.rows
}

for (const state of ['published', 'unpublished', 'incomplete']) {
  void test(`updates ${state} details while preserving readiness/publication rules`, async () => {
    if (state !== 'published') {
      await db.exec('UPDATE rental_listing SET published = FALSE WHERE id = 1')
    }
    if (state === 'incomplete') {
      await db.exec(
        'DELETE FROM rental_listing_image WHERE rental_listing_id = 1'
      )
    }
    const before = await readListing()
    const response = await update()
    assert.equal(response.status, 200)
    const listing = (await response.json()) as ListingDetails
    assert.equal(listing.neighborhood, 'Kallio')
    assert.equal(listing.city, 'Helsinki')
    assert.equal(listing.monthlyPrice, '1250.00')
    assert.equal(listing.squareMeters, '42.50')
    assert.equal(listing.rooms, 'ONE_ROOM_AND_KITCHEN')
    assert.equal(listing.extraCosts, '')
    assert.equal(listing.published, state === 'published')
    assert.equal(listing.ready, state !== 'incomplete')
    assert.equal(listing.createdAt, before.createdAt)
    assert.deepEqual(listing.images, before.images)
    assert.equal(storageCalls.length, 0)
  })
}

void test('update strips protected properties and supports optional extra costs', async () => {
  const response = await request('PUT', '/1', {
    ...listingInput,
    extraCosts: 'Water 25 EUR/month',
    ownerId: '2',
    published: false,
    ready: false,
    createdAt: '2000-01-01',
  })
  assert.equal(response.status, 200)
  const listing = (await response.json()) as ListingDetails
  assert.equal(listing.extraCosts, 'Water 25 EUR/month')
  assert.equal(listing.ownerId, '1')
  assert.equal(listing.published, true)
  assert.equal(listing.ready, true)
  assert.notEqual(listing.createdAt, '2000-01-01')
})

for (const [method, path, body] of [
  ['GET', '/1', undefined],
  ['PUT', '/1', listingInput],
  ['POST', '/1/images/presign', { contentType: 'image/png' }],
  ['POST', '/1/images', { objectKey: oldKey, displayOrder: 3 }],
  ['POST', '/1/publish', undefined],
] as const) {
  void test(`${method} ${path} enforces authentication, role and ownership`, async () => {
    const before = await snapshot()
    for (const [userId, status] of [
      [null, 401],
      ['3', 403],
      ['999', 403],
      ['2', 404],
    ] as const) {
      const response = await request(method, path, body, userId)
      assert.equal(response.status, status)
      if (status === 404) {
        assert.deepEqual(await response.json(), {
          error: 'error.listing.notFound',
        })
      }
    }
    assert.deepEqual(await snapshot(), before)
    assert.equal(storageCalls.length, 0)
  })
}

for (const id of [
  '999',
  'invalid',
  '0',
  '-1',
  '1.5',
  'NaN',
  'Infinity',
  '9007199254740992',
  '9007199254740993',
  '9223372036854775807',
  '9223372036854775808',
]) {
  void test(`missing or invalid listing ${id} returns 404`, async () => {
    const response = await request('PUT', `/${id}`, listingInput)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'error.listing.notFound' })
  })
}

void test('listing routes normalize numeric path IDs', async () => {
  for (const id of ['01', '1.0', '1e0', '0x1']) {
    const response = await request('PUT', `/${id}`, listingInput)
    assert.equal(response.status, 200)
    const listing = (await response.json()) as ListingDetails
    assert.equal(listing.id, '1')
  }
})

void test('listing routes accept the largest safe integer ID', async () => {
  const id = '9007199254740991'
  await db.query(
    `INSERT INTO rental_listing (
        id, owner_id, monthly_price, square_meters, neighborhood, city,
        available_from, extra_costs, rooms
      ) SELECT $1, owner_id, monthly_price, square_meters, neighborhood, city,
          available_from, extra_costs, rooms
        FROM rental_listing WHERE id = 1`,
    [id]
  )

  const readResponse = await request('GET', `/${id}`)
  assert.equal(readResponse.status, 200)
  const original = (await readResponse.json()) as ListingDetails
  assert.equal(original.id, id)

  const updateResponse = await request('PUT', `/${id}`, listingInput)
  assert.equal(updateResponse.status, 200)
  const updated = (await updateResponse.json()) as ListingDetails
  assert.equal(updated.id, id)
  assert.equal(updated.city, listingInput.city)

  const otherListing = await readListing()
  assert.equal(otherListing.city, 'Espoo')
})

void test('invalid listing details return validation errors without writing', async () => {
  const before = await snapshot()
  const response = await request('PUT', '/1', { rent: -1 })
  assert.equal(response.status, 400)
  assert.ok('errors' in ((await response.json()) as object))
  assert.deepEqual(await snapshot(), before)
})

void test('missing image references return a translation key without writing', async () => {
  const before = await snapshot()
  const response = await request('PUT', '/1', {
    ...listingInput,
    images: [{ displayOrder: 1 }],
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    errors: [
      {
        code: 'custom',
        path: ['images', 0],
        message: 'error.listing.image.idOrKeyRequired',
      },
    ],
  })
  assert.deepEqual(await snapshot(), before)
  assert.equal(storageCalls.length, 0)
})

void test('zero image positions are rejected without changing listing or upload state', async () => {
  const upload = await stageUpload()
  const before = await snapshot()
  assert.equal(
    (
      await request('POST', '/1/images', {
        objectKey: upload.objectKey,
        displayOrder: 0,
      })
    ).status,
    400
  )
  assert.equal((await update([{ id: '1', displayOrder: 0 }])).status, 400)
  assert.deepEqual(await snapshot(), before)
  assert.equal(storageCalls.length, 0)
})

void test('presign records a scoped key without changing the committed listing', async () => {
  const before = await readListing()
  const upload = await stageUpload(false)
  assert.match(upload.objectKey, /^listings\/1\/[\da-f-]+\.png$/)
  assert.equal(upload.expiresIn, 900)
  assert.equal(
    new URL(upload.uploadUrl).searchParams.has('x-amz-checksum-crc32'),
    false
  )
  assert.deepEqual(await readListing(), before)
  const result = await db.query('SELECT * FROM rental_listing_image_upload')
  assert.equal(result.rows.length, 1)
})

void test('create flow still finalizes uploaded images and rejects duplicate finalization', async () => {
  const upload = await stageUpload()
  const response = await request('POST', '/1/images', {
    objectKey: upload.objectKey,
    displayOrder: 4,
  })
  assert.equal(response.status, 201)
  const listing = await readListing()
  assert.equal(listing.images[2].imagePath, upload.objectKey)
  assert.equal(listing.images[2].displayOrder, 4)
  const repeat = await request('POST', '/1/images', {
    objectKey: upload.objectKey,
    displayOrder: 5,
  })
  assert.equal(repeat.status, 409)
  assert.deepEqual(await repeat.json(), {
    error: 'error.listing.image.alreadyFinalized',
  })
})

void test('reorders all existing images safely across unique positions', async () => {
  const response = await update([
    { id: '1', displayOrder: 2 },
    { id: '2', displayOrder: 1 },
  ])
  assert.equal(response.status, 200)
  const listing = (await response.json()) as ListingDetails
  assert.deepEqual(
    listing.images.map((image) => image.id),
    ['2', '1']
  )
  assert.deepEqual(
    listing.images.map((image) => image.displayOrder),
    [1, 2]
  )
  assert.deepEqual((await readListing()).images, listing.images)
  assert.equal(listing.published, true)
})

void test('adds, replaces, removes and orders photos in one atomic update', async () => {
  const replacement = await stageUpload()
  const addition = await stageUpload()
  const response = await update([
    { id: '1', objectKey: replacement.objectKey, displayOrder: 2 },
    { objectKey: addition.objectKey, displayOrder: 1 },
  ])
  assert.equal(response.status, 200)
  const listing = (await response.json()) as ListingDetails
  assert.deepEqual(
    listing.images.map((image) => image.imagePath),
    [addition.objectKey, replacement.objectKey]
  )
  assert.equal(listing.images[1].id, '1')
  assert.equal(listing.published, true)
  assert.equal(listing.ready, true)
  assert.equal(
    (await db.query('SELECT * FROM rental_listing_image_upload')).rows.length,
    0
  )
  const cleanup = await db.query<{ object_key: string }>(
    'SELECT object_key FROM listing_image_cleanup ORDER BY object_key'
  )
  assert.deepEqual(
    cleanup.rows.map((row) => row.object_key),
    [oldKey, secondKey]
  )
  // Objects are retained until the commit is durable and upload URLs expire.
  assert.ok(objects.has(oldKey))
  assert.ok(objects.has(secondKey))
})

void test('removing the final image unpublishes; adding later does not republish', async () => {
  const response = await update([])
  assert.equal(response.status, 200)
  const listing = (await response.json()) as ListingDetails
  assert.deepEqual(listing.images, [])
  assert.equal(listing.ready, false)
  assert.equal(listing.published, false)
  assert.equal((await request('POST', '/1/publish')).status, 409)
  const upload = await stageUpload()
  assert.equal(
    (await update([{ objectKey: upload.objectKey, displayOrder: 1 }])).status,
    200
  )
  assert.equal((await readListing()).published, false)
  assert.equal((await request('POST', '/1/publish')).status, 200)
  assert.equal((await readListing()).published, true)
})

void test('duplicate orders, IDs and keys fail validation without applying changes', async () => {
  const before = await snapshot()
  for (const { images, message } of [
    {
      images: [
        { id: '1', displayOrder: 1 },
        { id: '2', displayOrder: 1 },
      ],
      message: 'error.listing.image.duplicate.displayOrder',
    },
    {
      images: [
        { id: '1', displayOrder: 1 },
        { id: '1', displayOrder: 2 },
      ],
      message: 'error.listing.image.duplicate.id',
    },
    {
      images: [
        { objectKey: oldKey, displayOrder: 1 },
        { objectKey: oldKey, displayOrder: 2 },
      ],
      message: 'error.listing.image.duplicate.objectKey',
    },
  ]) {
    const response = await update(images)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      errors: [{ code: 'custom', path: ['images'], message }],
    })
  }
  assert.deepEqual(await snapshot(), before)
  assert.equal(storageCalls.length, 0)
})

void test('foreign image IDs, foreign keys and unissued same-listing keys cannot be used', async () => {
  const before = await snapshot()
  for (const [image, status] of [
    [{ id: '3', displayOrder: 1 }, 404],
    [{ id: '999', displayOrder: 1 }, 404],
    [{ objectKey: 'listings/2/other.png', displayOrder: 1 }, 400],
    [{ objectKey: 'users/1/avatar.png', displayOrder: 1 }, 400],
    [{ objectKey: 'listings/1/unissued.png', displayOrder: 1 }, 400],
    [{ objectKey: 'listings/1/../2/other.png', displayOrder: 1 }, 400],
  ] as const) {
    assert.equal((await update([image])).status, status)
  }
  assert.deepEqual(await snapshot(), before)
  assert.equal(storageCalls.length, 0)
})

for (const failure of ['missing', 'empty', 'content-type', 'unavailable']) {
  void test(`${failure} upload rolls back the full intended image set and details`, async (t) => {
    t.mock.method(console, 'error', () => {})
    const good = await stageUpload()
    const bad = await stageUpload(failure !== 'missing')
    if (failure === 'empty')
      objects.set(bad.objectKey, { ContentType: 'image/png', ContentLength: 0 })
    if (failure === 'content-type')
      objects.set(bad.objectKey, {
        ContentType: 'image/jpeg',
        ContentLength: 10,
      })
    if (failure === 'unavailable') failStorage = true
    const before = await snapshot()
    const response = await update([
      { id: '1', objectKey: good.objectKey, displayOrder: 2 },
      { objectKey: bad.objectKey, displayOrder: 1 },
    ])
    assert.equal(
      response.status,
      failure === 'missing' ? 409 : failure === 'unavailable' ? 500 : 400
    )
    assert.deepEqual(await snapshot(), before)
    assert.ok(objects.has(oldKey))
    assert.ok(objects.has(secondKey))
    failStorage = false
    objects.set(bad.objectKey, { ContentType: 'image/png', ContentLength: 10 })
    assert.equal(
      (await update([{ id: '1', objectKey: bad.objectKey, displayOrder: 1 }]))
        .status,
      200
    )
  })
}

void test('database failure rolls back image changes, cleanup tasks and consumed uploads', async (t) => {
  t.mock.method(console, 'error', () => {})
  const upload = await stageUpload()
  const before = await snapshot()
  failQuery = /UPDATE rental_listing SET/
  const response = await update([
    { id: '1', objectKey: upload.objectKey, displayOrder: 1 },
  ])
  assert.equal(response.status, 500)
  assert.deepEqual(await snapshot(), before)
  assert.ok(objects.has(oldKey))
})

void test('deferred uniqueness is enforced at commit and rolls the transaction back', async () => {
  const before = await snapshot()
  await assert.rejects(
    withOwnedListing('1', '1', async (client) => {
      await client.query(
        'SET CONSTRAINTS rental_listing_image_listing_display_order_key DEFERRED'
      )
      await createListingImage(client, '1', {
        objectKey: 'listings/1/duplicate.png',
        displayOrder: 1,
      })
    }),
    { status: 409 }
  )
  assert.deepEqual(await snapshot(), before)
})

void test('failed create-flow finalization leaves the upload available for retry', async () => {
  const upload = await stageUpload(false)
  const before = await snapshot()
  const response = await request('POST', '/1/images', {
    objectKey: upload.objectKey,
    displayOrder: 3,
  })
  assert.equal(response.status, 409)
  assert.deepEqual(await snapshot(), before)
  objects.set(upload.objectKey, { ContentType: 'image/png', ContentLength: 10 })
  const conflict = await request('POST', '/1/images', {
    objectKey: upload.objectKey,
    displayOrder: 1,
  })
  assert.equal(conflict.status, 409)
  assert.deepEqual(await snapshot(), before)
  const retry = await request('POST', '/1/images', {
    objectKey: upload.objectKey,
    displayOrder: 3,
  })
  assert.equal(retry.status, 201)
})

void test('cleanup waits for URL expiry, retries storage failures and never deletes active images', async (t) => {
  t.mock.method(console, 'error', () => {})
  assert.equal((await update([{ id: '2', displayOrder: 1 }])).status, 200)
  await cleanUpListingImages(deleteImageObject)
  assert.ok(objects.has(oldKey))
  await db.exec(
    "UPDATE listing_image_cleanup SET available_after = CURRENT_TIMESTAMP - INTERVAL '1 minute'"
  )
  failStorage = true
  await cleanUpListingImages(deleteImageObject)
  assert.equal(
    (await db.query('SELECT * FROM listing_image_cleanup')).rows.length,
    1
  )
  assert.ok(objects.has(oldKey))
  failStorage = false
  await db.exec(
    "UPDATE listing_image_cleanup SET available_after = CURRENT_TIMESTAMP - INTERVAL '1 minute'"
  )
  await cleanUpListingImages(deleteImageObject)
  assert.equal(objects.has(oldKey), false)
  assert.ok(objects.has(secondKey))
  assert.equal(
    (await db.query('SELECT * FROM listing_image_cleanup')).rows.length,
    0
  )
  assert.equal((await readListing()).published, true)
  assert.equal(
    (await update([{ objectKey: oldKey, displayOrder: 1 }])).status,
    400
  )
})

void test('expired staged uploads cannot finalize and are eventually cleaned up', async () => {
  const upload = await stageUpload()
  await db.exec(
    "UPDATE rental_listing_image_upload SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'"
  )
  const before = await readListing()
  assert.equal(
    (await update([{ objectKey: upload.objectKey, displayOrder: 1 }])).status,
    400
  )
  assert.deepEqual(await readListing(), before)
  await cleanUpListingImages(deleteImageObject)
  assert.equal(objects.has(upload.objectKey), false)
  assert.equal(
    (await db.query('SELECT * FROM rental_listing_image_upload')).rows.length,
    0
  )
  assert.ok(objects.has(oldKey))
})

void test('cleanup can retry after storage deletion succeeds but the database write fails', async () => {
  assert.equal((await update([{ id: '2', displayOrder: 1 }])).status, 200)
  await db.exec(
    "UPDATE listing_image_cleanup SET available_after = CURRENT_TIMESTAMP - INTERVAL '1 minute'"
  )
  failQuery = /DELETE FROM listing_image_cleanup/
  await assert.rejects(cleanUpListingImages(deleteImageObject), {
    message: 'Simulated database failure',
  })
  assert.equal(objects.has(oldKey), false)
  assert.equal(
    (await db.query('SELECT * FROM listing_image_cleanup')).rows.length,
    1
  )
  await cleanUpListingImages(deleteImageObject)
  assert.equal(
    (await db.query('SELECT * FROM listing_image_cleanup')).rows.length,
    0
  )
  const listing = await readListing()
  assert.equal(listing.published, true)
  assert.deepEqual(
    listing.images.map((image) => image.imagePath),
    [secondKey]
  )
  assert.ok(objects.has(secondKey))
})

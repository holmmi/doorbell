import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile, readdir } from 'node:fs/promises'
import type { Server } from 'node:http'
import { after, before, beforeEach } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
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
  ListingDetailsResponse,
  ListingImage,
  ListingImageInput,
  ListingImageResponse,
  PresignedImage,
} from '../../../types/listing.js'

export const bucket = 'listing-integration'
export const imageBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64'
)
export const listingInput = {
  neighborhood: 'Kallio',
  city: 'Helsinki',
  availableFrom: '2026-11-01',
  rent: 1250,
  squareMeters: 42.5,
  rooms: 'ONE_ROOM_AND_KITCHEN',
}

let postgres: StartedPostgreSqlContainer | undefined
let s3mock: StartedS3MockContainer | undefined
export let pool: Pool
export let storage: S3Client
let server: Server | undefined
export let baseUrl: string
let token: string

// Importing this module registers these hooks with node:test at file scope.
// Each test file runs in its own process by default, so its fixtures are isolated.
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
    ;({ pool } = await import('../../../config/database.js'))
    const migrations = new URL('../../../../../migrations/', import.meta.url)
    const filenames = (await readdir(migrations))
      .filter((name) => /^V\d+__.*\.sql$/.test(name))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    for (const filename of filenames) {
      await pool.query(await readFile(new URL(filename, migrations), 'utf8'))
    }

    const { getObjectStorage } =
      await import('../../../config/objectStorage.js')
    storage = getObjectStorage().client
    await storage.send(new CreateBucketCommand({ Bucket: bucket }))
    const { default: app } = await import('../../../app.js')
    const { createAccessToken } = await import('../../../utils/jwt.js')
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

export const request = (method: string, path: string, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  })

export const publicRequest = (method: string, path: string) =>
  fetch(`${baseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(15_000),
  })

export const requestAs = (authToken: string, method: string, path: string) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })

export const seedPublishedListing = async (
  ownerId: number,
  imagePath: string
) => {
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

export const createListing = async () => {
  const response = await request('POST', '', listingInput)
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { id: '1' })
}

export const readListing = async () => {
  const response = await request('GET', '/1')
  assert.equal(response.status, 200)
  return (await response.json()) as ListingDetailsResponse
}

export const imageWithoutSignature = (image: ListingImageResponse) => {
  const url = new URL(image.imageUrl)
  // Fresh signatures can differ even when they refer to the same stored object.
  url.search = ''
  return { ...image, imageUrl: url.href }
}

export const assertListingUnchanged = (
  actual: ListingDetailsResponse,
  expected: ListingDetailsResponse
) => {
  assert.deepEqual(
    { ...actual, images: actual.images.map(imageWithoutSignature) },
    { ...expected, images: expected.images.map(imageWithoutSignature) }
  )
}

export const update = (images: ListingImageInput[], neighborhood = 'Kallio') =>
  request('PUT', '/1', { ...listingInput, neighborhood, images })

export const presign = async () => {
  const response = await request('POST', '/1/images/presign', {
    contentType: 'image/png',
  })
  assert.equal(response.status, 200)
  return (await response.json()) as PresignedImage
}

export const upload = async (image: PresignedImage) => {
  const response = await fetch(image.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: imageBytes,
    signal: AbortSignal.timeout(15_000),
  })
  assert.equal(response.status, 200, await response.text())
}

export const addImage = async (displayOrder: number) => {
  const image = await presign()
  await upload(image)
  const response = await request('POST', '/1/images', {
    objectKey: image.objectKey,
    displayOrder,
  })
  assert.equal(response.status, 201)
  return (await response.json()) as ListingImage
}

export const head = (Key: string) =>
  storage.send(new HeadObjectCommand({ Bucket: bucket, Key }))

// Observe actual PostgreSQL waiters rather than assuming a request has reached
// a lock after a fixed sleep. Polling is bounded so regressions fail promptly.
export const waitForBlockedConnection = async (
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

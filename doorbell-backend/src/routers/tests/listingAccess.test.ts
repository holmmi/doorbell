import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { Server } from 'node:http'
import { after, before, test, type TestContext } from 'node:test'

import type { PoolClient } from 'pg'

import type { Listing, ListingDetailsResponse } from '../../types/listing.js'
import type { UserRole } from '../../types/user.js'

Object.assign(process.env, {
  JWT_SECRET: 'test-only-listing-access-secret',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_NAME: 'listing_access_test',
  DB_USER: 'listing_access_test',
  DB_PASSWORD: 'test-only-password',
  DOTENV_CONFIG_PATH: '__test_missing_env__',
  S3_ENDPOINT: 'http://127.0.0.1:9090',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'test',
  S3_SECRET_KEY: 'test',
  S3_BUCKET: 'listing-access-test',
  S3_FORCE_PATH_STYLE: 'true',
})

const { pool } = await import('../../config/database.js')
const { default: app } = await import('../../app.js')
const { createAccessToken } = await import('../../utils/jwt.js')

const listing: Listing = {
  id: '42',
  ownerId: '7',
  createdAt: '2026-10-28',
  monthlyPrice: '1250.00',
  squareMeters: '42.50',
  neighborhood: 'Kallio',
  city: 'Helsinki',
  availableFrom: '2026-11-01',
  extraCosts: '',
  rooms: 'ONE_ROOM_AND_KITCHEN',
  published: true,
}
const image = {
  id: '100',
  imagePath: 'listings/42/finalized.png',
  displayOrder: 1,
}
let server: Server
let baseUrl: string

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseUrl = `http://127.0.0.1:${address.port}/api/listing`
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

const stubListing = (
  t: TestContext,
  current: Listing | undefined = listing,
  ownerRole: UserRole | null = 'LANDLORD'
) => {
  const queryRole = (sql: string, values: unknown[] = []) => {
    assert.match(sql, /SELECT role/)
    const role =
      values[0] === '7' ? ownerRole : values[0] === '9' ? 'TENANT' : 'LANDLORD'
    return Promise.resolve({ rows: role === null ? [] : [{ role }] })
  }
  const client = {
    query: t.mock.fn((sql: string, values?: unknown[]) => {
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) {
        return Promise.resolve({ rows: [] })
      }
      if (/FROM rental_listing_image/.test(sql)) {
        return Promise.resolve({ rows: [image] })
      }
      if (/SELECT role/.test(sql)) {
        return queryRole(sql, values)
      }
      assert.match(sql, /FROM rental_listing/)
      const accessible =
        current?.id === values?.[0] &&
        (values?.[1] === null || current.ownerId === values?.[1])
      return Promise.resolve({ rows: accessible ? [current] : [] })
    }),
    release: t.mock.fn(),
  }
  const connect = t.mock.method(pool, 'connect', () =>
    Promise.resolve(client as unknown as PoolClient)
  )
  const poolQuery = t.mock.method(pool, 'query', queryRole)
  return { client, connect, poolQuery }
}

const getListing = (userId?: string, path = '/42', authorization?: string) =>
  fetch(`${baseUrl}${path}`, {
    headers:
      authorization !== undefined
        ? { Authorization: authorization }
        : userId === undefined
          ? {}
          : { Authorization: `Bearer ${createAccessToken(userId)}` },
    signal: AbortSignal.timeout(5_000),
  })

for (const [description, userId] of [
  ['anonymous visitor', undefined],
  ['tenant', '9'],
  ['another landlord', '8'],
  ['owner', '7'],
] as const) {
  void test(`published listing is readable by ${description}`, async (t) => {
    stubListing(t)
    const response = await getListing(userId)
    assert.equal(response.status, 200)
    const body = (await response.json()) as ListingDetailsResponse
    const imageUrl = body.images[0].imageUrl
    assert.deepEqual(body, {
      ...listing,
      ready: true,
      images: [{ id: image.id, displayOrder: image.displayOrder, imageUrl }],
    })
    const url = new URL(imageUrl)
    assert.equal(url.searchParams.get('X-Amz-Expires'), '900')
    assert.match(url.pathname, /listings\/42\/finalized\.png$/)
  })
}

void test('unpublished listing remains readable by its landlord owner', async (t) => {
  const { poolQuery } = stubListing(t, { ...listing, published: false })
  const response = await getListing('7')
  assert.equal(response.status, 200)
  const body = (await response.json()) as ListingDetailsResponse
  assert.equal(body.published, false)
  assert.equal(body.images.length, 1)
  // The role lookup must reuse the transaction connection, avoiding pool starvation.
  assert.equal(poolQuery.mock.callCount(), 0)
})

for (const [description, userId] of [
  ['anonymous visitor', undefined],
  ['tenant', '9'],
  ['another landlord', '8'],
] as const) {
  void test(`unpublished listing is hidden from ${description}`, async (t) => {
    const { client } = stubListing(t, { ...listing, published: false })
    const response = await getListing(userId)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'error.listing.notFound' })
    assert.equal(
      client.query.mock.calls.some(({ arguments: [sql] }) =>
        sql.includes('FROM rental_listing_image')
      ),
      false
    )
  })
}

for (const role of ['TENANT', null] as const) {
  void test(`draft access requires the owner's current landlord role (${String(role)})`, async (t) => {
    stubListing(t, { ...listing, published: false }, role)
    const response = await getListing('7')
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'error.listing.notFound' })
  })
}

void test('missing listing returns 404', async (t) => {
  stubListing(t)
  const response = await getListing(undefined, '/999')
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'error.listing.notFound' })
})

void test('invalid bearer token returns 401 before reading a published listing', async (t) => {
  const { connect } = stubListing(t)
  const response = await getListing(undefined, '/42', 'Bearer invalid-token')
  assert.equal(response.status, 401)
  assert.equal(connect.mock.callCount(), 0)
})

void test('invalid listing ID returns 400 before querying the database', async (t) => {
  const { connect } = stubListing(t)
  const response = await getListing(undefined, '/not-an-id')
  assert.equal(response.status, 400)
  assert.equal(connect.mock.callCount(), 0)
})

for (const [description, userId, status] of [
  ['anonymous visitor', undefined, 401],
  ['tenant', '9', 403],
] as const) {
  void test(`public reads do not allow ${description} to update a listing`, async (t) => {
    const { connect } = stubListing(t)
    const response = await fetch(`${baseUrl}/42`, {
      method: 'PUT',
      headers:
        userId === undefined
          ? {}
          : { Authorization: `Bearer ${createAccessToken(userId)}` },
      signal: AbortSignal.timeout(5_000),
    })
    assert.equal(response.status, status)
    assert.equal(connect.mock.callCount(), 0)
  })
}

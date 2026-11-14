import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import type {
  ListingFeedResponse,
  ListingFilterOptions,
} from '../../types/listing.js'
import {
  listingInput,
  pool,
  publicRequest,
  request,
  requestAs,
  seedPublishedListing,
} from './helpers/integration.js'

const seed = async (
  city = 'Helsinki',
  neighborhood = 'Kallio',
  price = 1000,
  size = 40,
  owner = 1,
  published = true
) => {
  const id = await seedPublishedListing(owner, 'listings/test/image.png')
  await pool.query(
    `UPDATE rental_listing SET city = $2, neighborhood = $3,
       monthly_price = $4, square_meters = $5, published = $6,
       extra_costs = 'Water 50 EUR/month' WHERE id = $1`,
    [id, city, neighborhood, price, size, published]
  )
  return id
}

const get = async (path: string, userId?: string) => {
  if (!userId) return publicRequest('GET', path)
  const { createAccessToken } = await import('../../utils/jwt.js')
  return requestAs(createAccessToken(userId), 'GET', path)
}

const feed = async (query: string, userId?: string) => {
  const response = await get(query, userId)
  assert.equal(response.status, 200)
  return (await response.json()) as ListingFeedResponse[]
}

const options = async (userId?: string, query = '') => {
  const response = await get(`/filter-options${query}`, userId)
  assert.equal(response.status, 200)
  return (await response.json()) as ListingFilterOptions
}

void describe(
  'listing filters and options',
  { concurrency: false, timeout: 360_000 },
  () => {
    beforeEach(async () => {
      await pool.query(`
      INSERT INTO "user" (first_name, last_name, email, password, role) VALUES
        ('Tenant', 'Two', 'tenant@example.com', 'unused', 'TENANT'),
        ('Owner', 'Three', 'other@example.com', 'unused', 'LANDLORD')
    `)
    })

    void test('filters independently and together with exact normalized text and inclusive numeric bounds', async () => {
      const first = await seed(
        ' \tHelsinki\u00a0',
        '\nKallio\u000b',
        1250.25,
        30.5
      )
      const second = await seed('Helsinki', 'Kamppi', 1500, 42.5)
      const third = await seed('Tampere', 'Kallio', 900, 60)
      const fourth = await seed('Helsinki', 'Kallio', 1250.26, 30.49)
      const fifth = await seed('Espoo', 'Kallio', 100, 12)
      const cases: Array<[string, string[]]> = [
        ['city=%20heLSinki%09', [first, second, fourth]],
        ['city=Helsinki&neighborhood=%20KALLIO%20', [first, fourth]],
        ['city=Tampere&neighborhood=Kallio', [third]],
        ['maxPrice=1250.25', [first, third, fifth]],
        ['minSize=30.50', [first, second, third]],
        [
          'city=Helsinki&neighborhood=Kallio&maxPrice=1250.25&minSize=30.50',
          [first],
        ],
        [
          'city=Helsinki&neighborhood=Kallio&maxPrice=1250.24&minSize=30.50',
          [],
        ],
        ['city=Unknown', []],
        ['city=Helsinki&neighborhood=Unknown', []],
        ['city=Hels', []],
        [`city=${encodeURIComponent("Helsinki' OR TRUE --")}`, []],
        [
          'city=%20&neighborhood=%09&ignored=value',
          [first, second, third, fourth, fifth],
        ],
        [
          'maxPrice=99999999.99&minSize=0.01',
          [first, second, third, fourth, fifth],
        ],
      ]
      for (const [query, ids] of cases) {
        const listings = await feed(`?${query}`, '2')
        assert.deepEqual(
          listings.map(({ id }) => id),
          ids,
          query
        )
      }
      const [listing] = await feed(
        '?city=Helsinki&maxPrice=1250.25&minSize=30.5'
      )
      assert.equal(listing.monthlyPrice, '1250.25')
      assert.equal(listing.squareMeters, '30.50')
      assert.equal(listing.extraCosts, 'Water 50 EUR/month')
      assert.equal(listing.rooms, 'STUDIO')
      assert.equal(listing.published, true)
      assert.equal(listing.ownerId, '1')
      assert.ok(listing.createdAt)
      assert.equal(listing.availableFrom, '2026-11-01')
      assert.deepEqual(Object.keys(listing.images[0]).sort(), [
        'displayOrder',
        'id',
        'imageUrl',
      ])
      assert.equal(
        new URL(listing.images[0].imageUrl).searchParams.get('X-Amz-Expires'),
        '900'
      )
    })

    void test('applies filters and eligibility before limits for anonymous, tenant and landlord callers', async () => {
      for (let i = 0; i < 12; i += 1) await seed('Turku')
      await seed('Helsinki', 'Kallio', 1000, 40, 1, false)
      const owned = await seed('Helsinki', 'Kallio', 1000, 40, 3)
      const liked = await seed()
      const disliked = await seed()
      await pool.query(
        `INSERT INTO rental_listing_preference (tenant_user_id, rental_listing_id, liked)
       VALUES (2, $1, TRUE), (2, $2, FALSE), (3, $1, TRUE), (3, $2, FALSE)`,
        [liked, disliked]
      )
      const eligible: string[] = []
      for (let i = 0; i < 12; i += 1) eligible.push(await seed())
      for (const [userId, expected] of [
        [undefined, [owned, liked]],
        ['2', [owned, ...eligible].slice(0, 10)],
        ['3', eligible.slice(0, 10)],
      ] as const) {
        const listings = await feed(
          '?city=Helsinki&maxPrice=1000&minSize=40',
          userId
        )
        assert.deepEqual(
          listings.map(({ id }) => id),
          expected
        )
        for (const listing of listings) {
          assert.equal(listing.published, true)
          assert.equal(listing.images.length, 1)
          assert.match(listing.images[0].imageUrl, /^http/)
        }
      }
      assert.deepEqual(
        (await feed('')).map(({ id }) => id),
        ['1', '2']
      )
      assert.equal((await feed('', '2')).length, 10)
    })

    void test('rejects invalid query values with Zod issues over HTTP', async () => {
      const queries = [
        'neighborhood=Kallio',
        'city=%20&neighborhood=Kallio',
        'maxPrice=0',
        'minSize=0.00',
        'maxPrice=-1',
        'maxPrice=1.234',
        'minSize=30.001',
        'maxPrice=99999999.999',
        'maxPrice=100000000',
        'minSize=1000000',
        'minSize=',
        'maxPrice=%20',
        'maxPrice=NaN',
        'maxPrice=Infinity',
        'maxPrice=1e3',
        'minSize=0x10',
        'maxPrice=1,50',
      ]
      for (const field of ['city', 'neighborhood', 'maxPrice', 'minSize']) {
        queries.push(
          `${field}=1&${field}=2`,
          `${field}[]=1`,
          `${field}[value]=1`
        )
      }
      for (const query of queries) {
        const response = await publicRequest('GET', `?${query}`)
        assert.equal(response.status, 400, query)
        const body = (await response.json()) as {
          errors: Array<{ path: string[]; code: string; message: string }>
        }
        assert.ok(body.errors.length > 0, query)
        assert.ok(body.errors[0].path.length > 0, query)
        assert.equal(typeof body.errors[0].code, 'string')
        assert.equal(typeof body.errors[0].message, 'string')
      }
    })

    void test('both routes reject invalid and expired bearer tokens before validating filters', async () => {
      const { default: jwt } = await import('jsonwebtoken')
      const expired = jwt.sign({ sub: '2' }, process.env.JWT_SECRET!, {
        expiresIn: -1,
      })
      for (const path of [
        '?city=Helsinki',
        '?maxPrice=bad',
        '/filter-options',
      ]) {
        for (const token of ['invalid-token', expired]) {
          const response = await requestAs(token, 'GET', path)
          assert.equal(response.status, 401)
          assert.deepEqual(await response.json(), {
            error: 'error.authentication.unauthorized',
          })
        }
      }
    })

    void test('metadata uses all published listings with deterministic grouped text and numeric prices', async () => {
      for (let i = 0; i < 12; i += 1) await seed('Helsinki', 'Kallio', 100)
      await seed('\tHELSINKI\u00a0', ' kallio ', 100)
      const reviewed = await seed('Helsinki', 'Kamppi', 1250.25)
      await seed('Tampere', 'Kallio', 80, 40, 3)
      await seed('Tampere', 'Keskusta', 80)
      await seed('Zcity', '\t\n ', 950)
      await seed('\u00a0\t ', 'Ghost', 9)
      await seed('Secret', 'Draft', 1, 40, 1, false)
      const expected: ListingFilterOptions = {
        locations: [
          { city: 'HELSINKI', neighborhoods: ['Kallio', 'Kamppi'] },
          { city: 'Tampere', neighborhoods: ['Kallio', 'Keskusta'] },
          { city: 'Zcity', neighborhoods: [] },
        ],
        maxPrices: ['9.00', '80.00', '100.00', '950.00', '1250.25'],
      }
      assert.deepEqual(await options(), expected)
      await pool.query(
        `INSERT INTO rental_listing_preference (tenant_user_id, rental_listing_id, liked)
       VALUES (2, $1, TRUE), (3, $1, FALSE)`,
        [reviewed]
      )
      for (const userId of [undefined, '2', '3']) {
        assert.deepEqual(
          await options(userId, '?city=Unknown&maxPrice=1'),
          expected
        )
      }
      // Every displayed location, including shared neighborhood names, round-trips.
      for (const { city, neighborhoods } of expected.locations) {
        for (const neighborhood of [undefined, ...neighborhoods]) {
          const query = new URLSearchParams({ city })
          if (neighborhood) query.set('neighborhood', neighborhood)
          const listings = await feed(`?${query}`)
          assert.ok(listings.length > 0)
          for (const listing of listings) {
            assert.equal(listing.city.trim().toLowerCase(), city.toLowerCase())
            if (neighborhood)
              assert.equal(
                listing.neighborhood.trim().toLowerCase(),
                neighborhood.toLowerCase()
              )
          }
        }
      }
      for (const maxPrice of expected.maxPrices) {
        const listings = await feed(`?maxPrice=${maxPrice}`)
        assert.ok(listings.length > 0)
        assert.ok(
          listings.every(
            (listing) => Number(listing.monthlyPrice) <= Number(maxPrice)
          )
        )
      }
    })

    void test('empty and draft-only datasets return empty options and feeds', async () => {
      const empty = { locations: [], maxPrices: [] }
      assert.deepEqual(await options(), empty)
      assert.deepEqual(await feed(''), [])
      await seed('Secret', 'Draft', 1000, 40, 1, false)
      assert.deepEqual(await options('2'), empty)
      assert.deepEqual(await feed('?city=Secret'), [])
    })

    void test('publication, updates and unpublication are reflected on the next request', async () => {
      const id = await seed('Helsinki', 'Kallio', 1000, 40, 1, false)
      assert.deepEqual(await options(), { locations: [], maxPrices: [] })
      assert.equal((await request('POST', `/${id}/publish`)).status, 200)
      assert.deepEqual(await options(), {
        locations: [{ city: 'Helsinki', neighborhoods: ['Kallio'] }],
        maxPrices: ['1000.00'],
      })
      assert.equal(
        (
          await request('PUT', `/${id}`, {
            ...listingInput,
            city: 'Tampere',
            neighborhood: 'Keskusta',
            rent: 1500.25,
          })
        ).status,
        200
      )
      assert.deepEqual(await options(), {
        locations: [{ city: 'Tampere', neighborhoods: ['Keskusta'] }],
        maxPrices: ['1500.25'],
      })
      assert.deepEqual(await feed('?city=Helsinki'), [])
      assert.deepEqual(
        (await feed('?city=Tampere&maxPrice=1500.25')).map(({ id }) => id),
        [id]
      )
      assert.equal(
        (await request('PUT', `/${id}`, { ...listingInput, images: [] }))
          .status,
        200
      )
      assert.deepEqual(await options(), { locations: [], maxPrices: [] })
      assert.deepEqual(await feed(''), [])
    })
  }
)

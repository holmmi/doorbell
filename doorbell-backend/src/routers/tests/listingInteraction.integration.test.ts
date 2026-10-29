import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import type {
  Applicant,
  MatchResponse,
} from '../../types/listingInteraction.js'
import {
  pool,
  baseUrl,
  seedPublishedListing,
  readListing,
  update,
  waitForBlockedConnection,
} from './helpers/integration.js'

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
  apiRequest(tenantId, 'POST', `/listing-interaction/${listingId}/preference`, {
    liked,
  })
const decision = (
  tenantId = '2',
  value = 'ACCEPTED',
  listingId = '1',
  ownerId = '1'
) =>
  apiRequest(
    ownerId,
    'POST',
    `/listing-interaction/${listingId}/applicants/${tenantId}/decision`,
    { decision: value }
  )
const applicants = async (listingId = '1') => {
  const response = await apiRequest(
    '1',
    'GET',
    `/listing-interaction/${listingId}/applicants`
  )
  assert.equal(response.status, 200)
  return (await response.json()) as Applicant[]
}
const landlordApplicants = async (landlordId = '1') => {
  const response = await apiRequest(
    landlordId,
    'GET',
    '/listing-interaction/applicants'
  )
  assert.equal(response.status, 200)
  return (await response.json()) as {
    tenantId: string
    listing: { id: string; images: { imageUrl: string }[] }
  }[]
}
const landlordMatches = async (landlordId = '1') => {
  const response = await apiRequest(
    landlordId,
    'GET',
    '/listing-interaction/landlord-matches'
  )
  assert.equal(response.status, 200)
  return (await response.json()) as {
    tenantId: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    listing: { id: string; neighborhood: string; city: string }
  }[]
}
const matches = async (tenantId = '2') => {
  const response = await apiRequest(
    tenantId,
    'GET',
    '/listing-interaction/matches'
  )
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

void describe(
  'listing interaction tests',
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

      void test('pending applicants expose only supported profile fields and decisions preserve likes', async () => {
        assert.deepEqual(await applicants(), [])
        await preference('2')
        await preference('3')
        await preference('4', false)
        assert.deepEqual(await applicants(), [
          {
            tenantId: '2',
            firstName: 'Ada',
            lastName: 'Tenant',
          },
          {
            tenantId: '3',
            firstName: 'Ben',
            lastName: 'Tenant',
          },
        ])
        assert.equal((await decision('4')).status, 409)
        assert.equal((await decision('999')).status, 404)
        assert.equal((await decision('2', 'DECLINED')).status, 200)
        assert.equal((await decision('2', 'DECLINED')).status, 200)
        assert.equal((await decision('2')).status, 409)
        assert.equal((await applicants()).length, 1)
        const accepted = await decision('3')
        assert.equal(accepted.status, 200)
        assert.deepEqual(await accepted.json(), {
          listingId: '1',
          tenantId: '3',
          decision: 'ACCEPTED',
        })

        assert.equal((await decision('3', 'DECLINED')).status, 409)
        assert.deepEqual(await applicants(), [])
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

      void test('landlord-wide applicants include pending likes from owned listings', async () => {
        await seedPublishedListing(1, 'listings/2/second.png')
        await preference('2', true, '1')
        await preference('3', true, '2')
        await preference('4', false, '1')

        const result = await landlordApplicants()
        assert.deepEqual(
          result.map(({ tenantId, listing }) => ({
            tenantId,
            listingId: listing.id,
            imageCount: listing.images.length,
          })),
          [
            { tenantId: '2', listingId: '1', imageCount: 1 },
            { tenantId: '3', listingId: '2', imageCount: 1 },
          ]
        )
        assert.match(result[0].listing.images[0].imageUrl, /^https?:\/\//)
      })

      void test('landlord matches return accepted tenants without apartment images', async () => {
        await preference('2')
        assert.deepEqual(await landlordMatches(), [])
        await decision('2')
        assert.deepEqual(await landlordMatches(), [
          {
            tenantId: '2',
            firstName: 'Ada',
            lastName: 'Tenant',
            email: 'ada@example.com',
            phone: null,
            listing: {
              id: '1',
              neighborhood: 'Kallio',
              city: 'Helsinki',
            },
          },
        ])
      })

      void test('accepting multiple applicants preserves publication and other pending likes', async () => {
        for (const tenant of ['2', '3', '4']) await preference(tenant)
        await decision('2')
        const timestamp = (await matches('2'))[0].createdAt
        await decision('2')
        assert.equal((await matches('2'))[0].createdAt, timestamp)
        await decision('3')
        assert.deepEqual(
          (await applicants()).map(({ tenantId }) => tenantId),
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
          result.map(({ listing }) => listing.id),
          ['2', '1']
        )
        assert.ok(
          Date.parse(result[0].createdAt) >= Date.parse(result[1].createdAt)
        )
        assert.deepEqual(Object.keys(result[0]).sort(), [
          'createdAt',
          'landlord',
          'listing',
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
          await (
            await apiRequest(
              '3',
              'GET',
              '/listing-interaction/matches?tenantId=2'
            )
          ).json(),
          []
        )
        // A lower listing ID can have the newest match; ID is only a tie-breaker.
        await pool.query(
          `UPDATE "match" SET created_at = CASE rental_listing_id
             WHEN 1 THEN '2026-10-22T10:00:00Z'::timestamptz
             ELSE '2026-10-21T10:00:00Z'::timestamptz END`
        )
        assert.deepEqual(
          (await matches()).map(({ listing }) => listing.id),
          ['1', '2']
        )
        await pool.query('UPDATE "match" SET created_at = $1', [
          '2026-10-21T10:00:00Z',
        ])
        assert.deepEqual(
          (await matches()).map(({ listing }) => listing.id),
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
        assert.equal((await applicants()).length, 1)
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
            method: 'POST',
            path: '/listing-interaction/1/preference',
            body: { liked: true },
            wrongRole: '1',
          },
          {
            method: 'GET',
            path: '/listing-interaction/1/applicants',
            body: undefined,
            wrongRole: '2',
          },
          {
            method: 'GET',
            path: '/listing-interaction/applicants',
            body: undefined,
            wrongRole: '2',
          },
          {
            method: 'GET',
            path: '/listing-interaction/landlord-matches',
            body: undefined,
            wrongRole: '2',
          },
          {
            method: 'POST',
            path: '/listing-interaction/1/applicants/2/decision',
            body: { decision: 'ACCEPTED' },
            wrongRole: '2',
          },
          {
            method: 'GET',
            path: '/listing-interaction/matches',
            body: undefined,
            wrongRole: '1',
          },
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
          (await apiRequest('5', 'GET', '/listing-interaction/1/applicants'))
            .status,
          404
        )
        assert.equal((await decision('2', 'ACCEPTED', '1', '5')).status, 404)
        await decision()
        assert.equal((await decision('2', 'ACCEPTED', '1', '5')).status, 404)
        assert.equal((await preference('2', true, '999')).status, 404)
        assert.equal(
          (await apiRequest('1', 'GET', '/listing-interaction/999/applicants'))
            .status,
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
            (
              await apiRequest(
                '2',
                'POST',
                '/listing-interaction/1/preference',
                body
              )
            ).status,
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
                'POST',
                '/listing-interaction/1/applicants/2/decision',
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
          'abc',
          '9007199254740992',
          '9223372036854775808',
        ]) {
          assert.equal((await preference('2', true, id)).status, 400)
          assert.equal(
            (
              await apiRequest(
                '1',
                'GET',
                `/listing-interaction/${id}/applicants`
              )
            ).status,
            400
          )
          assert.equal((await decision(id)).status, 400)
        }
        const response = await apiRequest(
          '2',
          'POST',
          '/listing-interaction/1/preference',
          {
            liked: true,
            tenantId: '3',
            ownerId: '5',
          }
        )
        assert.deepEqual(await response.json(), {
          listingId: '1',
          tenantId: '2',
          liked: true,
        })
        assert.equal(
          (
            await apiRequest(
              '1',
              'POST',
              '/listing-interaction/1/applicants/2/decision',
              {
                decision: 'ACCEPTED',
                tenantId: '3',
                ownerId: '5',
              }
            )
          ).status,
          200
        )
        assert.equal((await matches('2')).length, 1)
        assert.deepEqual(await matches('3'), [])
      })

      void test('maximum safe IDs survive preferences, applicants, decisions and matches', async () => {
        const id = '9007199254740991'
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
        assert.equal((await applicants(id))[0].tenantId, id)
        assert.equal((await decision(id, 'ACCEPTED', id)).status, 200)
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
          assert.equal((await applicants()).length, 1)
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
          assert.equal((await applicants()).length, 1)
        } finally {
          await client.query('ROLLBACK')
          client.release()
          await Promise.allSettled(pending)
        }
      })

      void test('database constraints reject dislike decisions, matches without decisions and the wrong landlord', async () => {
        await preference('2', false)
        await assert.rejects(
          pool.query(
            "INSERT INTO rental_listing_applicant_decision (tenant_user_id, rental_listing_id, decision) VALUES (2, 1, 'ACCEPTED')"
          ),
          { code: '23503' }
        )
        await preference('3')
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
  }
)

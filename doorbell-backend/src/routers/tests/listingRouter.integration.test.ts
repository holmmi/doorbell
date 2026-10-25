import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3'
import type {
  ListingDetails,
  ListingDetailsResponse,
  ListingImageResponse,
} from '../../types/listing.js'
import {
  bucket,
  imageBytes,
  listingInput,
  pool,
  storage,
  request,
  publicRequest,
  requestAs,
  seedPublishedListing,
  createListing,
  readListing,
  imageWithoutSignature,
  assertListingUnchanged,
  update,
  presign,
  upload,
  addImage,
  head,
  waitForBlockedConnection,
} from './helpers/integration.js'

void describe(
  'listing router tests',
  // Include time for cold image pulls and container startup in the suite budget.
  { concurrency: false, timeout: 360_000 },
  () => {
    void describe('listings', () => {
      void test('management routes consistently reject invalid path IDs', async () => {
        for (const id of ['0', '-1', '1.5', 'abc', '9007199254740992']) {
          for (const [method, path, body] of [
            ['GET', `/${id}`, undefined],
            ['PUT', `/${id}`, listingInput],
            ['POST', `/${id}/images/presign`, { contentType: 'image/png' }],
            [
              'POST',
              `/${id}/images`,
              { objectKey: 'listings/1/photo.png', displayOrder: 1 },
            ],
            ['POST', `/${id}/publish`, undefined],
          ] as const) {
            const response = await request(method, path, body)
            assert.equal(response.status, 400)
            assert.deepEqual(await response.json(), {
              error: 'error.request.invalid',
            })
          }
        }
      })

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

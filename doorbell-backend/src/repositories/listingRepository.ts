import type { PoolClient } from 'pg'

import { pool } from '../config/database.js'
import type {
  CreatedListing,
  ImageUploadInput,
  Listing,
  ListingDetails,
  ListingFeedItem,
  ListingImage,
  ListingInput,
} from '../types/listing.js'
import { RequestError } from '../utils/requestError.js'

const listingColumns = `
  id,
  owner_id AS "ownerId",
  created_at::text AS "createdAt",
  monthly_price AS "monthlyPrice",
  square_meters AS "squareMeters",
  neighborhood,
  city,
  available_from::text AS "availableFrom",
  extra_costs AS "extraCosts",
  rooms,
  published
`

const imageColumns = `
  id, image_path AS "imagePath", display_order AS "displayOrder"
`

const listingValues = (input: ListingInput) => [
  input.rent,
  input.squareMeters,
  input.neighborhood,
  input.city,
  input.availableFrom,
  input.extraCosts ?? '',
  input.rooms,
]

export const createListing = async (
  ownerId: string,
  input: ListingInput
): Promise<CreatedListing> => {
  const result = await pool.query<CreatedListing>(
    `INSERT INTO rental_listing (
      owner_id, monthly_price, square_meters, neighborhood, city,
      available_from, extra_costs, rooms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [ownerId, ...listingValues(input)]
  )
  return result.rows[0]
}

// All listing mutations share this lock, including create-flow finalization and
// publication, so an update always works with the latest committed image set.
export const withListingLock = async <T>(
  listingId: string,
  ownerId: string | undefined,
  operation: (client: PoolClient, listing: Listing) => Promise<T>
): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<Listing>(
      `SELECT ${listingColumns} FROM rental_listing
       WHERE id = $1 AND ($2::BIGINT IS NULL OR owner_id = $2) FOR UPDATE`,
      [listingId, ownerId ?? null]
    )
    const listing = result.rows[0]
    if (!listing) {
      throw new RequestError(404, 'error.listing.notFound')
    }
    const value = await operation(client, listing)
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Preserve image-specific conflict translation for existing management routes.
export const withOwnedListing = async <T>(
  listingId: string,
  ownerId: string,
  operation: (client: PoolClient, listing: Listing) => Promise<T>
): Promise<T> => {
  try {
    return await withListingLock(listingId, ownerId, operation)
  } catch (error) {
    // PostgreSQL SQLSTATE 23505 means unique_violation, for example when two
    // images share a display order in one listing. Deferred checks can raise it
    // at COMMIT; after rollback, report the conflict as HTTP 409.
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      throw new RequestError(409, 'error.listing.image.conflict')
    }
    throw error
  }
}

export const findListingImages = async (
  client: PoolClient,
  listingId: string
): Promise<ListingImage[]> => {
  const result = await client.query<ListingImage>(
    `SELECT ${imageColumns} FROM rental_listing_image
     WHERE rental_listing_id = $1 ORDER BY display_order, id`,
    [listingId]
  )
  return result.rows
}

export const getListingDetails = async (
  client: PoolClient,
  listing: Listing
): Promise<ListingDetails> => {
  const images = await findListingImages(client, listing.id)
  return { ...listing, ready: images.length > 0, images }
}

export const findListingFeed = async (
  userId: string | undefined,
  limit: number
): Promise<ListingFeedItem[]> => {
  const result = await pool.query<ListingFeedItem>(
    `SELECT ${listingColumns}
     FROM rental_listing AS listing
     WHERE listing.published
       AND ($1::BIGINT IS NULL OR listing.owner_id <> $1::BIGINT)
       AND (
         $1::BIGINT IS NULL OR NOT EXISTS (
           SELECT 1
           FROM rental_listing_preference AS preference
           WHERE preference.tenant_user_id = $1::BIGINT
             AND preference.rental_listing_id = listing.id
         )
       )
     ORDER BY listing.id
     LIMIT $2`,
    [userId ?? null, limit]
  )

  const listings = await Promise.all(
    result.rows.map(async (listing) => {
      const images = await pool.query<ListingImage>(
        `SELECT ${imageColumns} FROM rental_listing_image
         WHERE rental_listing_id = $1 ORDER BY display_order, id`,
        [listing.id]
      )
      return { ...listing, images: images.rows }
    })
  )

  return listings
}

export const updateListing = async (
  client: PoolClient,
  listingId: string,
  input: ListingInput
): Promise<Listing> => {
  const result = await client.query<Listing>(
    `UPDATE rental_listing SET
       monthly_price = $2, square_meters = $3, neighborhood = $4, city = $5,
       available_from = $6, extra_costs = $7, rooms = $8,
       published = published AND EXISTS (
         SELECT 1 FROM rental_listing_image WHERE rental_listing_id = $1
       )
     WHERE id = $1 RETURNING ${listingColumns}`,
    [listingId, ...listingValues(input)]
  )
  return result.rows[0]
}

export const publishListing = async (
  client: PoolClient,
  listingId: string
): Promise<Listing> => {
  const result = await client.query<Listing>(
    `UPDATE rental_listing SET published = TRUE
     WHERE id = $1 AND EXISTS (
       SELECT 1 FROM rental_listing_image WHERE rental_listing_id = $1
     ) RETURNING ${listingColumns}`,
    [listingId]
  )
  if (!result.rows[0]) {
    throw new RequestError(409, 'error.listing.images.incomplete')
  }
  return result.rows[0]
}

export const createListingImage = async (
  client: PoolClient,
  listingId: string,
  input: ImageUploadInput
): Promise<ListingImage> => {
  const result = await client.query<ListingImage>(
    `INSERT INTO rental_listing_image (rental_listing_id, image_path, display_order)
     VALUES ($1, $2, $3) RETURNING ${imageColumns}`,
    [listingId, input.objectKey, input.displayOrder]
  )
  return result.rows[0]
}

export const updateListingImage = async (
  client: PoolClient,
  listingId: string,
  image: ListingImage
): Promise<void> => {
  await client.query(
    `UPDATE rental_listing_image SET image_path = $3, display_order = $4
     WHERE rental_listing_id = $1 AND id = $2`,
    [listingId, image.id, image.imagePath, image.displayOrder]
  )
}

export const deleteListingImage = async (
  client: PoolClient,
  listingId: string,
  imageId: string
): Promise<void> => {
  await client.query(
    'DELETE FROM rental_listing_image WHERE rental_listing_id = $1 AND id = $2',
    [listingId, imageId]
  )
}

export const registerListingImageUpload = async (
  client: PoolClient,
  listingId: string,
  objectKey: string,
  contentType: string
): Promise<void> => {
  await client.query(
    `INSERT INTO rental_listing_image_upload
       (rental_listing_id, object_key, content_type) VALUES ($1, $2, $3)`,
    [listingId, objectKey, contentType]
  )
}

export const consumeListingImageUpload = async (
  client: PoolClient,
  listingId: string,
  objectKey: string
): Promise<string> => {
  const result = await client.query<{ contentType: string }>(
    `DELETE FROM rental_listing_image_upload
     WHERE rental_listing_id = $1 AND object_key = $2 AND expires_at > CURRENT_TIMESTAMP
     RETURNING content_type AS "contentType"`,
    [listingId, objectKey]
  )
  if (!result.rows[0]) {
    throw new RequestError(400, 'error.listing.image.invalidKey')
  }
  return result.rows[0].contentType
}

export const queueListingImageCleanup = async (
  client: PoolClient,
  objectKey: string
): Promise<void> => {
  await client.query(
    'INSERT INTO listing_image_cleanup (object_key) VALUES ($1) ON CONFLICT DO NOTHING',
    [objectKey]
  )
}

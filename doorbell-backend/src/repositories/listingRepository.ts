import { pool } from '../config/database.js'
import type {
  CreatedListing,
  ImageUploadInput,
  Listing,
  ListingInput,
} from '../types/listing.js'
import type { ListingImage } from '../types/listing.js'

const createListingQuery = `
  INSERT INTO rental_listing (
    owner_id,
    monthly_price,
    square_meters,
    neighborhood,
    city,
    available_from,
    extra_costs,
    rooms
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING id
`

const findListingByIdQuery = `
  SELECT
    id,
    owner_id AS "ownerId",
    created_at AS "createdAt",
    monthly_price AS "monthlyPrice",
    square_meters AS "squareMeters",
    neighborhood,
    city,
    available_from AS "availableFrom",
    extra_costs AS "extraCosts",
    rooms,
    published
  FROM rental_listing
  WHERE id = $1
`

const publishListingQuery = `
  UPDATE rental_listing
  SET published = TRUE
  WHERE id = $1 AND owner_id = $2
  RETURNING
    id,
    owner_id AS "ownerId",
    created_at AS "createdAt",
    monthly_price AS "monthlyPrice",
    square_meters AS "squareMeters",
    neighborhood,
    city,
    available_from AS "availableFrom",
    extra_costs AS "extraCosts",
    rooms,
    published
`

const createImageQuery = `
  INSERT INTO rental_listing_image (rental_listing_id, image_path, display_order)
  VALUES ($1, $2, $3)
  RETURNING id, image_path AS "imagePath", display_order AS "displayOrder"
`

export const createListing = async (
  ownerId: string,
  input: ListingInput
): Promise<CreatedListing> => {
  const result = await pool.query<CreatedListing>(createListingQuery, [
    ownerId,
    input.rent,
    input.squareMeters,
    input.neighborhood,
    input.city,
    input.availableFrom,
    input.extraCosts ?? '',
    input.rooms,
  ])

  return result.rows[0]
}

export const findListingById = async (
  listingId: string
): Promise<Listing | undefined> => {
  const result = await pool.query<Listing>(findListingByIdQuery, [listingId])

  return result.rows[0]
}

export const publishListing = async (
  listingId: string,
  ownerId: string
): Promise<Listing | undefined> => {
  const result = await pool.query<Listing>(publishListingQuery, [
    listingId,
    ownerId,
  ])

  return result.rows[0]
}

export const createListingImage = async (
  listingId: string,
  input: ImageUploadInput
): Promise<ListingImage> => {
  const result = await pool.query<ListingImage>(createImageQuery, [
    listingId,
    input.objectKey,
    input.displayOrder,
  ])

  return result.rows[0]
}

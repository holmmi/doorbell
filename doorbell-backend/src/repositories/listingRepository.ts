import { pool } from '../config/database.js'
import type {
  CreatedListing,
  ImageUploadInput,
  ListingInput,
  OwnedListing,
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

const findListingOwnerQuery = `
  SELECT id, owner_id AS "ownerId", published
  FROM rental_listing
  WHERE id = $1
`

const publishListingQuery = `
  UPDATE rental_listing
  SET published = TRUE
  WHERE id = $1 AND owner_id = $2
  RETURNING id, owner_id AS "ownerId", published
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

export const findListingOwner = async (
  listingId: string
): Promise<OwnedListing | undefined> => {
  const result = await pool.query<OwnedListing>(findListingOwnerQuery, [
    listingId,
  ])

  return result.rows[0]
}

export const publishListing = async (
  listingId: string,
  ownerId: string
): Promise<OwnedListing | undefined> => {
  const result = await pool.query<OwnedListing>(publishListingQuery, [
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

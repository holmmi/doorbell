import type { PoolClient } from 'pg'

import { pool } from '../config/database.js'
import type {
  Applicant,
  ApplicantDecision,
  Match,
} from '../types/listingInteraction.js'

export const findPreference = async (
  client: PoolClient,
  listingId: string,
  tenantId: string
): Promise<boolean | undefined> => {
  const result = await client.query<{ liked: boolean }>(
    `SELECT liked FROM rental_listing_preference
     WHERE rental_listing_id = $1 AND tenant_user_id = $2`,
    [listingId, tenantId]
  )
  return result.rows[0]?.liked
}

export const insertPreference = async (
  client: PoolClient,
  listingId: string,
  tenantId: string,
  liked: boolean
): Promise<void> => {
  await client.query(
    `INSERT INTO rental_listing_preference (rental_listing_id, tenant_user_id, liked)
     VALUES ($1, $2, $3)`,
    [listingId, tenantId, liked]
  )
}

export const findDecision = async (
  client: PoolClient,
  listingId: string,
  tenantId: string
): Promise<ApplicantDecision | undefined> => {
  const result = await client.query<{ decision: ApplicantDecision }>(
    `SELECT decision FROM rental_listing_applicant_decision
     WHERE rental_listing_id = $1 AND tenant_user_id = $2`,
    [listingId, tenantId]
  )
  return result.rows[0]?.decision
}

export const insertDecision = async (
  client: PoolClient,
  listingId: string,
  tenantId: string,
  decision: ApplicantDecision
): Promise<void> => {
  await client.query(
    `INSERT INTO rental_listing_applicant_decision
       (rental_listing_id, tenant_user_id, decision) VALUES ($1, $2, $3)`,
    [listingId, tenantId, decision]
  )
}

export const insertMatch = async (
  client: PoolClient,
  listingId: string,
  tenantId: string,
  landlordId: string
): Promise<void> => {
  await client.query(
    `INSERT INTO "match" (rental_listing_id, tenant_user_id, landlord_user_id)
     VALUES ($1, $2, $3)`,
    [listingId, tenantId, landlordId]
  )
}

export const findPendingApplicants = async (
  client: PoolClient,
  listingId: string
): Promise<Applicant[]> => {
  const result = await client.query<Applicant>(
    `SELECT tenant.id AS "tenantId", tenant.first_name AS "firstName",
            tenant.last_name AS "lastName", tenant.picture_path AS "picturePath"
     FROM rental_listing_preference preference
     JOIN "user" tenant ON tenant.id = preference.tenant_user_id
     WHERE preference.rental_listing_id = $1 AND preference.liked
       AND NOT EXISTS (
         SELECT 1 FROM rental_listing_applicant_decision decision
         WHERE decision.rental_listing_id = preference.rental_listing_id
           AND decision.tenant_user_id = preference.tenant_user_id
       )
     ORDER BY tenant.id`,
    [listingId]
  )
  return result.rows
}

// One statement gives listing details, images and contacts a consistent snapshot.
// Cast numeric fields inside JSON explicitly to preserve the listing API contract.
export const findTenantMatches = async (tenantId: string): Promise<Match[]> => {
  const result = await pool.query<Match>(
    `SELECT matched.rental_listing_id AS "listingId", matched.created_at AS "createdAt",
       json_build_object(
         'id', listing.id::text, 'ownerId', listing.owner_id::text,
         'createdAt', listing.created_at::text,
         'monthlyPrice', listing.monthly_price::text,
         'squareMeters', listing.square_meters::text,
         'neighborhood', listing.neighborhood, 'city', listing.city,
         'availableFrom', listing.available_from::text,
         'extraCosts', listing.extra_costs, 'rooms', listing.rooms,
         'published', listing.published,
         'images', COALESCE((
           SELECT json_agg(json_build_object(
             'id', image.id::text, 'imagePath', image.image_path,
             'displayOrder', image.display_order
           ) ORDER BY image.display_order, image.id)
           FROM rental_listing_image image WHERE image.rental_listing_id = listing.id
         ), '[]'::json)
       ) AS listing,
       json_build_object(
         'firstName', landlord.first_name, 'lastName', landlord.last_name,
         'email', landlord.email, 'phone', landlord.phone
       ) AS landlord
     FROM "match" matched
     JOIN rental_listing listing ON listing.id = matched.rental_listing_id
     JOIN "user" landlord ON landlord.id = matched.landlord_user_id
     JOIN rental_listing_applicant_decision decision
       ON decision.rental_listing_id = matched.rental_listing_id
      AND decision.tenant_user_id = matched.tenant_user_id
      AND decision.decision = 'ACCEPTED'
     WHERE matched.tenant_user_id = $1
     ORDER BY matched.created_at DESC, matched.rental_listing_id DESC`,
    [tenantId]
  )
  return result.rows
}

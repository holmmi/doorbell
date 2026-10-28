import type { PoolClient } from 'pg'

import { pool } from '../config/database.js'
import type { Listing } from '../types/listing.js'
import type {
  Applicant,
  ApplicantDecision,
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
            tenant.last_name AS "lastName"
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

export interface TenantMatchRow extends Omit<Listing, 'ownerId' | 'createdAt'> {
  matchedAt: Date
  landlordFirstName: string
  landlordLastName: string
  landlordEmail: string
  landlordPhone: string | null
  imageId: string | null
  imagePath: string | null
  displayOrder: number | null
}

// A flat join keeps the query readable and reads each match in one snapshot.
export const findTenantMatches = async (
  tenantId: string
): Promise<TenantMatchRow[]> => {
  const result = await pool.query<TenantMatchRow>(
    `SELECT listing.id, matched.created_at AS "matchedAt",
       listing.monthly_price AS "monthlyPrice",
       listing.square_meters AS "squareMeters",
       listing.neighborhood, listing.city,
       listing.available_from::text AS "availableFrom",
       listing.extra_costs AS "extraCosts", listing.rooms, listing.published,
       landlord.first_name AS "landlordFirstName",
       landlord.last_name AS "landlordLastName",
       landlord.email AS "landlordEmail", landlord.phone AS "landlordPhone",
       image.id AS "imageId", image.image_path AS "imagePath",
       image.display_order AS "displayOrder"
     FROM "match" matched
     JOIN rental_listing listing ON listing.id = matched.rental_listing_id
     JOIN "user" landlord ON landlord.id = matched.landlord_user_id
     JOIN rental_listing_applicant_decision decision
       ON decision.rental_listing_id = matched.rental_listing_id
      AND decision.tenant_user_id = matched.tenant_user_id
      AND decision.decision = 'ACCEPTED'
     LEFT JOIN rental_listing_image image ON image.rental_listing_id = listing.id
     WHERE matched.tenant_user_id = $1
     ORDER BY matched.created_at DESC, matched.rental_listing_id DESC,
              image.display_order, image.id`,
    [tenantId]
  )
  return result.rows
}

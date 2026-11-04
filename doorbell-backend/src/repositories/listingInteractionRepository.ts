import type { PoolClient } from 'pg'

import { pool } from '../config/database.js'
import type { Listing } from '../types/listing.js'
import type {
  Applicant,
  ApplicantDecision,
  PendingApplicantRow,
  LandlordMatchRow,
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

interface PendingApplicantQueryRow {
  tenantId: string
  firstName: string
  lastName: string
  listingId: string
  monthlyPrice: string
  squareMeters: string
  neighborhood: string
  city: string
  availableFrom: string
  extraCosts: string
  rooms: PendingApplicantRow['listing']['rooms']
  published: boolean
  imageId: string | null
  imagePath: string | null
  displayOrder: number | null
}

export const findPendingApplicantsForLandlord = async (
  landlordId: string
): Promise<PendingApplicantRow[]> => {
  const result = await pool.query<PendingApplicantQueryRow>(
    `SELECT tenant.id AS "tenantId", tenant.first_name AS "firstName",
            tenant.last_name AS "lastName",
            listing.id AS "listingId",
            listing.monthly_price AS "monthlyPrice",
            listing.square_meters AS "squareMeters",
            listing.neighborhood, listing.city,
            listing.available_from::text AS "availableFrom",
            listing.extra_costs AS "extraCosts",
            listing.rooms, listing.published,
            image.id AS "imageId", image.image_path AS "imagePath",
            image.display_order AS "displayOrder"
     FROM rental_listing AS listing
     JOIN rental_listing_preference AS preference
       ON preference.rental_listing_id = listing.id AND preference.liked
     JOIN "user" AS tenant ON tenant.id = preference.tenant_user_id
     LEFT JOIN rental_listing_image AS image
       ON image.rental_listing_id = listing.id
     WHERE listing.owner_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM rental_listing_applicant_decision AS decision
         WHERE decision.rental_listing_id = preference.rental_listing_id
           AND decision.tenant_user_id = preference.tenant_user_id
       )
     ORDER BY listing.id, tenant.id, image.display_order, image.id`,
    [landlordId]
  )

  const applicants: PendingApplicantRow[] = []
  for (const row of result.rows) {
    let applicant = applicants.find(
      (item) =>
        item.tenantId === row.tenantId && item.listing.id === row.listingId
    )
    if (!applicant) {
      applicant = {
        tenantId: row.tenantId,
        firstName: row.firstName,
        lastName: row.lastName,
        listing: {
          id: row.listingId,
          monthlyPrice: row.monthlyPrice,
          squareMeters: row.squareMeters,
          neighborhood: row.neighborhood,
          city: row.city,
          availableFrom: row.availableFrom,
          extraCosts: row.extraCosts,
          rooms: row.rooms,
          published: row.published,
          images: [],
        },
      }
      applicants.push(applicant)
    }
    if (
      row.imageId !== null &&
      row.imagePath !== null &&
      row.displayOrder !== null
    ) {
      applicant.listing.images.push({
        id: row.imageId,
        imagePath: row.imagePath,
        displayOrder: row.displayOrder,
      })
    }
  }
  return applicants
}

export const findLandlordMatches = async (
  landlordId: string
): Promise<LandlordMatchRow[]> => {
  const result = await pool.query<LandlordMatchRow>(
    `SELECT matched.tenant_user_id AS "tenantId",
            tenant.first_name AS "tenantFirstName",
            tenant.last_name AS "tenantLastName",
            tenant.email AS "tenantEmail",
            tenant.phone AS "tenantPhone",
            listing.id AS "listingId",
            listing.neighborhood, listing.city
     FROM "match" AS matched
     JOIN "user" AS tenant ON tenant.id = matched.tenant_user_id
     JOIN rental_listing AS listing
       ON listing.id = matched.rental_listing_id
     JOIN rental_listing_applicant_decision AS decision
       ON decision.rental_listing_id = matched.rental_listing_id
      AND decision.tenant_user_id = matched.tenant_user_id
      AND decision.decision = 'ACCEPTED'
     WHERE matched.landlord_user_id = $1
     ORDER BY matched.created_at DESC, matched.rental_listing_id DESC,
              matched.tenant_user_id`,
    [landlordId]
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

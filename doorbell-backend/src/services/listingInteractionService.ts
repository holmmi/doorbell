import type { PoolClient } from 'pg'

import { listingImageResponse } from '../mappers/listingResponse.js'
import {
  findDecision,
  findPendingApplicants,
  findPreference,
  findTenantMatches,
  insertDecision,
  insertMatch,
  insertPreference,
} from '../repositories/listingInteractionRepository.js'
import {
  findListingImages,
  withListingLock,
} from '../repositories/listingRepository.js'
import type { Listing } from '../types/listing.js'
import type {
  ApplicantDecision,
  Match,
  MatchResponse,
} from '../types/listingInteraction.js'
import { RequestError } from '../utils/requestError.js'

const requireAvailableListing = async (
  client: PoolClient,
  listing: Listing
) => {
  if (
    !listing.published ||
    (await findListingImages(client, listing.id)).length === 0
  ) {
    throw new RequestError(409, 'error.listing.unavailable')
  }
}

export const recordPreference = async (
  listingId: string,
  tenantId: string,
  liked: boolean
) =>
  withListingLock(listingId, undefined, async (client, listing) => {
    const existing = await findPreference(client, listingId, tenantId)
    if (existing !== undefined) {
      if (existing !== liked) {
        throw new RequestError(409, 'error.listing.preference.conflict')
      }
    } else {
      await requireAvailableListing(client, listing)
      await insertPreference(client, listingId, tenantId, liked)
    }
    return { listingId, tenantId, liked }
  })

export const getApplicants = async (listingId: string, ownerId: string) =>
  withListingLock(listingId, ownerId, (client) =>
    findPendingApplicants(client, listingId)
  )

export const decideApplicant = async (
  listingId: string,
  tenantId: string,
  ownerId: string,
  decision: ApplicantDecision
) =>
  withListingLock(listingId, ownerId, async (client, listing) => {
    const existing = await findDecision(client, listingId, tenantId)
    if (existing !== undefined) {
      if (existing !== decision) {
        throw new RequestError(409, 'error.listing.decision.conflict')
      }
    } else {
      const liked = await findPreference(client, listingId, tenantId)
      if (liked === undefined) {
        throw new RequestError(404, 'error.listing.applicant.notFound')
      }
      if (!liked) {
        throw new RequestError(409, 'error.listing.applicant.notInterested')
      }
      await requireAvailableListing(client, listing)
      await insertDecision(client, listingId, tenantId, decision)
      if (decision === 'ACCEPTED') {
        await insertMatch(client, listingId, tenantId, listing.ownerId)
      }
    }
    return { listingId, tenantId, decision }
  })

export const getTenantMatches = async (
  tenantId: string
): Promise<MatchResponse[]> => {
  const rows = await findTenantMatches(tenantId)
  const matches = new Map<string, Match>()
  for (const row of rows) {
    let match = matches.get(row.id)
    if (!match) {
      match = {
        createdAt: row.matchedAt,
        listing: {
          id: row.id,
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
        landlord: {
          firstName: row.landlordFirstName,
          lastName: row.landlordLastName,
          email: row.landlordEmail,
          phone: row.landlordPhone,
        },
      }
      matches.set(row.id, match)
    }
    if (
      row.imageId !== null &&
      row.imagePath !== null &&
      row.displayOrder !== null
    ) {
      match.listing.images.push({
        id: row.imageId,
        imagePath: row.imagePath,
        displayOrder: row.displayOrder,
      })
    }
  }
  return Promise.all(
    [...matches.values()].map(async (match) => ({
      createdAt: match.createdAt.toISOString(),
      listing: {
        ...match.listing,
        images: await Promise.all(
          match.listing.images.map(listingImageResponse)
        ),
      },
      landlord: match.landlord,
    }))
  )
}

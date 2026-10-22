import type { PoolClient } from 'pg'

import {
  findDecision,
  findPendingApplicants,
  findPreference,
  insertDecision,
  insertMatch,
  insertPreference,
} from '../repositories/listingInteractionRepository.js'
import {
  findListingImages,
  withListingLock,
} from '../repositories/listingRepository.js'
import type { Listing } from '../types/listing.js'
import type { ApplicantDecision } from '../types/listingInteraction.js'
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
  withListingLock(listingId, ownerId, async (client) => {
    const applicants = await findPendingApplicants(client, listingId)
    return { applicants, count: applicants.length }
  })

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

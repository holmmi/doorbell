import { authenticatedClient } from './client'
import type { MatchResponse } from '../types/match'
import type {
  ApplicantDecision,
  ApplicantDecisionResponse,
  LandlordMatch,
  ListingPreferenceResponse,
  PendingApplicant,
} from '../types/listingInteraction'

const listingInteractionPath = (listingId: string) =>
  `/listing-interaction/${encodeURIComponent(listingId)}`

export const getMatches = (signal?: AbortSignal): Promise<MatchResponse[]> =>
  authenticatedClient.request<MatchResponse[]>(
    '/listing-interaction/tenant-matches',
    { signal }
  )

export const savePreference = (
  listingId: string,
  liked: boolean
): Promise<ListingPreferenceResponse> =>
  authenticatedClient.request<ListingPreferenceResponse>(
    `${listingInteractionPath(listingId)}/preference`,
    {
      method: 'POST',
      body: { liked },
    }
  )

export const getPendingApplicants = (
  signal?: AbortSignal
): Promise<PendingApplicant[]> =>
  authenticatedClient.request<PendingApplicant[]>(
    '/listing-interaction/applicants',
    { signal }
  )

export const getLandlordMatches = (): Promise<LandlordMatch[]> =>
  authenticatedClient.request<LandlordMatch[]>(
    '/listing-interaction/landlord-matches'
  )

export const decideApplicant = (
  listingId: string,
  tenantId: string,
  decision: ApplicantDecision
): Promise<ApplicantDecisionResponse> =>
  authenticatedClient.request<ApplicantDecisionResponse>(
    `${listingInteractionPath(listingId)}/applicants/${encodeURIComponent(tenantId)}/decision`,
    {
      method: 'POST',
      body: { decision },
    }
  )

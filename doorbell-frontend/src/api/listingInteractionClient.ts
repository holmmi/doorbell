import { authenticatedClient } from './client'
import type { MatchResponse } from '../types/match'
import type {
  ApplicantDecision,
  ApplicantDecisionResponse,
  LandlordMatch,
  PendingApplicant,
} from '../types/listingInteraction'

export const getMatches = (signal?: AbortSignal): Promise<MatchResponse[]> =>
  authenticatedClient.request<MatchResponse[]>('/listing-interaction/matches', {
    signal,
  })

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
    `/listing-interaction/${encodeURIComponent(listingId)}/applicants/${encodeURIComponent(tenantId)}/decision`,
    {
      method: 'POST',
      body: { decision },
    }
  )

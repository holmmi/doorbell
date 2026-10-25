import type { ListingFeedItem, ListingFeedResponse } from './listing.js'

export const applicantDecisions = ['ACCEPTED', 'DECLINED'] as const
export type ApplicantDecision = (typeof applicantDecisions)[number]

export interface PreferenceInput {
  liked: boolean
}

export interface DecisionInput {
  decision: ApplicantDecision
}

export interface Applicant {
  tenantId: string
  firstName: string
  lastName: string
}

export interface LandlordContact {
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

export interface Match {
  createdAt: Date
  listing: Omit<ListingFeedItem, 'ownerId' | 'createdAt'>
  landlord: LandlordContact
}

export interface MatchResponse {
  createdAt: string
  listing: Omit<ListingFeedResponse, 'ownerId' | 'createdAt'>
  landlord: LandlordContact
}

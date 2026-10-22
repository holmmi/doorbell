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
  picturePath: string | null
}

export interface ApplicantsResponse {
  applicants: Applicant[]
  count: number
}

export interface LandlordContact {
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

export interface Match {
  listingId: string
  createdAt: Date
  listing: ListingFeedItem
  landlord: LandlordContact
}

export interface MatchResponse {
  listingId: string
  createdAt: string
  listing: ListingFeedResponse
  landlord: LandlordContact
}

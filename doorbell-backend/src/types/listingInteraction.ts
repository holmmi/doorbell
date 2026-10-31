import type {
  ListingFeedItem,
  ListingFeedResponse,
  ListingImage,
} from './listing.js'

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

export interface PendingApplicantRow {
  tenantId: string
  firstName: string
  lastName: string
  listing: Omit<ListingFeedItem, 'ownerId' | 'createdAt'> & {
    images: ListingImage[]
  }
}

export interface PendingApplicantResponse {
  tenantId: string
  firstName: string
  lastName: string
  listing: Omit<ListingFeedResponse, 'ownerId' | 'createdAt'>
}

export interface LandlordMatchRow {
  tenantId: string
  tenantFirstName: string
  tenantLastName: string
  tenantEmail: string
  tenantPhone: string | null
  listingId: string
  neighborhood: string
  city: string
}

export interface LandlordMatchResponse {
  tenantId: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  listing: {
    id: string
    neighborhood: string
    city: string
  }
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

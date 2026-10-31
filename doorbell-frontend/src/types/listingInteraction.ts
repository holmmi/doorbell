import type { Room } from './listing'

export type ApplicantDecision = 'ACCEPTED' | 'DECLINED'

export interface PendingApplicant {
  tenantId: string
  firstName: string
  lastName: string
  listing: {
    id: string
    monthlyPrice: string
    squareMeters: string
    neighborhood: string
    city: string
    availableFrom: string
    extraCosts: string
    rooms: Room
    published: boolean
    images: {
      id: string
      displayOrder: number
      imageUrl: string
    }[]
  }
}

export interface ApplicantDecisionResponse {
  listingId: string
  tenantId: string
  decision: ApplicantDecision
}

export interface LandlordMatch {
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

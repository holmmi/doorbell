import type { ListingFeedItem } from './listing'

export type { ListingFeedImage as ListingImage } from './listing'

export type MatchedListing = Omit<ListingFeedItem, 'ownerId' | 'createdAt'>

export interface LandlordContact {
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

export interface MatchResponse {
  createdAt: string
  listing: MatchedListing
  landlord: LandlordContact
}

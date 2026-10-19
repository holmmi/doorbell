import type { UserRole } from './user.js'

export const rooms = [
  'STUDIO',
  'ONE_ROOM_AND_KITCHEN',
  'TWO_ROOMS_AND_KITCHEN',
  'THREE_PLUS_ROOMS',
] as const

export type Room = (typeof rooms)[number]

export interface ListingInput {
  neighborhood: string
  city: string
  availableFrom: string
  rent: number
  squareMeters: number
  rooms: Room
  extraCosts?: string
}

export interface CreatedListing {
  id: string
}

export interface Listing {
  id: string
  ownerId: string
  createdAt: string
  monthlyPrice: string
  squareMeters: string
  neighborhood: string
  city: string
  availableFrom: string
  extraCosts: string
  rooms: Room
  published: boolean
}

export interface ListingImage {
  id: string
  imagePath: string
  displayOrder: number
}

export interface ListingImageResponse {
  id: string
  displayOrder: number
  imageUrl: string
}

export interface ListingDetails extends Listing {
  /**
   * Eligible for publication: at least one finalized image exists.
   * Pending uploads do not count. Publication itself is tracked by `published`.
   */
  ready: boolean
  images: ListingImage[]
}

export interface ListingDetailsResponse extends Listing {
  ready: boolean
  images: ListingImageResponse[]
}

export interface ListingFeedImage extends ListingImageResponse {
  imageUrl: string
}

export interface ListingFeedItem extends Listing {
  images: ListingImage[]
}

export interface ListingImageInput {
  id?: string
  objectKey?: string
  displayOrder: number
}

export interface ListingUpdateInput extends ListingInput {
  images?: ListingImageInput[]
}

export interface PresignedImage {
  objectKey: string
  uploadUrl: string
  expiresIn: number
}

export interface ImageUploadInput {
  objectKey: string
  displayOrder: number
}

export type ListingRole = Extract<UserRole, 'LANDLORD'>

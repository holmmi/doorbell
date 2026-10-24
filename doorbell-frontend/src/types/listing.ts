export const listingRooms = [
  'STUDIO',
  'ONE_ROOM_AND_KITCHEN',
  'TWO_ROOMS_AND_KITCHEN',
  'THREE_PLUS_ROOMS',
] as const

export type ListingRoom = (typeof listingRooms)[number]

export interface ListingInput {
  neighborhood: string
  city: string
  availableFrom: string
  rent: number
  squareMeters: number
  rooms: ListingRoom
  extraCosts?: string
}

export interface CreatedListing {
  id: string
}

export interface PresignedImageUpload {
  objectKey: string
  uploadUrl: string
  expiresIn: number
}

export interface ListingImageInput {
  objectKey: string
  displayOrder: number
}

export interface ListingDetails extends ListingInput {
  id: string
  published: boolean
  ready: boolean
  images: Array<{
    id: string
    displayOrder: number
    imageUrl: string
  }>
}

export interface PublishedListing {
  id: string
  published: boolean
}

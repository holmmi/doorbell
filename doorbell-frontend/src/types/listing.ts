export const rooms = [
  'STUDIO',
  'ONE_ROOM_AND_KITCHEN',
  'TWO_ROOMS_AND_KITCHEN',
  'THREE_PLUS_ROOMS',
] as const

export type Room = (typeof rooms)[number]

export interface ListingFeedImage {
  id: string
  displayOrder: number
  imageUrl: string
}

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

export interface PresignedImageUpload {
  objectKey: string
  uploadUrl: string
  expiresIn: number
}

export interface ListingImageInput {
  objectKey: string
  displayOrder: number
}

/** A listing as returned by `GET /api/listing`. */
export interface ListingFeedItem {
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
  images: ListingFeedImage[]
}

// GET/PUT /listing/:id response for the owner. `ready` means it has images.
export interface ListingDetails extends ListingFeedItem {
  ready: boolean
}

export interface PublishedListing {
  id: string
  published: boolean
}

export interface HomeListingImage {
  id: string
  url: string
}

export interface HomeListing {
  id: string
  createdAt: string
  monthlyPrice: number
  squareMeters: number
  neighborhood: string
  city: string
  availableFrom: string
  extraCosts: string
  rooms: Room
  images: HomeListingImage[]
}

export interface FeedFilters {
  city: string
  neighborhood: string
  /** 0 means no limit. */
  maxPrice: number
  /** 0 means any size. */
  minSize: number
}

export const toHomeListing = (item: ListingFeedItem): HomeListing => ({
  id: item.id,
  createdAt: item.createdAt,
  monthlyPrice: Number(item.monthlyPrice),
  squareMeters: Number(item.squareMeters),
  neighborhood: item.neighborhood,
  city: item.city,
  availableFrom: item.availableFrom,
  extraCosts: item.extraCosts,
  rooms: item.rooms,
  images: [...item.images]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((image) => ({ id: image.id, url: image.imageUrl })),
})

import type {
  ListingFeedItem,
  ListingFeedResponse,
  ListingImage,
  ListingImageResponse,
} from '../types/listing.js'
import { createPresignedImageDownload } from './imageService.js'

export const listingImageResponse = async (
  image: ListingImage
): Promise<ListingImageResponse> => ({
  id: image.id,
  displayOrder: image.displayOrder,
  imageUrl: await createPresignedImageDownload(image.imagePath),
})

export const listingFeedResponse = async (
  listing: ListingFeedItem
): Promise<ListingFeedResponse> => ({
  id: listing.id,
  ownerId: listing.ownerId,
  createdAt: listing.createdAt,
  monthlyPrice: listing.monthlyPrice,
  squareMeters: listing.squareMeters,
  neighborhood: listing.neighborhood,
  city: listing.city,
  availableFrom: listing.availableFrom,
  extraCosts: listing.extraCosts,
  rooms: listing.rooms,
  published: listing.published,
  images: await Promise.all(listing.images.map(listingImageResponse)),
})

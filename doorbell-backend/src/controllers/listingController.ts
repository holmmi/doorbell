import type { RequestHandler } from 'express'

import {
  createListing,
  findListingFeed,
  getListingDetails,
  publishListing,
  registerListingImageUpload,
  withOwnedListing,
} from '../repositories/listingRepository.js'
import {
  createPresignedImageDownload,
  createPresignedImageUpload,
} from '../services/imageService.js'
import {
  finalizeListingImage,
  updateRentalListingDetails,
} from '../services/listingService.js'
import type {
  ImageUploadInput,
  ListingInput,
  ListingUpdateInput,
} from '../types/listing.js'
import { RequestError } from '../utils/requestError.js'

const listingIdFromRequest = (request: Parameters<RequestHandler>[0]) => {
  const listingId = Number(request.params.listingId)
  if (!Number.isSafeInteger(listingId) || listingId <= 0) {
    throw new RequestError(404, 'error.listing.notFound')
  }
  return listingId.toString()
}

export const createRentalListing: RequestHandler = async (
  request,
  response
) => {
  const listing = await createListing(
    request.auth?.userId as string,
    request.body as ListingInput
  )
  response.status(201).json({ id: listing.id })
}

export const getRentalListing: RequestHandler = async (request, response) => {
  const listing = await withOwnedListing(
    listingIdFromRequest(request),
    request.auth?.userId as string,
    getListingDetails
  )
  response.json(listing)
}

export const getRentalListingFeed: RequestHandler = async (
  request,
  response
) => {
  const listings = await findListingFeed(
    request.auth?.userId,
    request.auth?.userId ? 10 : 2
  )
  const result = await Promise.all(
    listings.map(async (listing) => ({
      ...listing,
      images: await Promise.all(
        listing.images.map(async (image) => ({
          ...image,
          imageUrl: await createPresignedImageDownload(image.imagePath),
        }))
      ),
    }))
  )
  response.json(result)
}

export const updateRentalListing: RequestHandler = async (
  request,
  response
) => {
  const listing = await updateRentalListingDetails(
    listingIdFromRequest(request),
    request.auth?.userId as string,
    request.body as ListingUpdateInput
  )
  response.json(listing)
}

export const presignListingImage: RequestHandler = async (
  request,
  response
) => {
  const { contentType } = request.body as { contentType: string }
  const result = await withOwnedListing(
    listingIdFromRequest(request),
    request.auth?.userId as string,
    async (client, listing) => {
      const upload = await createPresignedImageUpload(
        'listings',
        listing.id,
        contentType
      )
      await registerListingImageUpload(
        client,
        listing.id,
        upload.objectKey,
        contentType
      )
      return upload
    }
  )
  response.json(result)
}

export const uploadListingImage: RequestHandler = async (request, response) => {
  const image = await finalizeListingImage(
    listingIdFromRequest(request),
    request.auth?.userId as string,
    request.body as ImageUploadInput
  )
  response.status(201).json(image)
}

export const publishRentalListing: RequestHandler = async (
  request,
  response
) => {
  const listing = await withOwnedListing(
    listingIdFromRequest(request),
    request.auth?.userId as string,
    (client, listing) => publishListing(client, listing.id)
  )
  response.json({ id: listing.id, published: listing.published })
}

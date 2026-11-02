import type { RequestHandler } from 'express'

import {
  createListing,
  findListingFeed,
  publishListing,
  registerListingImageUpload,
  withOwnedListing,
} from '../repositories/listingRepository.js'
import { createPresignedImageUpload } from '../services/imageService.js'
import {
  listingFeedResponse,
  listingImageResponse,
} from '../mappers/listingResponse.js'
import {
  finalizeListingImage,
  getRentalListingDetails,
  updateRentalListingDetails,
} from '../services/listingService.js'
import type {
  ImageUploadInput,
  ListingDetails,
  ListingInput,
  ListingDetailsResponse,
  ListingUpdateInput,
} from '../types/listing.js'
import { resourceIdFromRequest } from '../utils/resourceId.js'

const listingResponse = async (
  listing: ListingDetails
): Promise<ListingDetailsResponse> => ({
  ...(await listingFeedResponse(listing)),
  ready: listing.ready,
})

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
  const listing = await getRentalListingDetails(
    resourceIdFromRequest(request, 'listingId'),
    request.auth?.userId
  )
  response.json(await listingResponse(listing))
}

export const getRentalListingFeed: RequestHandler = async (
  request,
  response
) => {
  const listings = await findListingFeed(
    request.auth?.userId,
    request.auth?.userId ? 10 : 2
  )
  const result = await Promise.all(listings.map(listingFeedResponse))
  response.json(result)
}

export const updateRentalListing: RequestHandler = async (
  request,
  response
) => {
  const listing = await updateRentalListingDetails(
    resourceIdFromRequest(request, 'listingId'),
    request.auth?.userId as string,
    request.body as ListingUpdateInput
  )
  response.json(await listingResponse(listing))
}

export const presignListingImage: RequestHandler = async (
  request,
  response
) => {
  const { contentType } = request.body as { contentType: string }
  const result = await withOwnedListing(
    resourceIdFromRequest(request, 'listingId'),
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
    resourceIdFromRequest(request, 'listingId'),
    request.auth?.userId as string,
    request.body as ImageUploadInput
  )
  response.status(201).json(await listingImageResponse(image))
}

export const publishRentalListing: RequestHandler = async (
  request,
  response
) => {
  const listing = await withOwnedListing(
    resourceIdFromRequest(request, 'listingId'),
    request.auth?.userId as string,
    (client, listing) => publishListing(client, listing.id)
  )
  response.json({ id: listing.id, published: listing.published })
}

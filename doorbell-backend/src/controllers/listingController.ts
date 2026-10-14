import type { RequestHandler } from 'express'

import {
  createListing,
  createListingImage,
  findListingById,
  publishListing,
} from '../repositories/listingRepository.js'
import {
  createPresignedImageUpload,
  isListingKey,
  verifyImageObject,
} from '../services/imageService.js'
import type { ImageUploadInput, ListingInput } from '../types/listing.js'

const listingIdFromRequest = (request: Parameters<RequestHandler>[0]) => {
  const listingId = request.params.listingId
  return typeof listingId === 'string' ? listingId : undefined
}

const requireOwnedListing = async (
  request: Parameters<RequestHandler>[0],
  response: Parameters<RequestHandler>[1]
) => {
  const ownerId = request.auth?.userId
  const listingId = listingIdFromRequest(request)
  const listing = listingId ? await findListingById(listingId) : undefined

  if (!ownerId || !listing || listing.ownerId !== ownerId) {
    response.status(404).json({ error: 'error.listing.notFound' })
    return
  }

  return listing
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

export const presignListingImage: RequestHandler = async (
  request,
  response
) => {
  const listing = await requireOwnedListing(request, response)
  if (!listing) {
    return
  }

  const { contentType } = request.body as { contentType: string }
  const result = await createPresignedImageUpload(
    'listings',
    listing.id,
    contentType
  )
  response.json(result)
}

export const uploadListingImage: RequestHandler = async (request, response) => {
  const listing = await requireOwnedListing(request, response)
  if (!listing) {
    return
  }

  const input = request.body as unknown as ImageUploadInput
  if (!isListingKey(input.objectKey, listing.id)) {
    response.status(400).json({ error: 'error.listing.image.invalidKey' })
    return
  }

  await verifyImageObject(input.objectKey)
  const image = await createListingImage(listing.id, input)
  if (!image) {
    response.status(409).json({ error: 'error.listing.image.alreadyFinalized' })
    return
  }
  response.status(201).json(image)
}

export const publishRentalListing: RequestHandler = async (
  request,
  response
) => {
  const listing = await requireOwnedListing(request, response)
  if (!listing) {
    return
  }

  const publishedListing = await publishListing(listing.id, listing.ownerId)
  if (!publishedListing) {
    response.status(409).json({ error: 'error.listing.images.incomplete' })
    return
  }
  response.json({
    id: publishedListing.id,
    published: publishedListing.published,
  })
}

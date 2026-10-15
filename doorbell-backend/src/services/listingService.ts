import type { PoolClient } from 'pg'

import {
  consumeListingImageUpload,
  createListingImage,
  deleteListingImage,
  findListingImages,
  getListingDetails,
  queueListingImageCleanup,
  updateListing,
  updateListingImage,
  withOwnedListing,
} from '../repositories/listingRepository.js'
import type {
  ImageUploadInput,
  ListingImage,
  ListingUpdateInput,
} from '../types/listing.js'
import { RequestError } from '../utils/requestError.js'
import { isListingKey, verifyImageObject } from './imageService.js'

const verifyListingUpload = async (
  client: PoolClient,
  listingId: string,
  objectKey: string,
  images: ListingImage[]
): Promise<void> => {
  if (!isListingKey(objectKey, listingId)) {
    throw new RequestError(400, 'error.listing.image.invalidKey')
  }
  if (images.some((image) => image.imagePath === objectKey)) {
    throw new RequestError(409, 'error.listing.image.alreadyFinalized')
  }
  const contentType = await consumeListingImageUpload(
    client,
    listingId,
    objectKey
  )
  await verifyImageObject(objectKey, contentType)
}

export const finalizeListingImage = async (
  listingId: string,
  ownerId: string,
  input: ImageUploadInput
) =>
  withOwnedListing(listingId, ownerId, async (client) => {
    const images = await findListingImages(client, listingId)
    if (images.some((image) => image.displayOrder === input.displayOrder)) {
      throw new RequestError(409, 'error.listing.image.conflict')
    }
    await verifyListingUpload(client, listingId, input.objectKey, images)
    return createListingImage(client, listingId, input)
  })

export const updateRentalListingDetails = async (
  listingId: string,
  ownerId: string,
  input: ListingUpdateInput
) =>
  withOwnedListing(listingId, ownerId, async (client) => {
    if (input.images !== undefined) {
      const currentImages = await findListingImages(client, listingId)
      const imagesById = new Map(
        currentImages.map((image) => [image.id, image])
      )

      // Check the entire intended set before changing visible metadata. Consuming
      // upload records is rolled back if any object check or database write fails.
      for (const image of input.images) {
        if (image.id !== undefined && !imagesById.has(image.id)) {
          throw new RequestError(404, 'error.listing.image.notFound')
        }
      }
      for (const image of input.images) {
        if (image.objectKey !== undefined) {
          await verifyListingUpload(
            client,
            listingId,
            image.objectKey,
            currentImages
          )
        }
      }

      await client.query(
        'SET CONSTRAINTS rental_listing_image_listing_display_order_key DEFERRED'
      )
      const retainedIds = new Set(input.images.map((image) => image.id))
      for (const image of currentImages) {
        if (!retainedIds.has(image.id)) {
          await deleteListingImage(client, listingId, image.id)
          await queueListingImageCleanup(client, image.imagePath)
        }
      }
      for (const image of input.images) {
        const existing = image.id ? imagesById.get(image.id) : undefined
        if (existing) {
          await updateListingImage(client, listingId, {
            id: existing.id,
            imagePath: image.objectKey ?? existing.imagePath,
            displayOrder: image.displayOrder,
          })
          if (image.objectKey !== undefined) {
            await queueListingImageCleanup(client, existing.imagePath)
          }
        } else {
          await createListingImage(client, listingId, {
            objectKey: image.objectKey as string,
            displayOrder: image.displayOrder,
          })
        }
      }
    }

    const listing = await updateListing(client, listingId, input)
    return getListingDetails(client, listing)
  })

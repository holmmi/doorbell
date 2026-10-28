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
  withListingLock,
  withOwnedListing,
} from '../repositories/listingRepository.js'
import { findUserRoleById } from '../repositories/userRepository.js'
import type {
  ImageUploadInput,
  ListingImage,
  ListingImageInput,
  ListingUpdateInput,
} from '../types/listing.js'
import { RequestError } from '../utils/requestError.js'
import { isListingKey, verifyImageObject } from './imageService.js'

export const getRentalListingDetails = async (
  listingId: string,
  userId: string | undefined
) =>
  withListingLock(listingId, undefined, async (client, listing) => {
    if (
      !listing.published &&
      (listing.ownerId !== userId ||
        (await findUserRoleById(userId, client)) !== 'LANDLORD')
    ) {
      throw new RequestError(404, 'error.listing.notFound')
    }
    return getListingDetails(client, listing)
  })

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

const validateListingImages = async (
  client: PoolClient,
  listingId: string,
  images: ListingImageInput[],
  currentImages: ListingImage[]
): Promise<void> => {
  const currentIds = new Set(currentImages.map((image) => image.id))

  // Reject IDs from outside this listing before consuming any uploads.
  for (const image of images) {
    if (image.id !== undefined && !currentIds.has(image.id)) {
      throw new RequestError(404, 'error.listing.image.notFound')
    }
  }

  // Verify new/replacement objects and consume their unexpired upload records.
  // This uses the caller's transaction so a later failure restores those records.
  for (const image of images) {
    if (image.objectKey !== undefined) {
      await verifyListingUpload(
        client,
        listingId,
        image.objectKey,
        currentImages
      )
    }
  }
}

// Apply the validated complete image set using the caller's locked transaction.
const applyListingImageChanges = async (
  client: PoolClient,
  listingId: string,
  images: ListingImageInput[],
  currentImages: ListingImage[]
): Promise<void> => {
  const imagesById = new Map(currentImages.map((image) => [image.id, image]))

  // Check unique display orders at transaction commit so images can swap
  // positions (e.g. 1 and 2) without the first update causing a conflict.
  // Duplicate positions in the final image set still make the commit fail.
  await client.query(
    'SET CONSTRAINTS rental_listing_image_listing_display_order_key DEFERRED'
  )

  // Remove omitted images and queue their objects for cleanup after commit.
  // Deferring storage deletion ensures a rollback cannot leave missing files.
  const retainedIds = new Set(images.map((image) => image.id))
  for (const image of currentImages) {
    if (!retainedIds.has(image.id)) {
      await deleteListingImage(client, listingId, image.id)
      await queueListingImageCleanup(client, image.imagePath)
    }
  }

  // An ID retains or replaces an image; no ID adds a verified upload.
  for (const image of images) {
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

// Ownership, locking and rollback are shared by every step in this transaction.
export const updateRentalListingDetails = async (
  listingId: string,
  ownerId: string,
  input: ListingUpdateInput
) =>
  withOwnedListing(listingId, ownerId, async (client) => {
    // Omitted images preserve the current set; an empty array removes it.
    if (input.images !== undefined) {
      const currentImages = await findListingImages(client, listingId)
      await validateListingImages(
        client,
        listingId,
        input.images,
        currentImages
      )
      await applyListingImageChanges(
        client,
        listingId,
        input.images,
        currentImages
      )
    }

    // Saving details also unpublishes the listing if no images remain.
    const listing = await updateListing(client, listingId, input)
    return getListingDetails(client, listing)
  })

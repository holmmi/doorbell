import { authenticatedClient, ApiError } from './client'
import type {
  CreatedListing,
  ListingDetails,
  ListingImageInput,
  ListingInput,
  PresignedImageUpload,
  PublishedListing,
} from '../types/listing'

const listingPath = (listingId: string) =>
  `/listing/${encodeURIComponent(listingId)}`

export const createListing = (input: ListingInput): Promise<CreatedListing> =>
  authenticatedClient.request<CreatedListing>('/listing', {
    method: 'POST',
    body: input,
  })

export const getListing = (listingId: string): Promise<ListingDetails> =>
  authenticatedClient.request<ListingDetails>(listingPath(listingId))

export const requestImageUpload = (
  listingId: string,
  contentType: string
): Promise<PresignedImageUpload> =>
  authenticatedClient.request<PresignedImageUpload>(
    `${listingPath(listingId)}/images/presign`,
    { method: 'POST', body: { contentType } }
  )

export const uploadImage = async (
  uploadUrl: string,
  file: File
): Promise<void> => {
  let response: Response
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
  } catch {
    throw new ApiError(0, 'error.listing.image.uploadFailed')
  }

  if (!response.ok) {
    throw new ApiError(response.status, 'error.listing.image.uploadFailed')
  }
}

export const saveListingImages = (
  listingId: string,
  input: ListingInput,
  images: ListingImageInput[]
): Promise<ListingDetails> =>
  authenticatedClient.request<ListingDetails>(listingPath(listingId), {
    method: 'PUT',
    body: { ...input, images },
  })

export const publishListing = (listingId: string): Promise<PublishedListing> =>
  authenticatedClient.request<PublishedListing>(
    `${listingPath(listingId)}/publish`,
    { method: 'POST' }
  )

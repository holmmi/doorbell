import {
  ApiError,
  authenticatedClient,
  getToken,
  unauthenticatedClient,
} from './client'
import { toHomeListing } from '../types/listing'
import type {
  CreatedListing,
  HomeListing,
  ListingDetails,
  ListingImageInput,
  ListingFeedItem,
  ListingInput,
  PresignedImageUpload,
  PublishedListing,
} from '../types/listing'

// The feed does not support filters or report a total yet, so callers filter
// the returned page themselves.
export const getFeed = async (): Promise<HomeListing[]> => {
  const client = getToken() ? authenticatedClient : unauthenticatedClient
  const listings = await client.request<ListingFeedItem[]>('/listing')
  return listings.map(toHomeListing)
}

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

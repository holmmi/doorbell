import { authenticatedClient, ApiError } from './client'
import type {
  CreatedListing,
  ListingDetails,
  ListingImageInput,
  ListingInput,
  PresignedImageUpload,
  PublishedListing,
} from '../types/listing'

async function createListing(input: ListingInput): Promise<CreatedListing> {
  return authenticatedClient.request<CreatedListing>('/listing', {
    method: 'POST',
    body: input,
  })
}

async function requestImageUpload(
  listingId: string,
  contentType: string
): Promise<PresignedImageUpload> {
  return authenticatedClient.request<PresignedImageUpload>(
    `/listing/${encodeURIComponent(listingId)}/images/presign`,
    { method: 'POST', body: { contentType } }
  )
}

async function uploadImage(uploadUrl: string, file: File): Promise<void> {
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

async function saveListingImages(
  listingId: string,
  input: ListingInput,
  images: ListingImageInput[]
): Promise<ListingDetails> {
  return authenticatedClient.request<ListingDetails>(
    `/listing/${encodeURIComponent(listingId)}`,
    { method: 'PUT', body: { ...input, images } }
  )
}

async function publishListing(listingId: string): Promise<PublishedListing> {
  return authenticatedClient.request<PublishedListing>(
    `/listing/${encodeURIComponent(listingId)}/publish`,
    { method: 'POST' }
  )
}

export const listingClient = {
  createListing,
  requestImageUpload,
  uploadImage,
  saveListingImages,
  publishListing,
}

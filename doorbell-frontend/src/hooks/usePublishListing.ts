import { useState } from 'react'
import { ApiError } from '../api/client'
import * as listingClient from '../api/listingClient'
import type { ListingImageInput, ListingInput } from '../types/listing'
import { useListingPhotos } from './useListingPhotos'

export type PublishStage =
  'idle' | 'creating' | 'uploading' | 'saving' | 'publishing'

// Creates a draft, uploads the photos to S3, saves them and publishes the
// listing. Each step remembers its result, so a retry continues where the
// previous attempt failed instead of creating duplicates.
export const usePublishListing = () => {
  const listingPhotos = useListingPhotos()
  const { photos, setPhotoError, uploadPhotos, handleSaveError } = listingPhotos
  const [serverError, setServerError] = useState<string | null>(null)
  const [stage, setStage] = useState<PublishStage>('idle')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [imagesSaved, setImagesSaved] = useState(false)
  const [published, setPublished] = useState(false)

  const saveImages = async (
    listingId: string,
    values: ListingInput,
    images: ListingImageInput[]
  ) => {
    // A failed save may only have lost its response. Saving images is
    // all-or-nothing, so existing images mean that save went through.
    if (saveAttempted) {
      const listing = await listingClient.getListing(listingId)
      if (listing.images.length > 0) return
    }

    setSaveAttempted(true)
    try {
      await listingClient.updateListing(listingId, values, images)
    } catch (error) {
      handleSaveError(error)
      throw error
    }
  }

  const publish = async (values: ListingInput) => {
    setServerError(null)
    setPhotoError(null)

    if (!imagesSaved && photos.length === 0) {
      setPhotoError('listing.validation.photosRequired')
      return
    }

    try {
      let listingId = draftId
      if (!listingId) {
        setStage('creating')
        listingId = (await listingClient.createListing(values)).id
        setDraftId(listingId)
      }

      if (!imagesSaved) {
        setStage('uploading')
        const images = await uploadPhotos(listingId)
        setStage('saving')
        await saveImages(listingId, values, images)
        setImagesSaved(true)
      }

      setStage('publishing')
      await listingClient.publishListing(listingId)
      setPublished(true)
    } catch (error) {
      setServerError(error instanceof ApiError ? error.code : 'error.network')
    } finally {
      setStage('idle')
    }
  }

  return {
    ...listingPhotos,
    serverError,
    stage,
    // Photos and fields can't change once the images are saved.
    locked: stage !== 'idle' || imagesSaved,
    published,
    // Set once the draft exists, for the link to the edit view.
    listingId: draftId,
    publish,
  }
}

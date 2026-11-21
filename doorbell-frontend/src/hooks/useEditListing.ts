import { useState } from 'react'
import { ApiError } from '../api/client'
import * as listingClient from '../api/listingClient'
import type { ListingDetails, ListingInput } from '../types/listing'
import { useListingPhotos } from './useListingPhotos'

export type EditStage = 'idle' | 'uploading' | 'saving' | 'publishing'

export type EditNotice = 'saved' | 'reloaded' | 'published' | null

// Saves changes to an existing listing: uploads new photos, then replaces the
// details and the complete image set in one PUT /listing/:id.
export const useEditListing = (initialListing: ListingDetails) => {
  const listingPhotos = useListingPhotos(initialListing.images)
  const { uploadPhotos, handleSaveError, resetPhotos } = listingPhotos
  const [listing, setListing] = useState(initialListing)
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState<EditNotice>(null)
  const [stage, setStage] = useState<EditStage>('idle')

  const applySaved = (saved: ListingDetails, nextNotice: EditNotice) => {
    setListing(saved)
    resetPhotos(saved.images)
    setNotice(nextNotice)
  }

  // Returns the saved listing so the form can reset to it, or null on failure.
  const save = async (values: ListingInput) => {
    setServerError(null)
    setNotice(null)

    try {
      setStage('uploading')
      const images = await uploadPhotos(listing.id)
      setStage('saving')
      try {
        const saved = await listingClient.updateListing(
          listing.id,
          values,
          images
        )
        applySaved(saved, 'saved')
        return saved
      } catch (error) {
        // Upload keys are single-use. If the backend says one was already
        // added, an earlier save went through and only its response was lost.
        if (
          error instanceof ApiError &&
          error.code === 'error.listing.image.alreadyFinalized'
        ) {
          const current = await listingClient.getListing(listing.id)
          applySaved(current, 'reloaded')
          return current
        }
        handleSaveError(error)
        throw error
      }
    } catch (error) {
      setServerError(error instanceof ApiError ? error.code : 'error.network')
      return null
    } finally {
      setStage('idle')
    }
  }

  const publish = async () => {
    setServerError(null)
    setNotice(null)
    setStage('publishing')
    try {
      await listingClient.publishListing(listing.id)
      setListing((current) => ({ ...current, published: true }))
      setNotice('published')
    } catch (error) {
      setServerError(error instanceof ApiError ? error.code : 'error.network')
    } finally {
      setStage('idle')
    }
  }

  return {
    ...listingPhotos,
    listing,
    serverError,
    notice,
    stage,
    busy: stage !== 'idle',
    save,
    publish,
  }
}

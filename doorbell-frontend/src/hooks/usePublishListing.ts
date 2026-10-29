import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import * as listingClient from '../api/listingClient'
import type { ListingImageInput, ListingInput } from '../types/listing'

export type PendingPhoto = {
  key: string
  file: File
  previewUrl: string
  objectKey?: string
  uploadUrl?: string
  uploaded: boolean
}

export type PublishStage =
  'idle' | 'creating' | 'uploading' | 'saving' | 'publishing'

export const allowedPhotoTypes = ['image/png', 'image/jpg', 'image/jpeg']

// Save errors that mean the uploaded objects can't be used and must be redone.
const rejectedUploadCodes = new Set([
  'error.listing.image.invalidKey',
  'error.listing.image.notUploaded',
  'error.listing.image.invalidObject',
])

const withoutUpload = (photo: PendingPhoto): PendingPhoto => ({
  ...photo,
  objectKey: undefined,
  uploadUrl: undefined,
  uploaded: false,
})

// Creates a draft, uploads the photos to S3, saves them and publishes the
// listing. Each step remembers its result, so a retry continues where the
// previous attempt failed instead of creating duplicates.
export const usePublishListing = () => {
  const previewUrlsRef = useRef(new Set<string>())
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [stage, setStage] = useState<PublishStage>('idle')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [imagesSaved, setImagesSaved] = useState(false)
  const [published, setPublished] = useState(false)

  useEffect(() => {
    const previewUrls = previewUrlsRef.current
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const updatePhoto = (updatedPhoto: PendingPhoto) => {
    setPhotos((currentPhotos) =>
      currentPhotos.map((photo) =>
        photo.key === updatedPhoto.key ? updatedPhoto : photo
      )
    )
  }

  const addPhotos = (files: File[]) => {
    const supportedFiles = files.filter((file) =>
      allowedPhotoTypes.includes(file.type)
    )
    const nextPhotos = supportedFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file)
      previewUrlsRef.current.add(previewUrl)
      return { key: crypto.randomUUID(), file, previewUrl, uploaded: false }
    })

    setPhotos((currentPhotos) => [...currentPhotos, ...nextPhotos])
    setPhotoError(
      supportedFiles.length === files.length
        ? null
        : 'listing.validation.photoType'
    )
  }

  const removePhoto = (key: string) => {
    const photo = photos.find((currentPhoto) => currentPhoto.key === key)
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl)
      previewUrlsRef.current.delete(photo.previewUrl)
    }
    setPhotos((currentPhotos) =>
      currentPhotos.filter((currentPhoto) => currentPhoto.key !== key)
    )
  }

  const uploadPhotos = async (listingId: string) => {
    const images: ListingImageInput[] = []

    for (const [index, selectedPhoto] of photos.entries()) {
      let photo = selectedPhoto
      let { objectKey, uploadUrl } = photo

      if (!objectKey || !uploadUrl) {
        const upload = await listingClient.requestImageUpload(
          listingId,
          photo.file.type
        )
        ;({ objectKey, uploadUrl } = upload)
        photo = { ...photo, objectKey, uploadUrl }
        updatePhoto(photo)
      }

      if (!photo.uploaded) {
        try {
          await listingClient.uploadImage(uploadUrl, photo.file)
        } catch (error) {
          // The presigned URL may have expired; request a new one next time.
          updatePhoto(withoutUpload(photo))
          throw error
        }
        updatePhoto({ ...photo, uploaded: true })
      }

      images.push({ objectKey, displayOrder: index + 1 })
    }

    return images
  }

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
      await listingClient.saveListingImages(listingId, values, images)
    } catch (error) {
      // Upload records are single-use and expire. Start the uploads over on
      // the next try instead of resending rejected object keys.
      if (error instanceof ApiError && rejectedUploadCodes.has(error.code)) {
        setPhotos((currentPhotos) => currentPhotos.map(withoutUpload))
      }
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
    photos,
    photoError,
    serverError,
    stage,
    // Photos and fields can't change once the images are saved.
    locked: stage !== 'idle' || imagesSaved,
    published,
    addPhotos,
    removePhoto,
    publish,
  }
}

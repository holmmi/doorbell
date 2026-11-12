import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import * as listingClient from '../api/listingClient'
import type { ListingFeedImage, ListingImageInput } from '../types/listing'

// A photo already saved on the listing.
type SavedPhoto = {
  kind: 'saved'
  key: string
  id: string
  previewUrl: string
}

// A photo picked in this session. Upload state is kept so a retry only
// uploads what is still missing.
type NewPhoto = {
  kind: 'new'
  key: string
  file: File
  previewUrl: string
  objectKey?: string
  uploadUrl?: string
  uploaded: boolean
}

export type ListingPhoto = SavedPhoto | NewPhoto

export const allowedPhotoTypes = ['image/png', 'image/jpg', 'image/jpeg']

// Save errors that mean the uploaded objects can't be used and must be redone.
const rejectedUploadCodes = new Set([
  'error.listing.image.invalidKey',
  'error.listing.image.notUploaded',
  'error.listing.image.invalidObject',
])

const withoutUpload = (photo: ListingPhoto): ListingPhoto =>
  photo.kind === 'new'
    ? { ...photo, objectKey: undefined, uploadUrl: undefined, uploaded: false }
    : photo

const toSavedPhotos = (images: ListingFeedImage[]): ListingPhoto[] =>
  [...images]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((image) => ({
      kind: 'saved',
      key: image.id,
      id: image.id,
      previewUrl: image.imageUrl,
    }))

// Photo list for the listing forms. The list order is the display order and
// the first photo is the cover.
export const useListingPhotos = (savedImages: ListingFeedImage[] = []) => {
  const previewUrlsRef = useRef(new Set<string>())
  const [photos, setPhotos] = useState(() => toSavedPhotos(savedImages))
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    const previewUrls = previewUrlsRef.current
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const updatePhoto = (updatedPhoto: ListingPhoto) => {
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
    const nextPhotos = supportedFiles.map((file): ListingPhoto => {
      const previewUrl = URL.createObjectURL(file)
      previewUrlsRef.current.add(previewUrl)
      return {
        kind: 'new',
        key: crypto.randomUUID(),
        file,
        previewUrl,
        uploaded: false,
      }
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
    if (photo?.kind === 'new') {
      URL.revokeObjectURL(photo.previewUrl)
      previewUrlsRef.current.delete(photo.previewUrl)
    }
    setPhotos((currentPhotos) =>
      currentPhotos.filter((currentPhoto) => currentPhoto.key !== key)
    )
  }

  const movePhoto = (key: string, offset: -1 | 1) => {
    setPhotos((currentPhotos) => {
      const from = currentPhotos.findIndex((photo) => photo.key === key)
      const to = from + offset
      if (from < 0 || to < 0 || to >= currentPhotos.length) return currentPhotos
      const next = [...currentPhotos]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  }

  // Uploads the new photos to S3 and returns the complete image set in display
  // order, ready for PUT /listing/:id.
  const uploadPhotos = async (listingId: string) => {
    const images: ListingImageInput[] = []

    for (const [index, selectedPhoto] of photos.entries()) {
      const displayOrder = index + 1
      if (selectedPhoto.kind === 'saved') {
        images.push({ id: selectedPhoto.id, displayOrder })
        continue
      }

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

      images.push({ objectKey, displayOrder })
    }

    return images
  }

  // Upload records are single-use and expire. When the backend rejects them,
  // start the uploads over on the next try instead of resending the keys.
  const handleSaveError = (error: unknown) => {
    if (error instanceof ApiError && rejectedUploadCodes.has(error.code)) {
      setPhotos((currentPhotos) => currentPhotos.map(withoutUpload))
    }
  }

  // Replaces the list with what the backend saved, so new photos become saved
  // photos with ids for the next update.
  const resetPhotos = (images: ListingFeedImage[]) => {
    setPhotos(toSavedPhotos(images))
  }

  return {
    photos,
    photoError,
    setPhotoError,
    addPhotos,
    removePhoto,
    movePhoto,
    uploadPhotos,
    handleSaveError,
    resetPhotos,
  }
}

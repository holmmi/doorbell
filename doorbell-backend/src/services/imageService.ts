import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { getObjectStorage } from '../config/objectStorage.js'
import type { PresignedImage } from '../types/listing.js'

const uploadUrlLifetimeSeconds = 900
const allowedContentTypes = new Set(['image/png', 'image/jpg', 'image/jpeg'])

export type ImageOwner = 'listings' | 'users'

const contentTypeSuffixes: Record<string, string> = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpeg',
}

export const createPresignedImageUpload = async (
  ownerType: ImageOwner,
  ownerId: string,
  contentType: string
): Promise<PresignedImage> => {
  if (!allowedContentTypes.has(contentType)) {
    throw new Error('Unsupported image content type')
  }

  const objectKey = `${ownerType}/${ownerId}/${crypto.randomUUID()}.${contentTypeSuffixes[contentType]}`
  const { bucket, client } = getObjectStorage()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  })
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: uploadUrlLifetimeSeconds,
  })

  return { objectKey, uploadUrl, expiresIn: uploadUrlLifetimeSeconds }
}

export const verifyImageObject = async (objectKey: string): Promise<void> => {
  const { bucket, client } = getObjectStorage()
  const object = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
  )

  if (!object.ContentType || !allowedContentTypes.has(object.ContentType)) {
    throw new Error('Unsupported image content type')
  }
}

export const isListingKey = (objectKey: string, listingId: string): boolean =>
  objectKey.startsWith(`listings/${listingId}/`)

export const isProfilePictureKey = (
  objectKey: string,
  userId: string
): boolean => objectKey.startsWith(`users/${userId}/`)

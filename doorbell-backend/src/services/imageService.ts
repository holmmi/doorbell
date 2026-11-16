import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { getObjectStorage } from '../config/objectStorage.js'
import type { PresignedImage } from '../types/listing.js'
import { RequestError } from '../utils/requestError.js'

const uploadUrlLifetimeSeconds = 900
export const downloadUrlLifetimeSeconds = 900
const allowedContentTypes = new Set(['image/png', 'image/jpg', 'image/jpeg'])

export type ImageType = 'listings' | 'users'

const contentTypeSuffixes: Record<string, string> = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpeg',
}

export const createPresignedImageUpload = async (
  imageType: ImageType,
  id: string,
  contentType: string
): Promise<PresignedImage> => {
  if (!allowedContentTypes.has(contentType)) {
    throw new Error('Unsupported image content type')
  }

  const objectKey = `${imageType}/${id}/${crypto.randomUUID()}.${contentTypeSuffixes[contentType]}`
  const { bucket, client } = getObjectStorage()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  })
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: uploadUrlLifetimeSeconds,
    signableHeaders: new Set(['content-type']),
  })

  return { objectKey, uploadUrl, expiresIn: uploadUrlLifetimeSeconds }
}

export const createPresignedImageDownload = async (
  objectKey: string
): Promise<string> => {
  const { bucket, client } = getObjectStorage()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: downloadUrlLifetimeSeconds }
  )
}

export const verifyImageObject = async (
  objectKey: string,
  expectedContentType: string,
  errorPrefix:
    'error.listing.image' | 'error.user.picture' = 'error.listing.image'
): Promise<void> => {
  const { bucket, client } = getObjectStorage()
  try {
    const object = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
    )
    if (
      object.ContentType !== expectedContentType ||
      !allowedContentTypes.has(object.ContentType) ||
      !object.ContentLength ||
      object.ContentLength < 0
    ) {
      throw new RequestError(400, `${errorPrefix}.invalidObject`)
    }
  } catch (error) {
    if (
      error instanceof S3ServiceException &&
      error.$metadata.httpStatusCode === 404
    ) {
      throw new RequestError(409, `${errorPrefix}.notUploaded`)
    }
    throw error
  }
}

export const deleteImageObject = async (objectKey: string): Promise<void> => {
  const { bucket, client } = getObjectStorage()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}

export const isListingKey = (objectKey: string, listingId: string): boolean =>
  objectKey.startsWith(`listings/${listingId}/`)

export const isProfilePictureKey = (
  objectKey: string,
  userId: string
): boolean => {
  const prefix = `users/${userId}/`
  // Legacy saved references must not traverse out of the account's namespace
  // when converted into a URL. Issued uploads always use a simple UUID filename.
  return (
    objectKey.startsWith(prefix) &&
    /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg)$/.test(objectKey.slice(prefix.length))
  )
}

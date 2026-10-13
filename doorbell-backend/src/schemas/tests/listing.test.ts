import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isListingKey,
  isProfilePictureKey,
} from '../../services/imageService.js'
import {
  uploadImageSchema,
  listingSchema,
  presignImageSchema,
} from '../listing.js'

void test('listing schema accepts the landlord listing fields', () => {
  const result = listingSchema.safeParse({
    neighborhood: 'Kallio',
    city: 'Helsinki',
    availableFrom: '2026-11-01',
    rent: 1250,
    squareMeters: 42.5,
    rooms: 'ONE_ROOM_AND_KITCHEN',
    extraCosts: 'Water 25 EUR/month',
  })

  assert.equal(result.success, true)
})

void test('listing schema rejects invalid dates and numeric values', () => {
  const result = listingSchema.safeParse({
    neighborhood: 'Kallio',
    city: 'Helsinki',
    availableFrom: '2026-02-30',
    rent: 0,
    squareMeters: -1,
    rooms: 'ONE_ROOM_AND_KITCHEN',
  })

  assert.equal(result.success, false)
})

void test('presign schema allows only supported image content types', () => {
  assert.equal(
    presignImageSchema.safeParse({
      contentType: 'image/png',
      displayOrder: 0,
    }).success,
    true
  )
  assert.equal(
    presignImageSchema.safeParse({
      contentType: 'image/webp',
      displayOrder: 0,
    }).success,
    false
  )
})

void test('image upload requires a non-negative display order', () => {
  assert.equal(
    uploadImageSchema.safeParse({
      objectKey: 'listings/1/image.png',
      displayOrder: -1,
    }).success,
    false
  )
})

void test('image keys are separated between listings and profile pictures', () => {
  assert.equal(isListingKey('listings/42/image.png', '42'), true)
  assert.equal(isListingKey('users/42/image.png', '42'), false)
  assert.equal(isProfilePictureKey('users/42/avatar.jpeg', '42'), true)
  assert.equal(isProfilePictureKey('listings/42/image.jpeg', '42'), false)
})

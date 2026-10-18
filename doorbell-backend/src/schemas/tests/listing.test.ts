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
  updateListingSchema,
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

const validListing = {
  neighborhood: 'Kallio',
  city: 'Helsinki',
  availableFrom: '2026-11-01',
  rent: 1250,
  squareMeters: 42.5,
  rooms: 'ONE_ROOM_AND_KITCHEN',
}

void test('updates use the create schema and require all editable fields', () => {
  assert.deepEqual(updateListingSchema.parse(validListing), validListing)
  for (const key of Object.keys(validListing)) {
    const input = { ...validListing }
    delete input[key as keyof typeof input]
    assert.equal(updateListingSchema.safeParse(input).success, false, key)
  }
})

for (const change of [
  { neighborhood: '' },
  { city: '' },
  { availableFrom: '2026-02-30' },
  { availableFrom: '2026-11-01T00:00:00Z' },
  { rent: 0 },
  { rent: 0.001 },
  { rent: 100000000 },
  { rent: '1250' },
  { squareMeters: -1 },
  { squareMeters: 1000000 },
  { rooms: 'FIVE_ROOMS' },
  { extraCosts: null },
]) {
  void test(`create and update reject invalid fields: ${JSON.stringify(change)}`, () => {
    const input = { ...validListing, ...change }
    assert.equal(listingSchema.safeParse(input).success, false)
    assert.equal(updateListingSchema.safeParse(input).success, false)
  })
}

void test('update schema accepts keep, add, replace, reorder and remove inputs', () => {
  for (const images of [
    undefined,
    [],
    [
      { id: '9007199254740993', displayOrder: 3 },
      { objectKey: 'listings/42/new.png', displayOrder: 1 },
      { id: '2', objectKey: 'listings/42/replacement.jpg', displayOrder: 2 },
    ],
  ]) {
    assert.equal(
      updateListingSchema.safeParse({ ...validListing, images }).success,
      true
    )
  }
})

for (const images of [
  [{ displayOrder: 1 }],
  [{ id: '1', displayOrder: 0 }],
  [{ id: '1', displayOrder: -1 }],
  [{ id: '1', displayOrder: 0.5 }],
  [{ id: '1', displayOrder: 2147483648 }],
  [{ id: '9223372036854775808', displayOrder: 1 }],
  [{ id: '01', displayOrder: 1 }],
  [{ id: 'not-an-id', displayOrder: 1 }],
  [
    { id: '1', displayOrder: 1 },
    { id: '2', displayOrder: 1 },
  ],
  [
    { id: '1', displayOrder: 1 },
    { id: '1', displayOrder: 2 },
  ],
  [
    { objectKey: 'listings/42/same.png', displayOrder: 1 },
    { objectKey: 'listings/42/same.png', displayOrder: 2 },
  ],
]) {
  void test(`update schema rejects invalid image sets: ${JSON.stringify(images)}`, () => {
    assert.equal(
      updateListingSchema.safeParse({ ...validListing, images }).success,
      false
    )
  })
}

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
    }).success,
    true
  )
  assert.equal(
    presignImageSchema.safeParse({
      contentType: 'image/webp',
    }).success,
    false
  )
})

void test('image upload requires a positive 32-bit integer display order', () => {
  for (const displayOrder of [-1, 0, 0.5, 2147483648]) {
    assert.equal(
      uploadImageSchema.safeParse({
        objectKey: 'listings/1/image.png',
        displayOrder,
      }).success,
      false
    )
  }
  for (const displayOrder of [1, 2147483647]) {
    assert.equal(
      uploadImageSchema.safeParse({
        objectKey: 'listings/1/image.png',
        displayOrder,
      }).success,
      true
    )
  }
})

void test('image keys are separated between listings and profile pictures', () => {
  assert.equal(isListingKey('listings/42/image.png', '42'), true)
  assert.equal(isListingKey('users/42/image.png', '42'), false)
  assert.equal(isProfilePictureKey('users/42/avatar.jpeg', '42'), true)
  assert.equal(isProfilePictureKey('listings/42/image.jpeg', '42'), false)
})

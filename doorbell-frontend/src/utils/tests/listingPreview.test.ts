import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ListingDetails } from '../../types/listing.ts'
import { detailsToPreview } from '../listingPreview.ts'

// The exact shape GET /api/listing/mine returns for each listing.
const listing: ListingDetails = {
  id: '123',
  ownerId: '192',
  createdAt: '2026-11-20',
  monthlyPrice: '1950.00',
  squareMeters: '43.50',
  neighborhood: 'Kallio',
  city: 'Helsinki',
  availableFrom: '2026-12-01',
  extraCosts: '€30 / month (water)',
  rooms: 'TWO_ROOMS_AND_KITCHEN',
  published: true,
  ready: true,
  images: [
    {
      id: '9',
      displayOrder: 2,
      imageUrl: 'https://storage.example.com/second.png',
    },
    {
      id: '8',
      displayOrder: 1,
      imageUrl: 'https://storage.example.com/cover.png',
    },
  ],
}

void test('detailsToPreview turns price and size strings into numbers', () => {
  const preview = detailsToPreview(listing)
  assert.equal(preview.rent, 1950)
  assert.equal(preview.squareMeters, 43.5)
})

void test('detailsToPreview uses the image with the lowest display order as the cover', () => {
  assert.equal(
    detailsToPreview(listing).imageUrl,
    'https://storage.example.com/cover.png'
  )
})

void test('detailsToPreview has no cover for a listing without images', () => {
  assert.equal(detailsToPreview({ ...listing, images: [] }).imageUrl, undefined)
})

void test('detailsToPreview keeps the creation date for the "New today" tag', () => {
  assert.equal(detailsToPreview(listing).createdAt, '2026-11-20')
})

import { z } from 'zod'

import { rooms } from '../types/listing.js'

export const listingSchema = z.object({
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  availableFrom: z.iso.date(),
  rent: z.number().positive(),
  squareMeters: z.number().positive(),
  rooms: z.enum(rooms),
  extraCosts: z.string().optional(),
})

export const presignImageSchema = z.object({
  contentType: z.enum(['image/png', 'image/jpg', 'image/jpeg']),
  displayOrder: z.number().int().nonnegative(),
})

export const uploadImageSchema = z.object({
  objectKey: z.string().min(1),
  displayOrder: z.number().int().nonnegative(),
})

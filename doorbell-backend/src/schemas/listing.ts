import { z } from 'zod'

import { rooms } from '../types/listing.js'

const imageIdSchema = z
  .string()
  .refine(
    (value) =>
      /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
  )

export const listingSchema = z.object({
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  availableFrom: z.iso.date(),
  rent: z.number().min(0.01).max(99999999.99),
  squareMeters: z.number().min(0.01).max(999999.99),
  rooms: z.enum(rooms),
  extraCosts: z.string().optional(),
})

export const presignImageSchema = z.object({
  contentType: z.enum(['image/png', 'image/jpg', 'image/jpeg']),
})

export const uploadImageSchema = z.object({
  objectKey: z.string().min(1),
  displayOrder: z.int32().positive(),
})

const listingImageSchema = z
  .object({
    id: imageIdSchema.optional(),
    objectKey: z.string().min(1).optional(),
    displayOrder: z.int32().positive(),
  })
  .refine((image) => image.id !== undefined || image.objectKey !== undefined, {
    error: 'error.listing.image.idOrKeyRequired',
  })

export const updateListingSchema = listingSchema.extend({
  images: z
    .array(listingImageSchema)
    .superRefine((images, context) => {
      for (const field of ['id', 'objectKey', 'displayOrder'] as const) {
        const values = images
          .map((image) => image[field])
          .filter((value) => value !== undefined)
        if (new Set(values).size !== values.length) {
          context.addIssue({
            code: 'custom',
            message: `error.listing.image.duplicate.${field}`,
          })
        }
      }
    })
    .optional(),
})

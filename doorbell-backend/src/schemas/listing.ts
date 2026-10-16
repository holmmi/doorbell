import { z } from 'zod'

import { rooms } from '../types/listing.js'

export const listingIdSchema = z
  .string()
  .refine(
    (value) =>
      /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
  )

const displayOrderSchema = z.number().int().nonnegative().max(2147483647)

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
  displayOrder: displayOrderSchema,
})

const listingImageSchema = z
  .object({
    id: listingIdSchema.optional(),
    objectKey: z.string().min(1).optional(),
    displayOrder: displayOrderSchema,
  })
  .refine((image) => image.id !== undefined || image.objectKey !== undefined, {
    message: 'An image ID or object key is required',
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
            message: `Duplicate image ${field}`,
          })
        }
      }
    })
    .optional(),
})

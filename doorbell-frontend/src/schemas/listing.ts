import { z } from 'zod'
import { rooms } from '../types/listing'

const amount = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'listing.validation.required')
    .refine(
      (value) => Number.isFinite(Number(value)),
      'listing.validation.number'
    )
    .transform(Number)
    .refine(
      (value) => value >= 0.01 && value <= max,
      'listing.validation.range'
    )

export const listingFormSchema = z.object({
  neighborhood: z.string().trim().min(1, 'listing.validation.required'),
  city: z.string().trim().min(1, 'listing.validation.required'),
  availableFrom: z.iso.date('listing.validation.date'),
  rent: amount(99999999.99),
  squareMeters: amount(999999.99),
  rooms: z.enum(rooms),
  extraCosts: z.string().optional(),
})

export type ListingFormInput = z.input<typeof listingFormSchema>
export type ListingFormValues = z.output<typeof listingFormSchema>

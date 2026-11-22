import { z } from 'zod'
import {
  rooms,
  type ListingDetails,
  type ListingPreview,
} from '../types/listing'

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

export const emptyListingForm: ListingFormInput = {
  neighborhood: '',
  city: '',
  availableFrom: '',
  rent: '',
  squareMeters: '',
  rooms: 'STUDIO',
  extraCosts: '',
}

// Numeric columns arrive as strings like "1950.00"; show them as "1950".
export const listingToFormInput = (
  listing: ListingDetails
): ListingFormInput => ({
  neighborhood: listing.neighborhood,
  city: listing.city,
  availableFrom: listing.availableFrom,
  rent: String(Number(listing.monthlyPrice)),
  squareMeters: String(Number(listing.squareMeters)),
  rooms: listing.rooms,
  extraCosts: listing.extraCosts,
})

// What the live preview card shows while the form is being edited.
export const formToPreview = (
  draft: ListingFormInput,
  imageUrl: string | undefined,
  createdAt?: string
): ListingPreview => ({
  neighborhood: draft.neighborhood,
  city: draft.city,
  availableFrom: draft.availableFrom,
  rent: Number(draft.rent) || 0,
  squareMeters: Number(draft.squareMeters) || 0,
  rooms: draft.rooms,
  extraCosts: draft.extraCosts ?? '',
  imageUrl,
  createdAt,
})

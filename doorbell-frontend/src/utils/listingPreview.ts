import type { ListingDetails, ListingPreview } from '../types/listing'

// What the preview card shows for a saved listing. Prices arrive as strings
// ("1950.00") and the cover is the image with the lowest display order.
export const detailsToPreview = (listing: ListingDetails): ListingPreview => {
  const [cover] = [...listing.images].sort(
    (a, b) => a.displayOrder - b.displayOrder
  )
  return {
    neighborhood: listing.neighborhood,
    city: listing.city,
    availableFrom: listing.availableFrom,
    rent: Number(listing.monthlyPrice),
    squareMeters: Number(listing.squareMeters),
    rooms: listing.rooms,
    extraCosts: listing.extraCosts,
    imageUrl: cover?.imageUrl,
    createdAt: listing.createdAt,
  }
}

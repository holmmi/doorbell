import {
  findListingFeed,
  findPublishedLocations,
} from '../repositories/listingRepository.js'
import type {
  ListingFeedFilters,
  ListingFilterOptions,
} from '../types/listing.js'
import {
  locationFilterValues,
  locationOptions,
} from '../utils/listingLocations.js'

export const getListingFeed = async (
  userId: string | undefined,
  limit: number,
  filters: ListingFeedFilters
) => {
  const locations = filters.city ? await findPublishedLocations() : []
  return findListingFeed(userId, limit, {
    ...locationFilterValues(locations, filters),
    maxPrice: filters.maxPrice,
    minPrice: filters.minPrice,
    minSize: filters.minSize,
  })
}

export const getListingFilterOptions =
  async (): Promise<ListingFilterOptions> => ({
    locations: locationOptions(await findPublishedLocations()),
    priceRanges: [
      { minPrice: null, maxPrice: '499.99' },
      { minPrice: '500.00', maxPrice: '999.99' },
      { minPrice: '1000.00', maxPrice: '1999.99' },
      { minPrice: '2000.00', maxPrice: '2999.99' },
      { minPrice: '3000.00', maxPrice: null },
    ],
  })

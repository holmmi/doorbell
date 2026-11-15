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
    minSize: filters.minSize,
  })
}

export const getListingFilterOptions =
  async (): Promise<ListingFilterOptions> => ({
    locations: locationOptions(await findPublishedLocations()),
    maxPrices: ['500.00', '1000.00', '2000.00', '3000.00'],
  })

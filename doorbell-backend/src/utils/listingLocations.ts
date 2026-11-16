import type {
  ListingFeedDatabaseFilters,
  ListingFeedFilters,
  ListingFilterOptions,
  ListingLocation,
} from '../types/listing.js'

const normalizeLocation = (value: string) => value.trim().toLowerCase()

// Pass the matching stored spellings to SQL so it can filter before LIMIT.
// This also supports legacy listings with whitespace without rewriting them.
export const locationFilterValues = (
  locations: ListingLocation[],
  filters: ListingFeedFilters
): Pick<ListingFeedDatabaseFilters, 'cities' | 'neighborhoods'> => {
  const city = normalizeLocation(filters.city ?? '')
  const neighborhood = normalizeLocation(filters.neighborhood ?? '')
  const cityLocations = locations.filter(
    (location) => normalizeLocation(location.city) === city
  )
  return {
    cities: city
      ? [...new Set(cityLocations.map((location) => location.city))]
      : undefined,
    neighborhoods: neighborhood
      ? [
          ...new Set(
            cityLocations
              .filter(
                (location) =>
                  normalizeLocation(location.neighborhood) === neighborhood
              )
              .map((location) => location.neighborhood)
          ),
        ]
      : undefined,
  }
}

const uniqueLocations = (values: string[]) => {
  const byName = new Map<string, string>()
  for (const value of values.map((value) => value.trim()).sort()) {
    const key = normalizeLocation(value)
    if (key && !byName.has(key)) byName.set(key, value)
  }
  return [...byName.keys()].sort().map((key) => byName.get(key)!)
}

export const locationOptions = (
  locations: ListingLocation[]
): ListingFilterOptions['locations'] =>
  uniqueLocations(locations.map(({ city }) => city)).map((city) => ({
    city,
    neighborhoods: uniqueLocations(
      locations
        .filter(
          (location) =>
            normalizeLocation(location.city) === normalizeLocation(city)
        )
        .map(({ neighborhood }) => neighborhood)
    ),
  }))

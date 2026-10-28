import { toHomeListing } from '../types/listing'
import type { HomeListing, ListingFeedItem } from '../types/listing'
import { authenticatedClient, getToken, unauthenticatedClient } from './client'

// The feed does not support filters or report a total yet, so callers filter
// the returned page themselves.
const getFeed = async (): Promise<HomeListing[]> => {
  const client = getToken() ? authenticatedClient : unauthenticatedClient
  const listings = await client.request<ListingFeedItem[]>('/listing')
  return listings.map(toHomeListing)
}

export const listingClient = {
  getFeed,
}

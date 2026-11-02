import type { MatchResponse } from '../types/match'
import { authenticatedClient } from './client'

export const getMatches = (signal?: AbortSignal): Promise<MatchResponse[]> =>
  authenticatedClient.request<MatchResponse[]>('/listing-interaction/matches', {
    signal,
  })

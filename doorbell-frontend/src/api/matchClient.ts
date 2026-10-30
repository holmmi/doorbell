import type { MatchResponse } from '../types/match'
import { authenticatedClient } from './client'

export const getMatches = (): Promise<MatchResponse[]> =>
  authenticatedClient.request<MatchResponse[]>('/listing-interaction/matches')

import { createContext, use } from 'react'
import type { MatchResponse } from '../types/match'

export interface MatchesState {
  matches: MatchResponse[] | null
  loading: boolean
  error: boolean
  forbidden: boolean
  refresh: () => Promise<void>
}

export const MatchesContext = createContext<MatchesState | null>(null)

export function useMatches() {
  const matches = use(MatchesContext)
  if (!matches) throw new Error('MatchesProvider is missing')
  return matches
}

import { use } from 'react'
import { MatchesContext } from '../state/MatchesProvider'

export const useMatches = () => {
  const matches = use(MatchesContext)
  if (!matches)
    throw new Error('useMatches must be used inside MatchesProvider')
  return matches
}

import type { ReactNode } from 'react'
import { LikesProvider } from './LikesProvider'
import { MatchesProvider } from './MatchesProvider'

export const InteractionsProvider = ({ children }: { children: ReactNode }) => (
  <MatchesProvider>
    <LikesProvider>{children}</LikesProvider>
  </MatchesProvider>
)

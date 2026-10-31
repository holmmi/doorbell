import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '../api/client'
import * as matchClient from '../api/matchClient'
import { useAuth } from '../hooks/useAuth'
import type { MatchResponse } from '../types/match'

interface MatchesState {
  matches: MatchResponse[] | null
  loading: boolean
  error: boolean
  forbidden: boolean
}

// eslint-disable-next-line react-refresh/only-export-components -- Shared with useMatches.
export const MatchesContext = createContext<
  (MatchesState & { refresh: () => void }) | null
>(null)

export const MatchesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  // Remount the cache and its consumers on login/logout so no account data survives.
  return (
    <MatchesSession key={user?.id ?? 'anonymous'}>{children}</MatchesSession>
  )
}

const MatchesSession = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth()
  const tenant = user?.role === 'TENANT'
  const [state, setState] = useState<MatchesState>({
    matches: null,
    loading: tenant,
    error: false,
    forbidden: false,
  })
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true, error: false }))
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!tenant) return
    const controller = new AbortController()
    void matchClient.getMatches(controller.signal).then(
      (matches) => {
        if (!controller.signal.aborted) {
          setState({ matches, loading: false, error: false, forbidden: false })
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          logout()
        } else if (error instanceof ApiError && error.status === 403) {
          setState({
            matches: null,
            loading: false,
            error: false,
            forbidden: true,
          })
        } else {
          setState((previous) => ({ ...previous, loading: false, error: true }))
        }
      }
    )
    return () => controller.abort()
  }, [tenant, revision, logout])

  return (
    <MatchesContext value={{ ...state, refresh }}>{children}</MatchesContext>
  )
}

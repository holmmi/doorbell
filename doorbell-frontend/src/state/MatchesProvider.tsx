import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, getToken } from '../api/client'
import * as matchClient from '../api/matchClient'
import { MatchesContext, type MatchesState } from './matchesContext'
import { useAuth } from '../hooks/useAuth'

export function MatchesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  return <MatchesSession key={token ?? 'anonymous'}>{children}</MatchesSession>
}

function MatchesSession({ children }: { children: ReactNode }) {
  const { token, user, expire } = useAuth()
  const tenant = user?.role === 'TENANT'
  const [state, setState] = useState<Omit<MatchesState, 'refresh'>>({
    matches: null,
    loading: false,
    error: false,
    forbidden: false,
  })
  const pendingRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback((): Promise<void> => {
    if (!tenant || getToken() !== token) return Promise.resolve()
    if (pendingRef.current) return pendingRef.current
    const isCurrent = () => mountedRef.current && getToken() === token
    const request = (async () => {
      // Defer startup until mount effects have completed, including StrictMode replay.
      await Promise.resolve()
      if (!isCurrent()) return
      setState((previous) => ({ ...previous, loading: true, error: false }))
      try {
        const matches = await matchClient.getMatches()
        if (isCurrent()) {
          setState({ matches, loading: false, error: false, forbidden: false })
        }
      } catch (error) {
        if (!isCurrent()) return
        if (error instanceof ApiError && error.status === 401) {
          expire()
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
    })().finally(() => {
      pendingRef.current = null
    })
    pendingRef.current = request
    return request
  }, [tenant, token, expire])

  useEffect(() => {
    if (tenant) void refresh()
  }, [tenant, refresh])

  return (
    <MatchesContext value={{ ...state, refresh }}>{children}</MatchesContext>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { getMyListings } from '../api/listingClient'
import type { ListingDetails } from '../types/listing'
import { useAuth } from './useAuth'

type MyListingsState =
  | { status: 'loading' }
  | { status: 'error'; errorCode: string }
  | { status: 'loaded'; listings: ListingDetails[] }

// Loads every listing the signed-in landlord owns from GET /api/listing/mine.
export const useMyListings = () => {
  const { logout } = useAuth()
  const [state, setState] = useState<MyListingsState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getMyListings(controller.signal).then(
      (listings) => {
        if (!controller.signal.aborted) setState({ status: 'loaded', listings })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        // An expired session signs out; ProtectedRoute then shows login.
        if (error instanceof ApiError && error.status === 401) {
          logout()
          return
        }
        setState({
          status: 'error',
          errorCode: error instanceof ApiError ? error.code : 'error.network',
        })
      }
    )
    return () => controller.abort()
  }, [revision, logout])

  return { state, retry }
}

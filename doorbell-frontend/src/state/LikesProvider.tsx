import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '../api/client'
import { getPendingApplicants } from '../api/listingInteractionClient'
import { useAuth } from '../hooks/useAuth'

interface LikesState {
  pendingCount: number | null
  loading: boolean
  error: boolean
}

// eslint-disable-next-line react-refresh/only-export-components -- Shared with useLikes.
export const LikesContext = createContext<
  (LikesState & { refresh: () => void }) | null
>(null)

export const LikesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  return <LikesSession key={user?.id ?? 'anonymous'}>{children}</LikesSession>
}

const LikesSession = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth()
  const landlord = user?.role === 'LANDLORD'
  const [state, setState] = useState<LikesState>({
    pendingCount: null,
    loading: landlord,
    error: false,
  })
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => {
    setState({ pendingCount: null, loading: true, error: false })
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!landlord) return
    const controller = new AbortController()
    void getPendingApplicants(controller.signal).then(
      (applicants) => {
        if (!controller.signal.aborted) {
          setState({
            pendingCount: applicants.length,
            loading: false,
            error: false,
          })
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          logout()
        } else {
          setState((previous) => ({ ...previous, loading: false, error: true }))
        }
      }
    )
    return () => controller.abort()
  }, [landlord, revision, logout])

  return <LikesContext value={{ ...state, refresh }}>{children}</LikesContext>
}

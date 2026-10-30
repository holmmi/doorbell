import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router'
import { ApiError, getToken, subscribeToToken } from '../api/client'
import * as userClient from '../api/userClient'
import { AuthContext, type AuthStatus } from '../hooks/useAuth'
import type { LoginInput, RegistrationInput, UserInfo } from '../types/user'

type AuthState = {
  token: string | null
  user: UserInfo | null
  status: AuthStatus
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const token = useSyncExternalStore(subscribeToToken, getToken)
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<AuthState>(() => ({
    token,
    user: null,
    status: token ? 'loading' : 'anonymous',
  }))
  // Never expose a previous account while the next current-user request is pending.
  const user = state.token === token ? state.user : null
  const status =
    state.token === token ? state.status : token ? 'loading' : 'anonymous'

  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  const logout = useCallback(() => {
    userClient.logout()
    setState({ token: null, user: null, status: 'anonymous' })
  }, [])

  const expire = useCallback(() => {
    logout()
    void navigateRef.current('/login', { replace: true })
  }, [logout])

  useEffect(() => {
    if (!token) return
    let active = true
    void userClient.getCurrentUser().then(
      (currentUser) => {
        if (active && getToken() === token) {
          setState({ token, user: currentUser, status: 'authenticated' })
        }
      },
      (error: unknown) => {
        if (!active || getToken() !== token) return
        if (error instanceof ApiError && error.status === 401) {
          expire()
        } else {
          setState({ token, user: null, status: 'error' })
        }
      }
    )
    return () => {
      active = false
    }
  }, [token, revision, expire])

  // Token notifications resolve the current account for both login and other tabs.
  const login = useCallback((input: LoginInput) => userClient.login(input), [])
  const register = useCallback(
    async (input: RegistrationInput) => {
      await userClient.register(input)
      return login({ email: input.email, password: input.password })
    },
    [login]
  )
  const retry = useCallback(() => {
    setState({ token: getToken(), user: null, status: 'loading' })
    setRevision((value) => value + 1)
  }, [])

  const value = useMemo(
    () => ({ token, user, status, login, register, logout, expire, retry }),
    [token, user, status, login, register, logout, expire, retry]
  )
  return <AuthContext value={value}>{children}</AuthContext>
}

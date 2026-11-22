import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, getToken } from '../api/client'
import * as userClient from '../api/userClient'
import { AuthContext, type AuthStatus } from '../hooks/useAuth'
import type {
  LoginInput,
  ProfileUpdate,
  RegistrationInput,
  UserInfo,
} from '../types/user'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() ? 'loading' : 'anonymous'
  )

  useEffect(() => {
    const token = getToken()
    if (!token) return
    let active = true

    userClient
      .getCurrentUser()
      .then((currentUser) => {
        if (!active || getToken() !== token) return
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (!active || getToken() !== token) return
        // Keep the token on network errors so a reload can recover.
        if (error instanceof ApiError && error.status === 401) {
          userClient.logout()
        }
        setStatus('anonymous')
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const currentUser = await userClient.login(input)
    setUser(currentUser)
    setStatus('authenticated')
    return currentUser
  }, [])

  const register = useCallback(
    async (input: RegistrationInput) => {
      await userClient.register(input)
      return login({ email: input.email, password: input.password })
    },
    [login]
  )

  const logout = useCallback(() => {
    userClient.logout()
    setUser(null)
    setStatus('anonymous')
  }, [])

  // Runs an account request for the session that is signed in when it starts.
  // If the session changes before it finishes (sign out, or sign in as someone
  // else), the result is dropped: it neither replaces the current user nor signs
  // them out. A 401 for the current session signs out; ProtectedRoute then
  // shows the login view.
  const forCurrentSession = useCallback(
    async (request: () => Promise<UserInfo>) => {
      const token = getToken()
      const sessionChanged = () =>
        new ApiError(0, 'error.authentication.sessionChanged')
      try {
        const result = await request()
        if (getToken() !== token) throw sessionChanged()
        setUser(result)
        return result
      } catch (error) {
        if (getToken() !== token) throw sessionChanged()
        if (error instanceof ApiError && error.status === 401) logout()
        throw error
      }
    },
    [logout]
  )

  const refreshUser = useCallback(
    () => forCurrentSession(userClient.getCurrentUser),
    [forCurrentSession]
  )

  const updateProfile = useCallback(
    (update: ProfileUpdate) =>
      forCurrentSession(() => userClient.updateCurrentUser(update)),
    [forCurrentSession]
  )

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
    }),
    [user, status, login, register, logout, refreshUser, updateProfile]
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

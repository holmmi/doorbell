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

  // An expired session signs the user out; ProtectedRoute then shows login.
  const signOutOnUnauthorized = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) logout()
      throw error
    },
    [logout]
  )

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await userClient.getCurrentUser()
      setUser(currentUser)
      return currentUser
    } catch (error) {
      return signOutOnUnauthorized(error)
    }
  }, [signOutOnUnauthorized])

  const updateProfile = useCallback(
    async (update: ProfileUpdate) => {
      try {
        const updatedUser = await userClient.updateCurrentUser(update)
        setUser(updatedUser)
        return updatedUser
      } catch (error) {
        return signOutOnUnauthorized(error)
      }
    },
    [signOutOnUnauthorized]
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

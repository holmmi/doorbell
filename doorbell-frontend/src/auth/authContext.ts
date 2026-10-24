import { createContext } from 'react'
import type { LoginInput, RegistrationInput, UserInfo } from '../types/user'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  user: UserInfo | null
  status: AuthStatus
  login: (input: LoginInput) => Promise<UserInfo>
  register: (input: RegistrationInput) => Promise<UserInfo>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

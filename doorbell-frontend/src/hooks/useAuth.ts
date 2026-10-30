import { createContext, use } from 'react'
import type { LoginInput, RegistrationInput, UserInfo } from '../types/user'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export type AuthContextValue = {
  // Includes the account role (LANDLORD or TENANT) from /api/user/info.
  token: string | null
  user: UserInfo | null
  status: AuthStatus
  login: (input: LoginInput) => Promise<UserInfo>
  register: (input: RegistrationInput) => Promise<UserInfo>
  logout: () => void
  expire: () => void
  retry: () => void
}

// Provided by AuthProvider. Kept here because component files may only
// export components (react-refresh/only-export-components).
export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}

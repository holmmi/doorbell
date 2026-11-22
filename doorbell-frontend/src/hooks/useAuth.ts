import { createContext, use } from 'react'
import type {
  LoginInput,
  ProfileUpdate,
  RegistrationInput,
  UserInfo,
} from '../types/user'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  // Includes the account role (LANDLORD or TENANT) from /api/user/info.
  user: UserInfo | null
  status: AuthStatus
  login: (input: LoginInput) => Promise<UserInfo>
  register: (input: RegistrationInput) => Promise<UserInfo>
  logout: () => void
  // Reloads the signed-in user from GET /api/user/info.
  refreshUser: () => Promise<UserInfo>
  // Saves profile changes and stores the returned user.
  updateProfile: (update: ProfileUpdate) => Promise<UserInfo>
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

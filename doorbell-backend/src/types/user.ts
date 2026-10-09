export const userRoles = ['LANDLORD', 'TENANT'] as const

export type UserRole = (typeof userRoles)[number]

export interface LoginInput {
  email: string
  password: string
}

export interface UserCredentials {
  id: string
  passwordHash: string
}

export interface AuthenticatedUser {
  userId: string
}

export interface RegistrationInput {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  password: string
}

export interface CreatedUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
}

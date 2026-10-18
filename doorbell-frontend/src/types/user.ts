export const userRoles = ['LANDLORD', 'TENANT'] as const

export type UserRole = (typeof userRoles)[number]

export interface LoginInput {
  email: string
  password: string
}

export interface RegistrationInput extends LoginInput {
  firstName: string
  lastName: string
  role: UserRole
}

export interface LoginResponse {
  token: string
}

export interface UserInfo {
  id: string
  role: UserRole
  firstName: string
  lastName: string
  email: string
  phone: string | null
  picturePath: string | null
}

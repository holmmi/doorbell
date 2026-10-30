import type {
  LoginInput,
  LoginResponse,
  RegistrationInput,
  UserInfo,
} from '../types/user'
import {
  ApiError,
  authenticatedClient,
  clearToken,
  getToken,
  setToken,
  unauthenticatedClient,
} from './client'

export const register = async (input: RegistrationInput): Promise<void> => {
  await unauthenticatedClient.request<void>('/user/register', {
    method: 'POST',
    body: input,
  })
}

export const getCurrentUser = (): Promise<UserInfo> =>
  authenticatedClient.request<UserInfo>('/user/info')

export const login = async (input: LoginInput): Promise<UserInfo> => {
  const { token } = await unauthenticatedClient.request<LoginResponse>(
    '/user/login',
    { method: 'POST', body: input }
  )
  setToken(token)

  try {
    const user = await getCurrentUser()
    if (getToken() !== token) {
      throw new ApiError(401, 'error.authentication.unauthorized')
    }
    return user
  } catch (error) {
    if (getToken() === token) clearToken()
    throw error
  }
}

export const logout = clearToken

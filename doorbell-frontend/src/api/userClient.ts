import type {
  LoginInput,
  LoginResponse,
  ProfileUpdate,
  RegistrationInput,
  UserInfo,
} from '../types/user'
import {
  authenticatedClient,
  clearToken,
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
    return await getCurrentUser()
  } catch (error) {
    clearToken()
    throw error
  }
}

export const updateCurrentUser = (update: ProfileUpdate): Promise<UserInfo> =>
  authenticatedClient.request<UserInfo>('/user/info', {
    method: 'PATCH',
    body: update,
  })

export const logout = clearToken

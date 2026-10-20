import type {
  LoginInput,
  LoginResponse,
  RegistrationInput,
  UserInfo,
} from '../types/user'
import {
  authenticatedClient,
  clearToken,
  setToken,
  unauthenticatedClient,
} from './client'

async function register(input: RegistrationInput): Promise<void> {
  await unauthenticatedClient.request<void>('/user/register', {
    method: 'POST',
    body: input,
  })
}

async function getCurrentUser(): Promise<UserInfo> {
  return authenticatedClient.request<UserInfo>('/user/info')
}

async function login(input: LoginInput): Promise<UserInfo> {
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

export const userClient = {
  register,
  login,
  getCurrentUser,
  logout: clearToken,
}

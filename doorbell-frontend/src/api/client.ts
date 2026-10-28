const API_PREFIX = '/api'
const TOKEN_KEY = 'doorbell.accessToken'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) =>
  localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: unknown }

const getErrorCode = (body: unknown): string => {
  if (typeof body !== 'object' || body === null) return 'error.unknown'

  if ('error' in body && typeof body.error === 'string') return body.error
  if ('errors' in body && Array.isArray(body.errors)) {
    return 'error.validation.server'
  }

  return 'error.unknown'
}

export class RestJsonClient {
  private readonly authenticated: boolean

  constructor(authenticated = false) {
    this.authenticated = authenticated
  }

  async request<T>(path: string, init: JsonRequestInit = {}): Promise<T> {
    const { body, ...requestInit } = init
    const headers = new Headers(requestInit.headers)

    if (body !== undefined) headers.set('Content-Type', 'application/json')

    if (this.authenticated) {
      const token = getToken()
      if (!token) {
        throw new ApiError(401, 'error.authentication.unauthorized')
      }
      headers.set('Authorization', `Bearer ${token}`)
    }

    let response: Response
    try {
      response = await fetch(`${API_PREFIX}${path}`, {
        ...requestInit,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, 'error.network')
    }

    const isJson = response.headers
      .get('Content-Type')
      ?.includes('application/json')
    let responseBody: unknown

    if (isJson) {
      try {
        responseBody = await response.json()
      } catch {
        if (response.ok) throw new ApiError(response.status, 'error.unknown')
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, getErrorCode(responseBody))
    }

    return responseBody as T
  }
}

export const unauthenticatedClient = new RestJsonClient()
export const authenticatedClient = new RestJsonClient(true)

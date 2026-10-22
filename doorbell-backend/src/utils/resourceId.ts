import { RequestError } from './requestError.js'

// Keep BIGINT IDs as decimal strings throughout the request and database layers.
export const resourceId = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    throw new RequestError(400, 'error.request.invalid')
  }
  return value
}

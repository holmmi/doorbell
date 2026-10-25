import type { Request } from 'express'

import { RequestError } from './requestError.js'

export const resourceIdFromRequest = (
  request: Request,
  parameter: string
): string => {
  const id = Number(request.params[parameter])
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new RequestError(400, 'error.request.invalid')
  }
  return id.toString()
}

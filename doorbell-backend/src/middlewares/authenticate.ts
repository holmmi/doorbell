import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'

import { verifyAccessToken } from '../utils/jwt.js'

export const authenticate: RequestHandler = (request, response, next) => {
  const authorization = request.get('Authorization')
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1]

  if (!token) {
    response.status(401).json({ error: 'error.authentication.unauthorized' })
    return
  }

  try {
    request.auth = verifyAccessToken(token)
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      response.status(401).json({ error: 'error.authentication.unauthorized' })
      return
    }

    next(error)
    return
  }

  next()
}

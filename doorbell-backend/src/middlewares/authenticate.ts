import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'

import { verifyAccessToken } from '../utils/jwt.js'

export const authenticate: RequestHandler = (request, response, next) => {
  const authorization = request.get('Authorization')
  const token = authorization?.toLowerCase().startsWith('bearer ')
    ? authorization.substring(7)
    : undefined

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

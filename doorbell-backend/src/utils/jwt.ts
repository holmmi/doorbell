import jwt from 'jsonwebtoken'

import { jwtSecret } from '../config/auth.js'
import type { AuthenticatedUser } from '../types/user.js'

export const createAccessToken = (userId: string): string => {
  return jwt.sign({}, jwtSecret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: '6h',
  })
}

export const verifyAccessToken = (token: string): AuthenticatedUser => {
  const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
  // verify checks expiration when present; access tokens must include it.
  if (
    typeof payload === 'string' ||
    typeof payload.exp !== 'number' ||
    !Number.isInteger(payload.exp) ||
    typeof payload.sub !== 'string' ||
    !/^[1-9]\d*$/.test(payload.sub)
  ) {
    throw new jwt.JsonWebTokenError('Invalid access token payload')
  }

  return { userId: payload.sub }
}

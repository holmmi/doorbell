import jwt from 'jsonwebtoken'
import { z } from 'zod'

import { jwtSecret } from '../config/auth.js'
import type { AuthenticatedUser } from '../types/user.js'

const accessTokenPayloadSchema = z.object({
  sub: z.string().regex(/^[1-9]\d*$/),
  exp: z.number().int().positive(),
})

export const createAccessToken = (userId: string): string => {
  return jwt.sign({}, jwtSecret, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: 60 * 60,
  })
}

export const verifyAccessToken = (token: string): AuthenticatedUser => {
  const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
  const result = accessTokenPayloadSchema.safeParse(payload)

  if (!result.success) {
    throw new jwt.JsonWebTokenError('Invalid access token payload')
  }

  return { userId: result.data.sub }
}

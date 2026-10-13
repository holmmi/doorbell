import type { RequestHandler } from 'express'

import { findUserRoleById } from '../repositories/userRepository.js'
import type { UserRole } from '../types/user.js'

export const requireRole = (role: UserRole): RequestHandler => {
  return async (request, response, next) => {
    const userId = request.auth?.userId

    if (!userId) {
      response.status(401).json({ error: 'error.authentication.unauthorized' })
      return
    }

    try {
      const currentRole = await findUserRoleById(userId)

      if (currentRole !== role) {
        response.status(403).json({ error: 'error.authorization.forbidden' })
        return
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

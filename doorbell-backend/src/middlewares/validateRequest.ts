import type { RequestHandler } from 'express'
import type { z } from 'zod'

export const validateRequestBody = <T extends z.ZodType>(
  schema: T
): RequestHandler => {
  return (request, response, next) => {
    const result = schema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({ errors: result.error.issues })
      return
    }

    request.body = result.data
    next()
  }
}

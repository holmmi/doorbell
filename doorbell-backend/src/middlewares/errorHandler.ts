import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next
) => {
  console.error('Unhandled request error', {
    error: error instanceof Error ? error.message : String(error),
    method: request.method,
    path: request.path,
  })

  if (response.headersSent) {
    next(error)
    return
  }

  response.status(500).json({ error: 'Internal server error' })
}

import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next
) => {
  if (response.headersSent) {
    next(error)
    return
  }

  if (
    error instanceof SyntaxError &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    response.status(400).json({ error: 'error.request.invalid' })
    return
  }

  console.error('Unhandled request error', {
    error: error instanceof Error ? error.message : String(error),
    method: request.method,
    path: request.path,
  })

  response.status(500).json({ error: 'error.server.unexpected' })
}

import type { AuthenticatedUser } from './user.js'

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthenticatedUser
  }
}

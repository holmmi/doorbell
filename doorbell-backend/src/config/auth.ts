const secret = process.env.JWT_SECRET

if (!secret?.trim()) {
  throw new Error('Missing required environment variable: JWT_SECRET')
}

export const jwtSecret = secret

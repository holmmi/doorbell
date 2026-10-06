import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config()

const requiredEnvironmentVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
] as const

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]
)

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Missing required database environment variables: ${missingEnvironmentVariables.join(', ')}`
  )
}

const dbPort = Number(process.env.DB_PORT)

if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
  throw new Error('DB_PORT must be a valid TCP port number')
}

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: dbPort,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

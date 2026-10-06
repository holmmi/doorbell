import { pool } from '../config/database.js'
import type { CreatedUser, RegistrationInput } from '../types/user.js'

const createUserQuery = `
  INSERT INTO "user" (first_name, last_name, email, password, role)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING
    id,
    first_name AS "firstName",
    last_name AS "lastName",
    email,
    role
`

export const createUser = async (
  input: RegistrationInput,
  passwordHash: string
): Promise<CreatedUser> => {
  const result = await pool.query<CreatedUser>(createUserQuery, [
    input.firstName,
    input.lastName,
    input.email,
    passwordHash,
    input.role,
  ])

  return result.rows[0]
}

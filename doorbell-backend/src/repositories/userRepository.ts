import { pool } from '../config/database.js'
import type {
  CreatedUser,
  RegistrationInput,
  UserCredentials,
  UserInfo,
} from '../types/user.js'

const findUserInfoByIdQuery = `
  SELECT
    id,
    role,
    first_name AS "firstName",
    last_name AS "lastName",
    email,
    phone,
    picture_path AS "picturePath"
  FROM "user"
  WHERE id = $1
`

const findUserCredentialsByEmailQuery = `
  SELECT id, password AS "passwordHash"
  FROM "user"
  WHERE email = $1
`

const userExistsByEmailQuery = `
  SELECT EXISTS(
    SELECT 1
    FROM "user"
    WHERE email = $1
  ) AS "exists"
`

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

export const findUserInfoById = async (
  userId: string
): Promise<UserInfo | undefined> => {
  const result = await pool.query<UserInfo>(findUserInfoByIdQuery, [userId])

  return result.rows[0]
}

export const findUserCredentialsByEmail = async (
  email: string
): Promise<UserCredentials | undefined> => {
  const result = await pool.query<UserCredentials>(
    findUserCredentialsByEmailQuery,
    [email]
  )

  return result.rows[0]
}

export const userExistsByEmail = async (email: string): Promise<boolean> => {
  const result = await pool.query<{ exists: boolean }>(userExistsByEmailQuery, [
    email,
  ])

  return result.rows[0].exists
}

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

import type { PoolClient } from 'pg'

import { pool } from '../config/database.js'
import type {
  CreatedUser,
  RegistrationInput,
  UpdateUserInfoInput,
  UserCredentials,
  UserInfo,
} from '../types/user.js'
import type { UserRole } from '../types/user.js'
import { RequestError } from '../utils/requestError.js'

const findUserInfoByIdQuery = `
  SELECT
    id,
    role,
    first_name AS "firstName",
    last_name AS "lastName",
    email,
    phone,
    picture_key AS "pictureKey"
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

const findUserRoleByIdQuery = `
  SELECT role
  FROM "user"
  WHERE id = $1
`

export const findUserInfoById = async (
  userId: string
): Promise<UserInfo | undefined> => {
  const result = await pool.query<UserInfo>(findUserInfoByIdQuery, [userId])

  return result.rows[0]
}

export const updateUserInfoById = async (
  userId: string,
  input: UpdateUserInfoInput,
  client: Pick<PoolClient, 'query'> = pool
): Promise<UserInfo | undefined> => {
  const columns = {
    firstName: 'first_name',
    lastName: 'last_name',
    phone: 'phone',
    pictureKey: 'picture_key',
  } as const
  const values: (string | null)[] = [userId]
  const assignments: string[] = []

  for (const field of Object.keys(columns) as (keyof typeof columns)[]) {
    if (input[field] !== undefined) {
      values.push(input[field])
      assignments.push(`${columns[field]} = $${values.length}`)
    }
  }

  const result = await client.query<UserInfo>(
    `UPDATE "user"
     SET ${assignments.join(', ')}
     WHERE id = $1
     RETURNING id, role, first_name AS "firstName", last_name AS "lastName",
       email, phone, picture_key AS "pictureKey"`,
    values
  )

  return result.rows[0]
}

export const withUserLock = async <T>(
  userId: string,
  operation: (client: PoolClient, user: UserInfo) => Promise<T>
): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<UserInfo>(
      `${findUserInfoByIdQuery} FOR UPDATE`,
      [userId]
    )
    const user = result.rows[0]
    if (!user) {
      throw new RequestError(401, 'error.authentication.unauthorized')
    }
    const value = await operation(client, user)
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const registerUserPictureUpload = async (
  client: PoolClient,
  userId: string,
  objectKey: string,
  contentType: string
): Promise<void> => {
  await client.query(
    `INSERT INTO user_picture_upload (user_id, object_key, content_type)
     VALUES ($1, $2, $3)`,
    [userId, objectKey, contentType]
  )
}

export const consumeUserPictureUpload = async (
  client: PoolClient,
  userId: string,
  objectKey: string
): Promise<string> => {
  const result = await client.query<{ contentType: string }>(
    `DELETE FROM user_picture_upload
     WHERE user_id = $1 AND object_key = $2 AND expires_at > clock_timestamp()
     RETURNING content_type AS "contentType"`,
    [userId, objectKey]
  )
  if (!result.rows[0]) {
    throw new RequestError(400, 'error.user.picture.invalidKey')
  }
  return result.rows[0].contentType
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

export const findUserRoleById = async (
  userId: string,
  client: Pick<PoolClient, 'query'> = pool
): Promise<UserRole | undefined> => {
  const result = await client.query<{ role: UserRole }>(findUserRoleByIdQuery, [
    userId,
  ])

  return result.rows[0]?.role
}

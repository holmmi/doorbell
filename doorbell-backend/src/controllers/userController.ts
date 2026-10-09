import bcrypt from 'bcrypt'
import type { RequestHandler } from 'express'

import {
  createUser,
  findUserCredentialsByEmail,
  userExistsByEmail,
} from '../repositories/userRepository.js'
import type { LoginInput, RegistrationInput } from '../types/user.js'
import { createAccessToken } from '../utils/jwt.js'

// Match registration's bcrypt cost even when no account exists.
const dummyPasswordHash =
  '$2b$12$8HF3hP4AK5BeCkTcc2rzYOvwKU6fIAscmNJLgXJgqnqsoIUy5EsD2'

export const loginUser: RequestHandler = async (request, response) => {
  const input = request.body as LoginInput
  const user = await findUserCredentialsByEmail(input.email)
  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? dummyPasswordHash
  )

  if (!user || !passwordMatches) {
    response.status(401).json({ error: 'error.login.invalidCredentials' })
    return
  }

  response.json({ token: createAccessToken(user.id) })
}

export const registerUser: RequestHandler = async (request, response) => {
  const input = request.body as RegistrationInput

  if (await userExistsByEmail(input.email)) {
    response.status(409).json({ error: 'error.registration.userAlreadyExists' })
    return
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  await createUser(input, passwordHash)

  response.sendStatus(201)
}

import bcrypt from 'bcrypt'
import type { RequestHandler } from 'express'

import {
  createUser,
  findUserCredentialsByEmail,
  findUserInfoById,
  updateUserInfoById,
  userExistsByEmail,
} from '../repositories/userRepository.js'
import type {
  LoginInput,
  RegistrationInput,
  UpdateUserInfoInput,
  UserInfo,
} from '../types/user.js'
import { createAccessToken } from '../utils/jwt.js'

const toUserInfoResponse = (user: UserInfo): UserInfo => ({
  id: user.id,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  picturePath: user.picturePath,
})

export const getUserInfo: RequestHandler = async (request, response) => {
  const userId = request.auth?.userId

  if (!userId) {
    response.status(401).json({ error: 'error.authentication.unauthorized' })
    return
  }

  const user = await findUserInfoById(userId)

  if (!user) {
    response.status(401).json({ error: 'error.authentication.unauthorized' })
    return
  }

  response.json(toUserInfoResponse(user))
}

export const updateUserInfo: RequestHandler = async (request, response) => {
  const userId = request.auth?.userId

  if (!userId) {
    response.status(401).json({ error: 'error.authentication.unauthorized' })
    return
  }

  const user = await updateUserInfoById(
    userId,
    request.body as UpdateUserInfoInput
  )

  if (!user) {
    response.status(401).json({ error: 'error.authentication.unauthorized' })
    return
  }

  response.json(toUserInfoResponse(user))
}

export const loginUser: RequestHandler = async (request, response) => {
  const input = request.body as LoginInput
  const user = await findUserCredentialsByEmail(input.email)

  if (!user) {
    response.status(401).json({ error: 'error.login.invalidCredentials' })
    return
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash
  )

  if (!passwordMatches) {
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

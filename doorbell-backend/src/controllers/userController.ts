import bcrypt from 'bcrypt'
import type { RequestHandler } from 'express'

import { createUser } from '../repositories/userRepository.js'
import type { RegistrationInput } from '../types/user.js'

export const registerUser: RequestHandler = async (request, response) => {
  const input = request.body as RegistrationInput
  const passwordHash = await bcrypt.hash(input.password, 12)

  await createUser(input, passwordHash)

  response.sendStatus(201)
}

import { Router } from 'express'

import { registerUser } from '../controllers/userController.js'
import { validateRequestBody } from '../middlewares/validateRequest.js'
import { registrationSchema } from '../schemas/user.js'

const userRouter = Router()

userRouter.post(
  '/register',
  validateRequestBody(registrationSchema),
  registerUser
)

export default userRouter

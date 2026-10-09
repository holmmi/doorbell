import { Router } from 'express'

import { loginUser, registerUser } from '../controllers/userController.js'
import { validateRequestBody } from '../middlewares/validateRequest.js'
import { loginSchema, registrationSchema } from '../schemas/user.js'

const userRouter = Router()

userRouter.post('/login', validateRequestBody(loginSchema), loginUser)

userRouter.post(
  '/register',
  validateRequestBody(registrationSchema),
  registerUser
)

export default userRouter

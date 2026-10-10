import { Router } from 'express'

import {
  getUserInfo,
  loginUser,
  registerUser,
} from '../controllers/userController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { validateRequestBody } from '../middlewares/validateRequest.js'
import { loginSchema, registrationSchema } from '../schemas/user.js'

const userRouter = Router()

userRouter.get('/info', authenticate, getUserInfo)

userRouter.post('/login', validateRequestBody(loginSchema), loginUser)

userRouter.post(
  '/register',
  validateRequestBody(registrationSchema),
  registerUser
)

export default userRouter

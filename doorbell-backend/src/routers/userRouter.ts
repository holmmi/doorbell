import { Router } from 'express'

import {
  getUserInfo,
  loginUser,
  registerUser,
  updateUserInfo,
} from '../controllers/userController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { validateRequestBody } from '../middlewares/validateRequest.js'
import {
  loginSchema,
  registrationSchema,
  updateUserInfoSchema,
} from '../schemas/user.js'

const userRouter = Router()

userRouter.get('/info', authenticate, getUserInfo)

userRouter.patch(
  '/info',
  authenticate,
  validateRequestBody(updateUserInfoSchema),
  updateUserInfo
)

userRouter.post('/login', validateRequestBody(loginSchema), loginUser)

userRouter.post(
  '/register',
  validateRequestBody(registrationSchema),
  registerUser
)

export default userRouter

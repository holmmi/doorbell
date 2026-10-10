import 'dotenv/config'
import express from 'express'

import { errorHandler } from './middlewares/errorHandler.js'
import userRouter from './routers/userRouter.js'

const app = express()
app.use(express.json())
app.use('/api/user', userRouter)
app.use(errorHandler)

export default app

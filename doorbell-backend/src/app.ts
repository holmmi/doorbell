import 'dotenv/config'
import express from 'express'

import { errorHandler } from './middlewares/errorHandler.js'
import userRouter from './routers/userRouter.js'
import listingRouter from './routers/listingRouter.js'

const app = express()
app.use(express.json())

app.use('/api/user', userRouter)
app.use('/api/listing', listingRouter)

app.use(errorHandler)

export default app

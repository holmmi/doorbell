import 'dotenv/config'
import express from 'express'

import { errorHandler } from './middlewares/errorHandler.js'
import userRouter from './routers/userRouter.js'
import listingRouter from './routers/listingRouter.js'
import listingInteractionRouter from './routers/listingInteractionRouter.js'

const app = express()
app.use(express.json())

app.use('/api/user', userRouter)
app.use('/api/listing', listingRouter)
app.use('/api/listing-interaction', listingInteractionRouter)

app.use(errorHandler)

export default app

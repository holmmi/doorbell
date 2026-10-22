import { Router } from 'express'

import { getMatches } from '../controllers/listingInteractionController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'

const matchRouter = Router()
matchRouter.get('/', authenticate, requireRole('TENANT'), getMatches)

export default matchRouter

import { Router } from 'express'

import {
  createRentalListing,
  presignListingImage,
  publishRentalListing,
  uploadListingImage,
} from '../controllers/listingController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validateRequestBody } from '../middlewares/validateRequest.js'
import {
  listingSchema,
  presignImageSchema,
  uploadImageSchema,
} from '../schemas/listing.js'

const listingRouter = Router()
const landlordOnly = [authenticate, requireRole('LANDLORD')]

listingRouter.post(
  '/',
  landlordOnly,
  validateRequestBody(listingSchema),
  createRentalListing
)
listingRouter.post(
  '/:listingId/images/presign',
  landlordOnly,
  validateRequestBody(presignImageSchema),
  presignListingImage
)
listingRouter.post(
  '/:listingId/images',
  landlordOnly,
  validateRequestBody(uploadImageSchema),
  uploadListingImage
)
listingRouter.post('/:listingId/publish', landlordOnly, publishRentalListing)

export default listingRouter

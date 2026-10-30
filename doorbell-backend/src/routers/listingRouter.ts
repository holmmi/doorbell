import { Router } from 'express'

import {
  createRentalListing,
  getRentalListingFeed,
  getRentalListing,
  presignListingImage,
  publishRentalListing,
  uploadListingImage,
  updateRentalListing,
} from '../controllers/listingController.js'
import {
  authenticate,
  optionalAuthenticate,
} from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validateRequestBody } from '../middlewares/validateRequest.js'
import {
  listingSchema,
  presignImageSchema,
  uploadImageSchema,
  updateListingSchema,
} from '../schemas/listing.js'

const listingRouter = Router()
const landlordOnly = [authenticate, requireRole('LANDLORD')]

listingRouter.get('/', optionalAuthenticate, getRentalListingFeed)
listingRouter.post(
  '/',
  landlordOnly,
  validateRequestBody(listingSchema),
  createRentalListing
)
listingRouter.get('/:listingId', optionalAuthenticate, getRentalListing)
listingRouter.put(
  '/:listingId',
  landlordOnly,
  validateRequestBody(updateListingSchema),
  updateRentalListing
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

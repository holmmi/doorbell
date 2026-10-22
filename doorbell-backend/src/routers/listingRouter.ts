import { Router } from 'express'

import {
  getListingApplicants,
  putApplicantDecision,
  putListingPreference,
} from '../controllers/listingInteractionController.js'
import {
  decisionSchema,
  preferenceSchema,
} from '../schemas/listingInteraction.js'
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

listingRouter.put(
  '/:listingId/preference',
  authenticate,
  requireRole('TENANT'),
  validateRequestBody(preferenceSchema),
  putListingPreference
)
listingRouter.get('/:listingId/applicants', landlordOnly, getListingApplicants)
listingRouter.put(
  '/:listingId/applicants/:tenantId/decision',
  landlordOnly,
  validateRequestBody(decisionSchema),
  putApplicantDecision
)

listingRouter.get('/', optionalAuthenticate, getRentalListingFeed)
listingRouter.post(
  '/',
  landlordOnly,
  validateRequestBody(listingSchema),
  createRentalListing
)
listingRouter.get('/:listingId', landlordOnly, getRentalListing)
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

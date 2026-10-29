import { Router } from 'express'

import {
  createApplicantDecision,
  createListingPreference,
  getListingApplicants,
  getApplicantsForLandlord,
  getMatchesForLandlord,
  getMatchesForTenant,
} from '../controllers/listingInteractionController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validateRequestBody } from '../middlewares/validateRequest.js'
import {
  decisionSchema,
  preferenceSchema,
} from '../schemas/listingInteraction.js'

const listingInteractionRouter = Router()
const landlordOnly = [authenticate, requireRole('LANDLORD')]
const tenantOnly = [authenticate, requireRole('TENANT')]

listingInteractionRouter.get('/tenant-matches', tenantOnly, getMatchesForTenant)
listingInteractionRouter.get(
  '/applicants',
  landlordOnly,
  getApplicantsForLandlord
)
listingInteractionRouter.get(
  '/landlord-matches',
  landlordOnly,
  getMatchesForLandlord
)
listingInteractionRouter.post(
  '/:listingId/preference',
  tenantOnly,
  validateRequestBody(preferenceSchema),
  createListingPreference
)
listingInteractionRouter.get(
  '/:listingId/applicants',
  landlordOnly,
  getListingApplicants
)
listingInteractionRouter.post(
  '/:listingId/applicants/:tenantId/decision',
  landlordOnly,
  validateRequestBody(decisionSchema),
  createApplicantDecision
)

export default listingInteractionRouter

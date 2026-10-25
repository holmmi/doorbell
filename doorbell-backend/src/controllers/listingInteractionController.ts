import type { RequestHandler } from 'express'

import {
  decideApplicant,
  getApplicants,
  getTenantMatches,
  recordPreference,
} from '../services/listingInteractionService.js'
import type {
  DecisionInput,
  PreferenceInput,
} from '../types/listingInteraction.js'
import { resourceIdFromRequest } from '../utils/resourceId.js'

export const createListingPreference: RequestHandler = async (
  request,
  response
) => {
  const { liked } = request.body as PreferenceInput
  response.json(
    await recordPreference(
      resourceIdFromRequest(request, 'listingId'),
      request.auth?.userId as string,
      liked
    )
  )
}

export const getListingApplicants: RequestHandler = async (
  request,
  response
) => {
  const result = await getApplicants(
    resourceIdFromRequest(request, 'listingId'),
    request.auth?.userId as string
  )
  response.json(
    result.map((applicant) => ({
      tenantId: applicant.tenantId,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
    }))
  )
}

export const createApplicantDecision: RequestHandler = async (
  request,
  response
) => {
  const { decision } = request.body as DecisionInput
  response.json(
    await decideApplicant(
      resourceIdFromRequest(request, 'listingId'),
      resourceIdFromRequest(request, 'tenantId'),
      request.auth?.userId as string,
      decision
    )
  )
}

export const getMatches: RequestHandler = async (request, response) => {
  response.json(await getTenantMatches(request.auth?.userId as string))
}

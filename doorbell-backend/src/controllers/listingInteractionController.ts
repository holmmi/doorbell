import type { RequestHandler } from 'express'

import { findTenantMatches } from '../repositories/listingInteractionRepository.js'
import {
  decideApplicant,
  getApplicants,
  recordPreference,
} from '../services/listingInteractionService.js'
import { listingFeedResponse } from '../services/listingResponse.js'
import type {
  DecisionInput,
  MatchResponse,
  PreferenceInput,
} from '../types/listingInteraction.js'
import { resourceId } from '../utils/resourceId.js'

export const putListingPreference: RequestHandler = async (
  request,
  response
) => {
  const { liked } = request.body as PreferenceInput
  response.json(
    await recordPreference(
      resourceId(request.params.listingId),
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
    resourceId(request.params.listingId),
    request.auth?.userId as string
  )
  response.json({
    applicants: result.applicants.map((applicant) => ({
      tenantId: applicant.tenantId,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      picturePath: applicant.picturePath,
    })),
    count: result.count,
  })
}

export const putApplicantDecision: RequestHandler = async (
  request,
  response
) => {
  const { decision } = request.body as DecisionInput
  response.json(
    await decideApplicant(
      resourceId(request.params.listingId),
      resourceId(request.params.tenantId),
      request.auth?.userId as string,
      decision
    )
  )
}

export const getMatches: RequestHandler = async (request, response) => {
  const matches = await findTenantMatches(request.auth?.userId as string)
  const result: MatchResponse[] = await Promise.all(
    matches.map(async (match) => ({
      listingId: match.listingId,
      createdAt: match.createdAt.toISOString(),
      listing: await listingFeedResponse(match.listing),
      landlord: {
        firstName: match.landlord.firstName,
        lastName: match.landlord.lastName,
        email: match.landlord.email,
        phone: match.landlord.phone,
      },
    }))
  )
  response.json(result)
}

import { z } from 'zod'

import { applicantDecisions } from '../types/listingInteraction.js'

export const preferenceSchema = z.object({ liked: z.boolean() })
export const decisionSchema = z.object({ decision: z.enum(applicantDecisions) })

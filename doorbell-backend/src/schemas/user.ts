import { z } from 'zod'

import { userRoles } from '../types/user.js'

export const registrationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  role: z.enum(userRoles),
  password: z.string().min(8),
})

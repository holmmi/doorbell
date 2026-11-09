import { z } from 'zod'

import { userRoles } from '../types/user.js'

export const updateUserInfoSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().min(1).nullable().optional(),
    picturePath: z.string().min(1).nullable().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined))

export const loginSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(1)
    .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
      error: 'Password must be at most 72 UTF-8 bytes',
    }),
})

export const registrationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  role: z.enum(userRoles),
  password: z
    .string()
    .min(8)
    .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, {
      error: 'Password must be at most 72 UTF-8 bytes',
    }),
})

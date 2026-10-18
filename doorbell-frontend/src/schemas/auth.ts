import { z } from 'zod'
import { userRoles } from '../types/user'

const emailSchema = z.email({ error: 'auth.validation.email' })

const passwordByteLimit = (password: string) =>
  new TextEncoder().encode(password).length <= 72

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'auth.validation.required')
    .refine(passwordByteLimit, 'auth.validation.passwordMax'),
})

export const registrationSchema = z.object({
  firstName: z.string().trim().min(1, 'auth.validation.required'),
  lastName: z.string().trim().min(1, 'auth.validation.required'),
  email: emailSchema,
  role: z.enum(userRoles),
  password: z
    .string()
    .min(8, 'auth.validation.passwordMin')
    .refine(passwordByteLimit, 'auth.validation.passwordMax'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegistrationFormValues = z.infer<typeof registrationSchema>

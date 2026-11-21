import { z } from 'zod'
import type { ProfileUpdate, UserInfo } from '../types/user'

export const profileFormSchema = z.object({
  firstName: z.string().trim().min(1, 'auth.validation.required'),
  lastName: z.string().trim().min(1, 'auth.validation.required'),
  // Any format is accepted; an empty field means no phone number.
  phone: z.string().trim(),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

export const profileToFormValues = (user: UserInfo): ProfileFormValues => ({
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone ?? '',
})

// The PATCH body for the fields that differ from the saved user. Unchanged
// fields are left out, so an untouched form produces an empty object.
export const profileChanges = (
  saved: UserInfo,
  draft: ProfileFormValues,
  removePicture: boolean
): ProfileUpdate => {
  const changes: ProfileUpdate = {}
  const firstName = draft.firstName.trim()
  const lastName = draft.lastName.trim()
  const phone = draft.phone.trim() || null

  if (firstName !== saved.firstName) changes.firstName = firstName
  if (lastName !== saved.lastName) changes.lastName = lastName
  if (phone !== saved.phone) changes.phone = phone
  if (removePicture && saved.picturePath !== null) changes.picturePath = null
  return changes
}

// picturePath is a stored reference. Only web addresses can be shown; other
// references fall back to initials until picture storage exists.
export const displayablePicture = (picturePath: string | null) =>
  picturePath && /^(https?:\/\/|\/)/.test(picturePath) ? picturePath : undefined

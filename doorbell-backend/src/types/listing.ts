import type { UserRole } from './user.js'

export const rooms = [
  'STUDIO',
  'ONE_ROOM_AND_KITCHEN',
  'TWO_ROOMS_AND_KITCHEN',
  'THREE_PLUS_ROOMS',
] as const

export type Room = (typeof rooms)[number]

export interface ListingInput {
  neighborhood: string
  city: string
  availableFrom: string
  rent: number
  squareMeters: number
  rooms: Room
  extraCosts?: string
}

export interface CreatedListing {
  id: string
}

export interface OwnedListing {
  id: string
  ownerId: string
  published: boolean
}

export interface ListingImage {
  id: string
  imagePath: string
  displayOrder: number
}

export interface PresignedImage {
  objectKey: string
  uploadUrl: string
  expiresIn: number
}

export interface ImageUploadInput {
  objectKey: string
  displayOrder: number
}

export type ListingRole = Extract<UserRole, 'LANDLORD'>

import { queueImageCleanup } from '../repositories/imageCleanupRepository.js'
import {
  consumeUserPictureUpload,
  registerUserPictureUpload,
  updateUserInfoById,
  withUserLock,
} from '../repositories/userRepository.js'
import type {
  UpdateUserInfoInput,
  UserInfo,
  UserInfoResponse,
} from '../types/user.js'
import { RequestError } from '../utils/requestError.js'
import {
  createPresignedImageDownload,
  createPresignedImageUpload,
  isProfilePictureKey,
  verifyImageObject,
} from './imageService.js'

const withPictureStorage = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof RequestError) throw error
    throw new RequestError(503, 'error.user.picture.storageUnavailable')
  }
}

export const toUserInfoResponse = async (
  user: UserInfo
): Promise<UserInfoResponse> => ({
  id: user.id,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  picturePath: user.picturePath,
  // Older versions accepted arbitrary references; never sign foreign objects.
  pictureUrl:
    user.picturePath && isProfilePictureKey(user.picturePath, user.id)
      ? await withPictureStorage(() =>
          createPresignedImageDownload(user.picturePath as string)
        )
      : null,
})

export const presignUserPicture = (userId: string, contentType: string) =>
  withUserLock(userId, async (client) => {
    const image = await withPictureStorage(() =>
      createPresignedImageUpload('users', userId, contentType)
    )
    await registerUserPictureUpload(
      client,
      userId,
      image.objectKey,
      contentType
    )
    return image
  })

export const updateUserProfile = (userId: string, input: UpdateUserInfoInput) =>
  withUserLock(userId, async (client, current) => {
    const nextPicture = input.picturePath
    if (nextPicture !== undefined && nextPicture !== current.picturePath) {
      if (nextPicture !== null) {
        if (!isProfilePictureKey(nextPicture, userId)) {
          throw new RequestError(400, 'error.user.picture.invalidKey')
        }
        const contentType = await consumeUserPictureUpload(
          client,
          userId,
          nextPicture
        )
        await withPictureStorage(() =>
          verifyImageObject(nextPicture, contentType, 'error.user.picture')
        )
      }
      if (
        current.picturePath &&
        isProfilePictureKey(current.picturePath, userId)
      ) {
        await queueImageCleanup(client, current.picturePath)
      }
    }
    const user = await updateUserInfoById(userId, input, client)
    // The locked account exists until commit. Sign before committing so a
    // signing/configuration failure also rolls back every field and cleanup job.
    return toUserInfoResponse(user as UserInfo)
  })

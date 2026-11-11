import { Avatar } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { displayablePicture } from '../../schemas/profile'
import { brand } from '../../theme/tokens'

const avatarSx = {
  width: 104,
  height: 104,
  fontSize: 36,
  fontWeight: 800,
  bgcolor: brand.purple100,
  color: brand.purple,
  boxShadow: `0 0 0 4px ${brand.purple50}`,
} as const

type ProfilePictureProps = {
  picturePath: string | null
  firstName: string
  lastName: string
}

// Shows the profile picture, or the user's initials when there is no picture
// or it can't be loaded.
export const ProfilePicture = ({
  picturePath,
  firstName,
  lastName,
}: ProfilePictureProps) => {
  const { t } = useTranslation()
  const name = `${firstName} ${lastName}`.trim()
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`

  return (
    <Avatar
      src={displayablePicture(picturePath)}
      // The label is on the avatar itself, so the image needs no alt text.
      alt=""
      role="img"
      aria-label={
        picturePath
          ? t('profile.pictureOf', { name })
          : t('profile.noPicture', { name })
      }
      sx={avatarSx}
    >
      {initials.toUpperCase()}
    </Avatar>
  )
}

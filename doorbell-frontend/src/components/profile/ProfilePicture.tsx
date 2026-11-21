import { Avatar } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { brand } from '../../theme/tokens'

const avatarSx = {
  width: 104,
  height: 104,
  fontSize: 36,
  fontWeight: 800,
  bgcolor: brand.purple100,
  color: brand.purple,
  boxShadow: `0 0 0 4px ${brand.purple50}`,
} satisfies SxProps<Theme>

type ProfilePictureProps = {
  // Presigned URL from GET /api/user/info, or null when there is none to show.
  pictureUrl: string | null
  firstName: string
  lastName: string
}

// Shows the profile picture, or the user's initials when there is no picture
// or it can't be loaded (for example after the signed URL expires).
export const ProfilePicture = ({
  pictureUrl,
  firstName,
  lastName,
}: ProfilePictureProps) => {
  const { t } = useTranslation()
  // Remembers which URL failed, so a new URL is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const shownUrl = pictureUrl && pictureUrl !== failedUrl ? pictureUrl : null
  const name = `${firstName} ${lastName}`.trim()
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`

  return (
    <Avatar
      src={shownUrl ?? undefined}
      // The label is on the avatar itself, so the image needs no alt text.
      alt=""
      slotProps={{ img: { onError: () => setFailedUrl(pictureUrl) } }}
      role="img"
      aria-label={
        shownUrl
          ? t('profile.pictureOf', { name })
          : t('profile.noPicture', { name })
      }
      sx={avatarSx}
    >
      {initials.toUpperCase()}
    </Avatar>
  )
}

import { Box, SvgIcon, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListingImage } from '../../types/match'

export const ListingPhoto = ({
  image,
  alt,
}: {
  image?: ListingImage
  alt: string
}) => {
  return (
    <PhotoSource
      key={image?.imageUrl ?? 'missing'}
      src={image?.imageUrl}
      alt={alt}
    />
  )
}

const PhotoSource = ({ src, alt }: { src?: string; alt: string }) => {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: 'selectedRoleBackground',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {src && !failed ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Box
          role="img"
          aria-label={t('listing.imageUnavailableAlt', { description: alt })}
          sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}
        >
          <SvgIcon
            aria-hidden="true"
            sx={{ fontSize: 40, color: 'primary.main', mb: 1 }}
          >
            <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM5 5h14v14H5V5Zm1 12h12l-4-5-3 4-2-3-3 4Z" />
          </SvgIcon>
          <Typography sx={{ fontSize: 14 }}>
            {t('listing.imageUnavailable')}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

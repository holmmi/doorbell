import { Box, Divider, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { brand, shadows } from '../../theme/tokens'
import type { ListingRoom } from '../../types/listing'

export type ListingPreview = {
  neighborhood: string
  city: string
  availableFrom: string
  rent: number
  squareMeters: number
  rooms: ListingRoom
  extraCosts: string
  imageUrl?: string
}

const cardSx = {
  bgcolor: 'background.paper',
  border: `1.5px solid ${brand.purple}`,
  borderRadius: '24px',
  overflow: 'hidden',
  boxShadow: shadows.card,
} as const

const photoFrameSx = {
  position: 'relative',
  aspectRatio: '16 / 10',
  bgcolor: brand.purple100,
} as const

const photoSx = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
} as const

const newTagSx = {
  position: 'absolute',
  top: 16,
  left: 16,
  display: 'inline-flex',
  px: '12px',
  py: '6px',
  borderRadius: '8px',
  bgcolor: brand.purple,
  color: 'common.white',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.04em',
  lineHeight: 1.2,
  textTransform: 'uppercase',
} as const

const priceRowSx = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 1.5,
  flexWrap: 'wrap',
} as const

// "YYYY-MM-DD" in the user's own time zone, comparable with date inputs.
const localToday = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

export const ListingPreviewCard = ({
  listing,
}: {
  listing: ListingPreview
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  const price = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(listing.rent)
  const size = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(listing.squareMeters)
  const available =
    listing.availableFrom > localToday()
      ? t('listing.availableOn', {
          date: new Date(
            `${listing.availableFrom}T00:00:00`
          ).toLocaleDateString(locale, { month: 'long', day: 'numeric' }),
        })
      : t('listing.availableNow')

  return (
    <Box component="article" sx={cardSx}>
      <Box sx={photoFrameSx}>
        {listing.imageUrl ? (
          <Box component="img" src={listing.imageUrl} alt="" sx={photoSx} />
        ) : null}
        <Box component="span" sx={newTagSx}>
          {t('listing.newToday')}
        </Box>
      </Box>

      <Box
        sx={{
          p: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={priceRowSx}>
            <Typography
              component="span"
              sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {t('listing.perMonth', { price })}
            </Typography>
            <Typography
              component="span"
              sx={{ fontSize: 15, fontWeight: 600, color: 'primary.main' }}
            >
              {available}
            </Typography>
          </Box>
          <Typography
            sx={{ fontSize: 14, fontWeight: 500, color: 'text.secondary' }}
          >
            {listing.extraCosts || t('listing.noExtras')}
          </Typography>
        </Box>
        <Divider sx={{ borderColor: brand.border }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography
            component="span"
            sx={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            {`${listing.neighborhood || '—'}, ${listing.city || '—'}`}
          </Typography>
          <Typography
            component="span"
            sx={{ fontSize: 16, color: 'text.secondary' }}
          >
            {`${t(`listing.roomTypes.${listing.rooms}`)} · ${t('listing.area', { size })}`}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

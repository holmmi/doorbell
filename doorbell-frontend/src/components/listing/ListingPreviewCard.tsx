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

const euro = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

const today = () => new Date().toISOString().slice(0, 10)

export function ListingPreviewCard({ listing }: { listing: ListingPreview }) {
  const { t } = useTranslation()

  const available =
    listing.availableFrom && listing.availableFrom > today()
      ? t('listing.availableOn', {
          date: new Date(
            `${listing.availableFrom}T00:00:00`
          ).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        })
      : t('listing.availableNow')

  return (
    <Box
      component="article"
      sx={{
        bgcolor: '#FFFFFF',
        border: `1.5px solid ${brand.purple}`,
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: shadows.card,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16 / 10',
          bgcolor: brand.purple100,
        }}
      >
        {listing.imageUrl ? (
          <Box
            component="img"
            src={listing.imageUrl}
            alt=""
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : null}
        <Box
          component="span"
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1,
            display: 'inline-flex',
            px: '12px',
            py: '6px',
            borderRadius: '8px',
            bgcolor: brand.purple,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1.2,
            textTransform: 'uppercase',
          }}
        >
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              component="span"
              sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {t('listing.perMonth', { price: euro.format(listing.rent) })}
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
            {`${t(`listing.roomTypes.${listing.rooms}`)} · ${t('listing.area', {
              size: decimal.format(listing.squareMeters),
            })}`}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

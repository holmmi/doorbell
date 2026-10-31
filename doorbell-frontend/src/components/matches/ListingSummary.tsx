import { Box, Divider, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchedListing } from '../../types/match'

export const ListingSummary = ({ listing }: { listing: MatchedListing }) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage
  const price = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number(listing.monthlyPrice) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(listing.monthlyPrice))
  const area = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Number(listing.squareMeters))
  // Date-only API values represent calendar dates, not UTC instants.
  const availableDate = new Date(`${listing.availableFrom}T00:00:00`)
  const [today] = useState(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  })
  const availability =
    availableDate <= today
      ? t('listing.availableNow')
      : t('listing.availableOn', {
          date: new Intl.DateTimeFormat(locale, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }).format(availableDate),
        })
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography
            sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            {t('listing.perMonth', { price })}
          </Typography>
          <Typography
            sx={{ fontSize: 15, fontWeight: 600, color: 'primary.main' }}
          >
            {availability}
          </Typography>
        </Box>
        {listing.extraCosts.trim() ? (
          <Typography
            sx={{
              mt: 0.5,
              fontSize: 14,
              color: 'text.secondary',
              overflowWrap: 'anywhere',
            }}
          >
            {listing.extraCosts}
          </Typography>
        ) : null}
      </Box>
      <Divider />
      <Box>
        <Typography
          component="h2"
          sx={{ fontSize: 21, fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          {listing.neighborhood}, {listing.city}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          {t(`listing.roomTypes.${listing.rooms}`)} ·{' '}
          {t('listing.area', { size: area })}
        </Typography>
      </Box>
    </Box>
  )
}

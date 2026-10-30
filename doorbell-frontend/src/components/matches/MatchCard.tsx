import { Box, Button, ButtonBase, Chip, Collapse, Stack } from '@mui/material'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchResponse } from '../../types/match'
import { ContactPanel } from './ContactPanel'
import { ListingPhoto } from './ListingPhoto'
import { ListingSummary } from './ListingSummary'

export function MatchCard({
  match,
  onDetails,
}: {
  match: MatchResponse
  onDetails: () => void
}) {
  const { t } = useTranslation()
  const [showContact, setShowContact] = useState(false)
  const contactId = useId()
  const { listing, landlord } = match
  const location = `${listing.neighborhood}, ${listing.city}`
  return (
    <Box
      component="article"
      sx={{
        bgcolor: 'background.paper',
        border: '1.5px solid',
        borderColor: 'primary.main',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 12px 30px rgba(110, 68, 255, 0.08)',
        minWidth: 0,
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <ButtonBase
          onClick={onDetails}
          aria-label={t('listing.viewDetailsFor', { location })}
          sx={{
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 10',
            position: 'relative',
            '&.Mui-focusVisible': {
              outline: '3px solid',
              outlineColor: 'text.primary',
              outlineOffset: -3,
            },
          }}
        >
          <ListingPhoto
            image={listing.images[0]}
            alt={t('listing.photoAlt', { location, index: 1 })}
          />
        </ButtonBase>
        <Chip
          label={t('matches.matched')}
          sx={{
            position: 'absolute',
            left: 16,
            top: 16,
            bgcolor: 'primary.main',
            color: 'white',
            fontWeight: 700,
            pointerEvents: 'none',
          }}
        />
        <Chip
          label={t('listing.photoCount', { count: listing.images.length })}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16,
            bgcolor: 'rgba(26, 26, 46, 0.65)',
            color: 'white',
            pointerEvents: 'none',
          }}
        />
      </Box>
      <Stack spacing={2} sx={{ p: { xs: 2.5, sm: 3 } }}>
        {!listing.published ? (
          <Chip
            label={t('matches.unpublished')}
            sx={{
              alignSelf: 'flex-start',
              maxWidth: '100%',
              height: 'auto',
              '& .MuiChip-label': { whiteSpace: 'normal', py: 0.75 },
            }}
          />
        ) : null}
        <ListingSummary listing={listing} />
        <Collapse in={showContact} id={contactId}>
          <ContactPanel landlord={landlord} />
        </Collapse>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.25,
            '& .MuiButton-root': { px: 1.5 },
          }}
        >
          <Button variant="outlined" onClick={onDetails}>
            {t('listing.viewDetails')}
          </Button>
          <Button
            variant="contained"
            onClick={() => setShowContact((shown) => !shown)}
            aria-expanded={showContact}
            aria-controls={contactId}
          >
            {showContact ? t('matches.hideContact') : t('matches.contact')}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchResponse } from '../../types/match'
import { ContactPanel } from './ContactPanel'
import { ListingSummary } from './ListingSummary'
import { PhotoGallery } from './PhotoGallery'

export const MatchDetailsDialog = ({
  match,
  onClose,
  onExited,
}: {
  match: MatchResponse | null
  onClose: () => void
  onExited: () => void
}) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const fullscreen = useMediaQuery(theme.breakpoints.down('sm'))
  const titleId = useId()
  const galleryRef = useRef<HTMLDivElement>(null)
  return (
    <Dialog
      open={Boolean(match)}
      onClose={onClose}
      fullScreen={fullscreen}
      fullWidth
      maxWidth="md"
      aria-labelledby={titleId}
      slotProps={{
        transition: {
          onExited,
          onEntered: () => galleryRef.current?.querySelector('button')?.focus(),
        },
      }}
    >
      <DialogTitle id={titleId}>{t('matches.detailsTitle')}</DialogTitle>
      <DialogContent dividers>
        {match ? (
          <Stack spacing={3}>
            {!match.listing.published ? (
              <Chip
                label={t('matches.unpublished')}
                sx={{
                  alignSelf: 'flex-start',
                  height: 'auto',
                  '& .MuiChip-label': { whiteSpace: 'normal', py: 0.75 },
                }}
              />
            ) : null}
            <PhotoGallery
              key={match.listing.id}
              listing={match.listing}
              galleryRef={galleryRef}
            />
            <ListingSummary listing={match.listing} />
            <ContactPanel landlord={match.landlord} />
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="outlined">
          {t('matches.closeDetails')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

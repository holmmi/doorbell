import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  SvgIcon,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useId, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchedListing, MatchResponse } from '../../types/match'
import { ContactPanel } from './ContactPanel'
import { ListingPhoto } from './ListingPhoto'
import { ListingSummary } from './ListingSummary'

const galleryArrowStyle = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 44,
  bgcolor: 'background.paper',
  color: 'text.primary',
  boxShadow: '0 2px 12px rgba(26, 26, 46, 0.2)',
  '&:hover': { bgcolor: 'grey.100' },
  '&.Mui-focusVisible': { outline: '3px solid', outlineColor: 'primary.main' },
} as const

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

const PhotoGallery = ({
  listing,
  galleryRef,
}: {
  listing: MatchedListing
  galleryRef: RefObject<HTMLDivElement | null>
}) => {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const count = listing.images.length
  const current = Math.min(index, Math.max(count - 1, 0))
  const go = (delta: number) => setIndex((current + delta + count) % count)
  const location = `${listing.neighborhood}, ${listing.city}`
  return (
    <Box
      ref={galleryRef}
      role="region"
      aria-label={t('listing.gallery')}
      onKeyDown={(event) => {
        if (
          count < 2 ||
          (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
        )
          return
        event.preventDefault()
        go(event.key === 'ArrowLeft' ? -1 : 1)
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          maxHeight: 'max(140px, calc(100dvh - 240px))',
          borderRadius: '16px',
          overflow: 'hidden',
          bgcolor: 'selectedRoleBackground',
          '& img': { objectFit: 'contain' },
        }}
      >
        <ListingPhoto
          image={listing.images[current]}
          alt={t('listing.photoAlt', { location, index: current + 1 })}
        />
        {count > 1 ? (
          <>
            <IconButton
              aria-label={t('listing.previousPhoto')}
              onClick={() => go(-1)}
              sx={{ ...galleryArrowStyle, left: 12 }}
            >
              <SvgIcon>
                <path d="m15.4 7.4-1.4-1.4-6 6 6 6 1.4-1.4-4.6-4.6z" />
              </SvgIcon>
            </IconButton>
            <IconButton
              aria-label={t('listing.nextPhoto')}
              onClick={() => go(1)}
              sx={{ ...galleryArrowStyle, right: 12 }}
            >
              <SvgIcon>
                <path d="m8.6 16.6 1.4 1.4 6-6-6-6-1.4 1.4 4.6 4.6z" />
              </SvgIcon>
            </IconButton>
          </>
        ) : null}
        <Typography
          role="status"
          sx={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: 'rgba(26, 26, 46, 0.75)',
            color: 'white',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          {count
            ? t('listing.photoPosition', { current: current + 1, total: count })
            : t('listing.photoCount', { count: 0 })}
        </Typography>
      </Box>
    </Box>
  )
}

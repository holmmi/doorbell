import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getListing } from '../api/listingClient'
import { ChevronLeftIcon } from '../components/home/icons'
import { ListingSummary } from '../components/matches/ListingSummary'
import { PhotoGallery } from '../components/matches/PhotoGallery'
import { useAuth } from '../hooks/useAuth'
import type { ListingDetails } from '../types/listing'

// Each result remembers which request produced it, so a new listing ID,
// account or retry shows the loading state until its own response arrives.
type LoadResult = { key: string } & (
  | { status: 'loaded'; listing: ListingDetails }
  | { status: 'notFound' | 'error' }
)

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

const BackToBrowsing = () => {
  const { t } = useTranslation()
  return (
    <Button
      component={RouterLink}
      to="/"
      startIcon={<ChevronLeftIcon />}
      sx={{
        alignSelf: 'flex-start',
        px: 1,
        ml: -1,
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: 0,
      }}
    >
      {t('listingDetails.backToBrowsing')}
    </Button>
  )
}

const LoadingState = () => {
  const { t } = useTranslation()
  return (
    <Stack spacing={3} role="status" aria-label={t('listingDetails.loading')}>
      <Skeleton
        variant="rounded"
        sx={{ width: '100%', height: 'auto', aspectRatio: '16 / 10' }}
      />
      <Skeleton variant="rounded" height={160} sx={{ borderRadius: '24px' }} />
    </Stack>
  )
}

export const ListingDetailsView = () => {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { user, logout } = useAuth()
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)
  const requestKey = `${id}:${user?.id ?? 'anonymous'}:${revision}`

  // The swipe deck sits partway down the home page; start this page at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    getListing(id, controller.signal).then(
      (listing) => {
        if (controller.signal.aborted) return
        const images = listing.images.toSorted(
          (a, b) => a.displayOrder - b.displayOrder
        )
        setResult({
          key: requestKey,
          status: 'loaded',
          listing: { ...listing, images },
        })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const status = error instanceof ApiError ? error.status : 0
        // An expired token fails even for public listings. Signing out clears
        // it, so the reload or Retry then fetches the listing anonymously.
        if (status === 401) logout()
        setResult({
          key: requestKey,
          status: status === 400 || status === 404 ? 'notFound' : 'error',
        })
      }
    )
    return () => controller.abort()
  }, [id, requestKey, logout])

  const current = result?.key === requestKey ? result : null
  const retry = () => setRevision((value) => value + 1)

  return (
    <Box
      sx={{
        maxWidth: 960,
        mx: 'auto',
        py: { xs: 3, md: 6 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2.5, md: 3 },
      }}
    >
      <BackToBrowsing />

      {current === null ? <LoadingState /> : null}

      {current?.status === 'notFound' ? (
        <Stack
          spacing={2}
          sx={{
            p: { xs: 3, md: 5 },
            border: '1.5px dashed',
            borderColor: 'primary.light',
            borderRadius: '20px',
            textAlign: 'center',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 800 }}
          >
            {t('listingDetails.notFoundTitle')}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {t('listingDetails.notFoundBody')}
          </Typography>
          <Button component={RouterLink} to="/" variant="contained">
            {t('listingDetails.backToBrowsing')}
          </Button>
        </Stack>
      ) : null}

      {current?.status === 'error' ? (
        <Alert
          severity="error"
          action={<Button onClick={retry}>{t('listingDetails.retry')}</Button>}
        >
          {t('listingDetails.loadError')}
        </Alert>
      ) : null}

      {current?.status === 'loaded' ? (
        <>
          <Typography variant="h1" sx={visuallyHidden}>
            {t('listingDetails.heading', {
              location: `${current.listing.neighborhood}, ${current.listing.city}`,
            })}
          </Typography>
          {!current.listing.published ? (
            <Chip
              label={t('listingDetails.unpublished')}
              sx={{
                alignSelf: 'flex-start',
                height: 'auto',
                '& .MuiChip-label': { whiteSpace: 'normal', py: 0.75 },
              }}
            />
          ) : null}
          <PhotoGallery key={current.listing.id} listing={current.listing} />
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              bgcolor: 'background.paper',
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: '24px',
              boxShadow: '0 16px 40px rgba(110, 68, 255, 0.12)',
            }}
          >
            <ListingSummary listing={current.listing} />
          </Box>
        </>
      ) : null}
    </Box>
  )
}

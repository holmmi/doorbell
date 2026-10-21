import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  Skeleton,
  Snackbar,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError, getToken } from '../api/client'
import { listingClient } from '../api/listingClient'
import { userClient } from '../api/userClient'
import { EmptyDeck } from '../components/home/EmptyDeck'
import { Faq } from '../components/home/Faq'
import { FilterBar } from '../components/home/FilterBar'
import { HowItWorks } from '../components/home/HowItWorks'
import { BellRingIcon } from '../components/home/icons'
import { LandlordStrip } from '../components/home/LandlordStrip'
import { SwipeDeck } from '../components/home/SwipeDeck'
import { Testimonials } from '../components/home/Testimonials'
import { toIsoDate } from '../components/home/format'
import type { FeedFilters, HomeListing } from '../types/listing'
import type { UserRole } from '../types/user'

type Viewer = UserRole | 'ANONYMOUS' | 'LOADING'

const noFilters: FeedFilters = {
  city: '',
  neighborhood: '',
  maxPrice: 0,
  minSize: 0,
}

const errorCodeOf = (error: unknown) =>
  error instanceof ApiError ? error.code : 'error.unknown'

const sameText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0

// TODO: send filters to GET /api/listing once the backend supports them.
const matchesFilters = (listing: HomeListing, filters: FeedFilters) =>
  (!filters.city || sameText(listing.city, filters.city)) &&
  (!filters.neighborhood ||
    sameText(listing.neighborhood, filters.neighborhood)) &&
  (!filters.maxPrice || listing.monthlyPrice <= filters.maxPrice) &&
  (!filters.minSize || listing.squareMeters >= filters.minSize)

export function HomeView() {
  const { t } = useTranslation()
  const [today] = useState(() => toIsoDate(new Date()))
  const [viewer, setViewer] = useState<Viewer>(() =>
    getToken() ? 'LOADING' : 'ANONYMOUS'
  )
  const [listings, setListings] = useState<HomeListing[] | null>(null)
  const [decided, setDecided] = useState<ReadonlySet<string>>(() => new Set())
  const [filters, setFilters] = useState<FeedFilters>(noFilters)
  const [likeNotice, setLikeNotice] = useState(false)
  const [signUpOpen, setSignUpOpen] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) return
    let ignore = false
    userClient
      .getCurrentUser()
      .then((user) => {
        if (!ignore) setViewer(user.role)
      })
      .catch((error: unknown) => {
        if (ignore) return
        setViewer('ANONYMOUS')
        setErrorCode(errorCodeOf(error))
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    listingClient
      .getFeed()
      .then((feed) => {
        if (!ignore) setListings(feed)
      })
      .catch((error: unknown) => {
        if (ignore) return
        setListings([])
        setErrorCode(errorCodeOf(error))
      })
    return () => {
      ignore = true
    }
  }, [])

  const loading = listings === null || viewer === 'LOADING'
  const canSwipe = viewer === 'TENANT' || viewer === 'ANONYMOUS'
  const filtersActive =
    filters.city !== '' ||
    filters.neighborhood !== '' ||
    filters.maxPrice > 0 ||
    filters.minSize > 0
  const deck = (listings ?? []).filter(
    (listing) => !decided.has(listing.id) && matchesFilters(listing, filters)
  )
  const neighborhoods = [
    ...new Set(
      (listings ?? [])
        .filter(
          (listing) => !filters.city || sameText(listing.city, filters.city)
        )
        .map((listing) => listing.neighborhood)
    ),
  ].sort((a, b) => a.localeCompare(b))

  const handleDecide = (listing: HomeListing, liked: boolean) => {
    if (liked && viewer === 'ANONYMOUS') {
      setSignUpOpen(true)
      return
    }
    // TODO: save with POST /api/listing/:listingId/preference once the backend
    // supports it. Until then decisions only last until the page reloads.
    setDecided((current) => new Set(current).add(listing.id))
    setLikeNotice(liked)
  }

  return (
    <Box>
      <Box
        component="section"
        sx={{
          pt: 9,
          pb: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h1"
          component="h1"
          sx={{
            maxWidth: 760,
            fontSize: { xs: 44, md: 64 },
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            fontWeight: 800,
            textWrap: 'balance',
          }}
        >
          {t('home.title')}
        </Typography>
        <Typography
          component="p"
          sx={{ mt: '18px', fontSize: 19, color: 'text.secondary' }}
        >
          {t('home.subtitle')}
        </Typography>

        <FilterBar
          filters={filters}
          neighborhoods={neighborhoods}
          onChange={setFilters}
        />

        <Typography
          role="status"
          sx={{
            mt: '18px',
            minHeight: 24,
            fontSize: 16,
            fontWeight: 600,
            color: 'primary.main',
          }}
        >
          {loading
            ? null
            : t('home.filters.matchCount', { count: deck.length })}
        </Typography>

        <Box
          sx={{ mt: '28px', width: 760, maxWidth: '100%', textAlign: 'left' }}
        >
          {loading ? (
            <Skeleton
              variant="rounded"
              height={640}
              sx={{ borderRadius: '24px' }}
            />
          ) : deck.length > 0 ? (
            <SwipeDeck
              listings={deck}
              today={today}
              canSwipe={canSwipe}
              onDecide={handleDecide}
            />
          ) : (
            <EmptyDeck
              signUp={viewer === 'ANONYMOUS' && !filtersActive}
              onClearFilters={
                filtersActive ? () => setFilters(noFilters) : undefined
              }
            />
          )}
        </Box>

        <Typography sx={{ mt: 4, fontSize: 18, color: 'text.secondary' }}>
          {viewer === 'LANDLORD'
            ? t('home.deck.landlordHint')
            : t('home.deck.hint')}
        </Typography>

        {likeNotice ? (
          <Box
            role="status"
            sx={{
              mt: 2,
              px: 2.5,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 1.75,
              borderRadius: '999px',
              bgcolor: 'selectedRoleBackground',
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: '9px',
                bgcolor: 'primary.main',
                color: 'common.white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BellRingIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography
              sx={{ fontSize: 20, fontWeight: 600, color: 'primary.main' }}
            >
              {t('home.deck.likeNotice')}
            </Typography>
          </Box>
        ) : null}
      </Box>

      <HowItWorks />
      <Testimonials />
      <LandlordStrip />
      <Faq />

      <Dialog
        open={signUpOpen}
        onClose={() => setSignUpOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: '24px', p: 1 } } }}
      >
        <DialogTitle sx={{ fontSize: 24, fontWeight: 700 }}>
          {t('home.deck.signUpDialogTitle')}
        </DialogTitle>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" component={Link} to="/login">
            {t('auth.logIn')}
          </Button>
          <Button variant="contained" component={Link} to="/registration">
            {t('auth.signUp')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={errorCode !== null}
        autoHideDuration={6000}
        onClose={() => setErrorCode(null)}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setErrorCode(null)}
        >
          {errorCode
            ? t(errorCode, { defaultValue: t('error.unknown') })
            : null}
        </Alert>
      </Snackbar>
    </Box>
  )
}

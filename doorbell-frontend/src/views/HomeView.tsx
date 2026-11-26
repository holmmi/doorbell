import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  Skeleton,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ApiError, getToken } from '../api/client'
import { getFeed, getFilterOptions } from '../api/listingClient'
import { savePreference } from '../api/listingInteractionClient'
import { EmptyDeck } from '../components/home/EmptyDeck'
import { Faq } from '../components/home/Faq'
import { FilterBar } from '../components/home/FilterBar'
import { HowItWorks } from '../components/home/HowItWorks'
import { BellRingIcon } from '../components/home/icons'
import { LandlordStrip } from '../components/home/LandlordStrip'
import { SwipeDeck } from '../components/home/SwipeDeck'
import { Testimonials } from '../components/home/Testimonials'
import { useAuth } from '../hooks/useAuth'
import { toIsoDate } from '../utils/format'
import type {
  FeedFilters,
  HomeListing,
  ListingFilterOptions,
} from '../types/listing'

const noFilters: FeedFilters = {
  city: '',
  neighborhood: '',
  maxPrice: 0,
  minSize: 0,
}

const parseFilterNumber = (value: string | null) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const filtersFromSearch = (searchParams: URLSearchParams): FeedFilters => ({
  city: searchParams.get('city') ?? '',
  neighborhood: searchParams.get('neighborhood') ?? '',
  maxPrice: parseFilterNumber(searchParams.get('maxPrice')),
  minSize: parseFilterNumber(searchParams.get('minSize')),
})

const sameFilters = (a: FeedFilters, b: FeedFilters) =>
  a.city === b.city &&
  a.neighborhood === b.neighborhood &&
  a.maxPrice === b.maxPrice &&
  a.minSize === b.minSize

const errorCodeOf = (error: unknown) =>
  error instanceof ApiError ? error.code : 'error.unknown'

export const HomeView = () => {
  const { user, status } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(searchParams), [searchParams])
  const [options, setOptions] = useState<ListingFilterOptions | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [optionsAttempt, setOptionsAttempt] = useState(0)

  const setFilters = (nextFilters: FeedFilters) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (nextFilters.city) {
      nextSearchParams.set('city', nextFilters.city)
    } else {
      nextSearchParams.delete('city')
    }
    if (nextFilters.neighborhood) {
      nextSearchParams.set('neighborhood', nextFilters.neighborhood)
    } else {
      nextSearchParams.delete('neighborhood')
    }
    if (nextFilters.maxPrice > 0) {
      nextSearchParams.set('maxPrice', String(nextFilters.maxPrice))
    } else {
      nextSearchParams.delete('maxPrice')
    }
    if (nextFilters.minSize > 0) {
      nextSearchParams.set('minSize', String(nextFilters.minSize))
    } else {
      nextSearchParams.delete('minSize')
    }
    setSearchParams(nextSearchParams, { replace: true })
  }

  useEffect(() => {
    let ignore = false
    getFilterOptions()
      .then((result) => {
        if (!ignore) setOptions(result)
      })
      .catch((error: unknown) => {
        if (!ignore) setOptionsError(errorCodeOf(error))
      })
    return () => {
      ignore = true
    }
  }, [optionsAttempt])

  return (
    <HomeContent
      key={`${status}:${user?.id ?? ''}:${user?.role ?? ''}`}
      filters={filters}
      setFilters={setFilters}
      options={options}
      optionsError={optionsError}
      retryOptions={() => {
        setOptionsError(null)
        setOptionsAttempt((attempt) => attempt + 1)
      }}
    />
  )
}

interface HomeContentProps {
  filters: FeedFilters
  setFilters: (filters: FeedFilters) => void
  options: ListingFilterOptions | null
  optionsError: string | null
  retryOptions: () => void
}

const HomeContent = ({
  filters,
  setFilters,
  options,
  optionsError,
  retryOptions,
}: HomeContentProps) => {
  const { t } = useTranslation()
  const { user, status, logout } = useAuth()
  const activeRef = useRef(false)
  const viewer = status === 'loading' ? 'LOADING' : (user?.role ?? 'ANONYMOUS')
  const [today] = useState(() => toIsoDate(new Date()))
  const [result, setResult] = useState<{
    filters: FeedFilters
    listings: HomeListing[]
    error: string | null
  } | null>(null)
  const [decided, setDecided] = useState<ReadonlySet<string>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [saveError, setSaveError] = useState<{
    filters: FeedFilters
    code: string
  } | null>(null)
  const [likeNotice, setLikeNotice] = useState(false)
  const [signUpOpen, setSignUpOpen] = useState(false)
  const latestFiltersRef = useRef(filters)
  const deck = (result?.listings ?? []).filter(
    (listing) => !decided.has(listing.id)
  )
  const exhausted =
    result?.filters === filters &&
    result.listings.length > 0 &&
    deck.length === 0

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    // Saved preferences are excluded by the API. Refill only after consuming
    // a nonempty response; an empty response or error must not cause a loop.
    if (result?.filters === filters && (!exhausted || result.error)) return
    let ignore = false
    getFeed(filters)
      .then((feed) => {
        if (!ignore) {
          setResult({
            filters,
            listings: feed.filter((listing) => !decided.has(listing.id)),
            error: null,
          })
        }
      })
      .catch((error: unknown) => {
        if (ignore) return
        setResult({ filters, listings: [], error: errorCodeOf(error) })
      })
    return () => {
      ignore = true
    }
  }, [filters, status, result, exhausted, decided])

  // A response belongs to the exact selection that requested it. Hide the old
  // deck during render, before effects run, and ignore responses after cleanup.
  const loading =
    result?.filters !== filters || viewer === 'LOADING' || exhausted
  const errorCode = loading ? null : result?.error
  const canSwipe = viewer === 'TENANT' || viewer === 'ANONYMOUS'
  const filtersActive =
    filters.city !== '' ||
    filters.neighborhood !== '' ||
    filters.maxPrice > 0 ||
    filters.minSize > 0
  const handleFiltersChange = (nextFilters: FeedFilters) => {
    latestFiltersRef.current = nextFilters
    setLikeNotice(false)
    setSignUpOpen(false)
    setFilters(nextFilters)
  }
  const clearFilters = () => handleFiltersChange({ ...noFilters })

  const handleDecide = async (listing: HomeListing, liked: boolean) => {
    if (viewer === 'ANONYMOUS') {
      setSignUpOpen(true)
      return
    }
    if (viewer !== 'TENANT' || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    setLikeNotice(false)
    const token = getToken()
    const isCurrentSession = () => activeRef.current && getToken() === token
    const removeListing = () => {
      setDecided((current) => new Set(current).add(listing.id))
      // A filter request may have raced this write. Reload its response so
      // already decided listings cannot hide additional matching homes.
      setResult((current) => (current?.filters !== filters ? null : current))
    }
    try {
      await savePreference(listing.id, liked)
      if (!isCurrentSession()) return
      removeListing()
      // A completed save must not show a notice for an old filter selection.
      setLikeNotice(liked && sameFilters(latestFiltersRef.current, filters))
    } catch (error: unknown) {
      if (!isCurrentSession()) return
      if (error instanceof ApiError && error.status === 401) {
        logout()
        return
      }
      setSaveError({ filters, code: errorCodeOf(error) })
      // A saved preference or unavailable listing cannot be retried.
      if (error instanceof ApiError && error.status === 409) removeListing()
    } finally {
      savingRef.current = false
      if (activeRef.current) setSaving(false)
    }
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
          options={options}
          onChange={handleFiltersChange}
        />

        {optionsError ? (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              <Button color="inherit" onClick={retryOptions}>
                {t('home.retry')}
              </Button>
            }
          >
            {t('home.filters.loadError')}{' '}
            {t(optionsError, { defaultValue: t('error.unknown') })}
          </Alert>
        ) : options === null ? (
          <Typography role="status" sx={{ mt: 2 }}>
            {t('home.filters.loading')}
          </Typography>
        ) : null}

        {filtersActive ? (
          <Button onClick={clearFilters} sx={{ mt: 2 }}>
            {t('home.deck.clearFilters')}
          </Button>
        ) : null}

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
            ? t('home.deck.loading')
            : saving
              ? t('home.deck.saving')
              : null}
        </Typography>

        <Box
          aria-busy={loading}
          sx={{ mt: '28px', width: 760, maxWidth: '100%', textAlign: 'left' }}
        >
          {loading ? (
            <Skeleton
              variant="rounded"
              height={640}
              sx={{ borderRadius: '24px' }}
            />
          ) : errorCode ? (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  onClick={() => {
                    setResult(null)
                  }}
                >
                  {t('home.retry')}
                </Button>
              }
            >
              {t('home.deck.loadError')}{' '}
              {t(errorCode, { defaultValue: t('error.unknown') })}
            </Alert>
          ) : deck.length > 0 ? (
            <SwipeDeck
              listings={deck}
              today={today}
              canSwipe={canSwipe}
              saving={saving}
              onDecide={(listing, liked) => void handleDecide(listing, liked)}
            />
          ) : (
            <EmptyDeck
              signUp={viewer === 'ANONYMOUS' && !filtersActive}
              onClearFilters={filtersActive ? clearFilters : undefined}
            />
          )}
        </Box>

        {saveError?.filters === filters ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t('home.deck.saveError')}{' '}
            {t(saveError.code, { defaultValue: t('error.unknown') })}
          </Alert>
        ) : null}

        <Typography sx={{ mt: 4, fontSize: 18, color: 'text.secondary' }}>
          {viewer === 'LANDLORD'
            ? t('home.deck.landlordHint')
            : t('home.deck.hint')}
        </Typography>

        {!loading && likeNotice ? (
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
        open={!loading && signUpOpen}
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
    </Box>
  )
}

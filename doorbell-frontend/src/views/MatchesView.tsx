import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, Navigate } from 'react-router'
import { MatchCard } from '../components/matches/MatchCard'
import { MatchDetailsDialog } from '../components/matches/MatchDetailsDialog'
import { useMatches } from '../state/matchesContext'
import { useAuth } from '../hooks/useAuth'

export function MatchesView() {
  const { t } = useTranslation()
  const { status, user, retry } = useAuth()
  const { forbidden } = useMatches()
  if (status === 'anonymous') return <Navigate to="/login" replace />
  if (status === 'loading') return <LoadingState />
  if (status === 'error') {
    return (
      <Box sx={{ py: 6 }}>
        <Alert
          severity="error"
          action={<Button onClick={retry}>{t('matches.retry')}</Button>}
        >
          {t('matches.sessionError')}
        </Alert>
      </Box>
    )
  }
  if (user?.role !== 'TENANT' || forbidden) {
    return (
      <Stack spacing={2} sx={{ py: 8, alignItems: 'flex-start' }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 32, md: 48 } }}>
          {t('matches.title')}
        </Typography>
        <Typography>{t('matches.tenantOnly')}</Typography>
        <Button component={RouterLink} to="/" variant="outlined">
          {t('matches.home')}
        </Button>
      </Stack>
    )
  }
  return <MatchesContent />
}

function LoadingState() {
  const { t } = useTranslation()
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        py: 8,
      }}
    >
      <CircularProgress size={24} aria-hidden="true" />
      <Typography>{t('matches.loading')}</Typography>
    </Box>
  )
}

function MatchesContent() {
  const { t } = useTranslation()
  const { matches, loading, error, refresh } = useMatches()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const refreshButtonRef = useRef<HTMLButtonElement>(null)
  const selected =
    matches?.find((match) => match.listing.id === selectedId) ?? null
  if (selectedId !== null && matches !== null && !selected) setSelectedId(null)

  // Mounting this view also refreshes a previously loaded navigation total.
  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <Box
      sx={{
        maxWidth: 1280,
        mx: 'auto',
        py: { xs: 4, md: 9 },
        px: { xs: 0, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 3, md: 5 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 3,
        }}
      >
        <Box>
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: 38, sm: 48, md: 56 } }}
          >
            {t('matches.title')}
          </Typography>
          <Typography
            sx={{
              mt: 1.5,
              color: 'text.secondary',
              fontSize: { xs: 17, md: 20 },
            }}
          >
            {t('matches.subtitle')}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          {matches ? (
            <Typography
              role="status"
              sx={{ fontSize: 17, fontWeight: 600, color: 'text.secondary' }}
            >
              {t('matches.count', { count: matches.length })}
            </Typography>
          ) : null}
          {matches ? (
            <Button
              ref={refreshButtonRef}
              variant="outlined"
              disabled={loading}
              onClick={() => {
                void refresh()
              }}
            >
              {loading ? t('matches.refreshing') : t('matches.refresh')}
            </Button>
          ) : null}
        </Stack>
      </Box>
      {error ? (
        <Alert
          severity="error"
          action={
            <Button
              disabled={loading}
              onClick={() => {
                void refresh()
              }}
            >
              {t('matches.retry')}
            </Button>
          }
        >
          {matches ? t('matches.refreshError') : t('matches.loadError')}
        </Alert>
      ) : null}
      {matches === null && !error ? <LoadingState /> : null}
      {matches?.length === 0 ? (
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
          <Typography sx={{ color: 'text.secondary' }}>
            {t('matches.empty')}
          </Typography>
          <Button component={RouterLink} to="/" variant="contained">
            {t('matches.browse')}
          </Button>
        </Stack>
      ) : null}
      {matches && matches.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            gap: { xs: 3, md: 4 },
            alignItems: 'start',
          }}
        >
          {matches.map((match) => (
            <MatchCard
              key={match.listing.id}
              match={match}
              onDetails={() => setSelectedId(match.listing.id)}
            />
          ))}
        </Box>
      ) : null}
      <MatchDetailsDialog
        match={selected}
        onClose={() => setSelectedId(null)}
        onExited={() => {
          // Wait for the dialog's focus trap and portal to finish cleaning up.
          requestAnimationFrame(() => {
            if (document.activeElement === document.body)
              refreshButtonRef.current?.focus()
          })
        }}
      />
    </Box>
  )
}

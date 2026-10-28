import { Box, Button, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BellRingIcon } from './icons'

interface EmptyDeckProps {
  signUp: boolean
  onClearFilters?: () => void
}

export function EmptyDeck({ signUp, onClearFilters }: EmptyDeckProps) {
  const { t } = useTranslation()

  return (
    <Box
      sx={{
        minHeight: 560,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 5,
        textAlign: 'center',
        bgcolor: 'homeSurface',
        border: '2px dashed',
        borderColor: 'emptyDeckBorder',
        borderRadius: '24px',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '16px',
          bgcolor: 'primary.main',
          color: 'common.white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BellRingIcon sx={{ fontSize: 34 }} />
      </Box>

      <Typography component="h2" sx={{ fontSize: 30, fontWeight: 700 }}>
        {signUp ? t('home.deck.signUpTitle') : t('home.deck.emptyTitle')}
      </Typography>

      {signUp ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
          <Button variant="contained" component={Link} to="/registration">
            {t('auth.signUp')}
          </Button>
          <Button variant="outlined" component={Link} to="/login">
            {t('auth.logIn')}
          </Button>
        </Stack>
      ) : (
        <>
          <Typography
            sx={{ fontSize: 18, color: 'text.secondary', maxWidth: 420 }}
          >
            {t('home.deck.emptyBody')}
          </Typography>
          {onClearFilters ? (
            <Button variant="contained" onClick={onClearFilters} sx={{ mt: 1 }}>
              {t('home.deck.clearFilters')}
            </Button>
          ) : null}
        </>
      )}
    </Box>
  )
}

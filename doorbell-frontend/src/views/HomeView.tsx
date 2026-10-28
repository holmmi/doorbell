import { Box, Button, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

export const HomeView = () => {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 96px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: { xs: 4, md: 8 },
      }}
    >
      <Box sx={{ maxWidth: 980 }}>
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: { xs: '3rem', sm: '4rem', md: '6rem' },
            lineHeight: 0.96,
            letterSpacing: '-0.06em',
            color: 'text.primary',
            fontWeight: 800,
          }}
        >
          {t('home.title')}
        </Typography>

        <Typography
          variant="h5"
          component="p"
          sx={{
            mt: 3,
            color: 'text.secondary',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.15rem', md: '1.8rem' },
          }}
        >
          {t('home.subtitle')}
        </Typography>

        {user?.role === 'TENANT' ? null : (
          <Button
            component={RouterLink}
            to={user ? '/listing/new' : '/login'}
            variant="contained"
            size="large"
            sx={{ mt: 4 }}
          >
            {t('listing.createCta')}
          </Button>
        )}
      </Box>
    </Box>
  )
}

import { Box, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { BellRingIcon } from './icons'

const bullets = ['free', 'interested', 'choose'] as const

export const LandlordStrip = () => {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <Box
      component="section"
      sx={{
        mb: 12,
        mx: 'auto',
        maxWidth: 1200,
        p: { xs: '40px 28px', md: '56px 64px' },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 5,
        bgcolor: 'primary.main',
        color: 'common.white',
        borderRadius: '28px',
      }}
    >
      <Box
        sx={{
          maxWidth: 620,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.75,
        }}
      >
        <Typography
          component="span"
          sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '.08em' }}
        >
          {t('home.landlords.overline')}
        </Typography>
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: 36, md: 44 },
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          {t('home.landlords.title')}
        </Typography>
        <Typography sx={{ fontSize: 19, lineHeight: 1.5 }}>
          {t('home.landlords.body')}
        </Typography>
        <Box
          component="ul"
          sx={{
            m: '8px 0 0',
            p: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {bullets.map((bullet) => (
            <Box
              key={bullet}
              component="li"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: '8px',
                  bgcolor: 'common.white',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BellRingIcon sx={{ fontSize: 18 }} />
              </Box>
              {t(`home.landlords.bullets.${bullet}`)}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Landlords go straight to the listing form. RegistrationView cannot
          preselect a role yet, so everyone else gets the default form. */}
      <Button
        component={Link}
        to={user?.role === 'LANDLORD' ? '/listing/new' : '/registration'}
        sx={{
          flexShrink: 0,
          height: 62,
          px: '34px',
          fontSize: 19,
          bgcolor: 'common.white',
          color: 'primary.main',
          boxShadow: '0 12px 28px rgba(26, 26, 46, 0.18)',
          '&:hover': {
            bgcolor: 'grey.50',
            boxShadow: '0 12px 28px rgba(26, 26, 46, 0.18)',
          },
        }}
      >
        {t('home.landlords.cta')}
      </Button>
    </Box>
  )
}

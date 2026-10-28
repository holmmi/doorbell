import { Box, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router'
import { useTranslation } from 'react-i18next'

export const DoorbellLogo = () => {
  const { t } = useTranslation()

  return (
    <RouterLink
      to="/"
      style={{
        color: 'inherit',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 0.5,
          backgroundColor: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Lucide bell-ring, matching the icon used on the home page. */}
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M22 8c0-2.3-.8-4.3-2-6" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
          <path d="M4 2C2.8 3.7 2 5.7 2 8" />
        </svg>
      </Box>

      <Typography
        variant="h4"
        component="span"
        sx={{
          fontWeight: 800,
          letterSpacing: '-0.06em',
          color: 'primary.main',
          fontSize: { xs: '2rem', md: '3rem' },
          lineHeight: 1,
        }}
      >
        {t('appName')}
      </Typography>
    </RouterLink>
  )
}

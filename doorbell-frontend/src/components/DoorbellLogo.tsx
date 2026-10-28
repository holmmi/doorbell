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
        <svg
          viewBox="0 0 24 24"
          width="25"
          height="25"
          aria-hidden="true"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 9.5a5 5 0 0 1 10 0v4.2l2.2 2.8H4.8L7 13.7V9.5Z"
            stroke="white"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 17.5h4a2 2 0 0 1-4 0Z" fill="white" />
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

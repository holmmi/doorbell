import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const ProfileView = () => {
  const { t } = useTranslation()

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
      <Typography
        variant="h1"
        component="h1"
        sx={{
          fontSize: { xs: '2.5rem', sm: '4rem', md: '5rem' },
          lineHeight: 0.96,
          letterSpacing: '-0.06em',
          color: 'text.primary',
          fontWeight: 800,
        }}
      >
        {t('nav.profile')}
      </Typography>
    </Box>
  )
}

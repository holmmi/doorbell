import { Box, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'

export const PageLoader = () => {
  const { t } = useTranslation()

  return (
    <Box sx={{ display: 'grid', minHeight: 320, placeItems: 'center' }}>
      <CircularProgress aria-label={t('common.loading')} />
    </Box>
  )
}

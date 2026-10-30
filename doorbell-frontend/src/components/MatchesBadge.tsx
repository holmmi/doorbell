import { Box, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

type MatchesBadgeProps = {
  count: number
}

export const MatchesBadge = ({ count }: MatchesBadgeProps) => {
  const { t } = useTranslation()
  if (count === 0) return null
  return (
    <Box
      component="span"
      aria-label={t('matches.count', { count })}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        height: 20,
        px: 0.75,
        borderRadius: 999,
        backgroundColor: 'secondary.main',
        color: 'text.primary',
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      <Typography
        variant="caption"
        component="span"
        sx={{
          color: 'text.primary',
          fontWeight: 700,
          fontSize: '0.72rem',
          lineHeight: 1,
        }}
      >
        {count}
      </Typography>
    </Box>
  )
}

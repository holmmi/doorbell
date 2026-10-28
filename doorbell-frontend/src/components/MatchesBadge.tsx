import { Box, Typography } from '@mui/material'

type MatchesBadgeProps = {
  count: number
}

export const MatchesBadge = ({ count }: MatchesBadgeProps) => {
  return (
    <Box
      component="span"
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

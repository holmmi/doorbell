import { Box } from '@mui/material'
import { Outlet } from 'react-router'
import { DoorbellLogo } from './DoorbellLogo'

export const AuthLayout = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 3,
        py: { xs: 4, sm: 6 },
        gap: 4,
        backgroundColor: 'background.default',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <DoorbellLogo />
      </Box>
      <Box component="main" sx={{ width: '100%', maxWidth: 560 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { DoorbellLogo } from './DoorbellLogo'
import { MatchesBadge } from './MatchesBadge'
import { ProfileAvatar } from './ProfileAvatar'

const navItems = [
  { key: 'home', to: '/' },
  { key: 'matches', to: '/matches' },
  { key: 'profile', to: '/profile' },
] as const

export function AppShell() {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          backgroundColor: 'background.default',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 84,
            px: { xs: 2.5, md: 4 },
          }}
        >
          <DoorbellLogo />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1.5, md: 3 },
              ml: 'auto',
              mr: 2,
            }}
          >
            {navItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                style={({ isActive }) => ({
                  color: isActive
                    ? theme.palette.primary.main
                    : theme.palette.text.secondary,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'color 0.2s ease',
                })}
              >
                <Typography
                  component="span"
                  sx={{
                    fontSize: { xs: '0.95rem', md: '1.2rem' },
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {t(`nav.${item.key}`)}
                </Typography>

                {item.key === 'matches' ? <MatchesBadge count={3} /> : null}
              </NavLink>
            ))}
          </Box>

          <ProfileAvatar alt={t('profile.avatarAlt')} />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 0 } }}>
        <Outlet />
      </Container>
    </Box>
  )
}

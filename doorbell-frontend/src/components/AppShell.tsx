import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types/user'
import { DoorbellLogo } from './DoorbellLogo'
import { LoginNavLink } from './LoginNavLink'
import { MatchesBadge } from './MatchesBadge'
import { ProfileAvatar } from './ProfileAvatar'

// `role` limits an item to one account type; signed-out users only see Home.
const navItems = [
  { key: 'home', to: '/' },
  { key: 'matches', to: '/matches', role: 'TENANT' },
  { key: 'profile', to: '/profile' },
] as const satisfies { key: string; to: string; role?: UserRole }[]

export const AppShell = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { user, status } = useAuth()
  const isLoggedIn = status === 'authenticated'

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
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            minHeight: { xs: 'auto', md: 84 },
            px: { xs: 2.5, md: 4 },
            py: { xs: 1.25, md: 0 },
            rowGap: { xs: 1, md: 0 },
          }}
        >
          <Box sx={{ order: { xs: 1, md: 0 } }}>
            <DoorbellLogo />
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'center', md: 'flex-start' },
              gap: { xs: 2, md: 3 },
              flexBasis: { xs: '100%', md: 'auto' },
              order: { xs: 3, md: 0 },
              ml: { xs: 0, md: 'auto' },
              mr: { xs: 0, md: 2 },
            }}
          >
            {navItems
              .filter((item) =>
                user
                  ? !('role' in item) || item.role === user.role
                  : item.key === 'home'
              )
              .map((item) => (
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

            {status === 'anonymous' ? <LoginNavLink /> : null}
            {isLoggedIn ? (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  ml: { xs: -1, md: -2 },
                }}
              >
                <ProfileAvatar alt={t('profile.avatarAlt')} />
              </Box>
            ) : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 0 } }}>
        <Outlet />
      </Container>
    </Box>
  )
}

import { Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { LogInIcon } from './icons'

export const LoginNavLink = () => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <NavLink
      to="/login"
      style={({ isActive }) => ({
        color: isActive
          ? theme.palette.primary.main
          : theme.palette.text.secondary,
        fontWeight: 700,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        transition: 'color 0.2s ease',
      })}
    >
      <LogInIcon sx={{ fontSize: { xs: 20, md: 24 } }} />
      <Typography
        component="span"
        sx={{
          color: 'inherit',
          fontSize: { xs: '0.95rem', md: '1.2rem' },
          fontWeight: 700,
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {t('auth.logIn')}
      </Typography>
    </NavLink>
  )
}

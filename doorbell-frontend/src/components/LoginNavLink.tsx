import { SvgIcon, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

export function LoginNavLink() {
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
      <SvgIcon
        viewBox="0 0 24 24"
        aria-hidden="true"
        sx={{
          fontSize: { xs: 20, md: 24 },
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      >
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="m10 17 5-5-5-5" />
        <path d="M15 12H3" />
      </SvgIcon>
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

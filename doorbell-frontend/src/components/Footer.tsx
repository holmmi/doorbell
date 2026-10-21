import { Box, Divider, Link, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'

// TODO: add these pages; the links lead to unmatched routes until then.
const footerLinks = [
  { key: 'about', to: '/about' },
  { key: 'contact', to: '/contact' },
  { key: 'privacy', to: '/privacy' },
] as const

const year = new Date().getFullYear()

export function Footer() {
  const { t } = useTranslation()

  return (
    <Box
      component="footer"
      sx={{ bgcolor: 'primary.main', color: 'common.white' }}
    >
      <Box
        sx={{
          maxWidth: 1440,
          mx: 'auto',
          px: { xs: 3, md: 10 },
          pt: { xs: 6, md: 8 },
          pb: { xs: 5, md: 7 },
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '9px',
                bgcolor: 'common.white',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="26"
                height="26"
                aria-hidden="true"
                fill="none"
              >
                <path
                  d="M7 9.5a5 5 0 0 1 10 0v4.2l2.2 2.8H4.8L7 13.7V9.5Z"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M10 17.5h4a2 2 0 0 1-4 0Z" fill="currentColor" />
              </svg>
            </Box>
            <Typography component="span" sx={{ fontSize: 26, fontWeight: 700 }}>
              {t('appName')}
            </Typography>
          </Box>

          <Box
            component="nav"
            aria-label={t('footer.navigation')}
            sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 3, md: 4 } }}
          >
            {footerLinks.map((link) => (
              <Link
                key={link.key}
                component={RouterLink}
                to={link.to}
                underline="hover"
                sx={{ color: 'common.white', fontSize: 17, fontWeight: 500 }}
              >
                {t(`footer.${link.key}`)}
              </Link>
            ))}
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.25)' }} />

        <Typography sx={{ fontSize: 15 }}>
          {t('footer.copyright', { year })}
        </Typography>
      </Box>
    </Box>
  )
}

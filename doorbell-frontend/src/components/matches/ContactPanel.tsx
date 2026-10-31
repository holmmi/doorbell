import { Avatar, Box, Link, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { LandlordContact } from '../../types/match'

export const ContactPanel = ({ landlord }: { landlord: LandlordContact }) => {
  const { t } = useTranslation()
  const name = `${landlord.firstName} ${landlord.lastName}`
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: '16px',
        bgcolor: 'selectedRoleBackground',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar
          aria-hidden="true"
          sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 15 }}
        >
          {landlord.firstName.charAt(0)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 12,
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            {t('matches.landlord')}
          </Typography>
          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {name}
          </Typography>
        </Box>
      </Box>
      <Link
        href={`mailto:${landlord.email}`}
        sx={{ fontSize: 15, overflowWrap: 'anywhere' }}
      >
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {t('matches.email')}:{' '}
        </Box>
        {landlord.email}
      </Link>
      {landlord.phone ? (
        <Link
          href={`tel:${landlord.phone.replace(/\s/g, '')}`}
          sx={{ fontSize: 15, overflowWrap: 'anywhere' }}
        >
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {t('matches.phone')}:{' '}
          </Box>
          {landlord.phone}
        </Link>
      ) : null}
    </Box>
  )
}

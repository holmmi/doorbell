import { Alert, Box, Button, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { PageLoader } from '../components/PageLoader'
import { PlusIcon } from '../components/icons'
import { ListingPreviewCard } from '../components/listing/ListingPreviewCard'
import {
  noticeSx,
  pageSx,
  solidButtonSx,
  statusSx,
  subtitleSx,
  titleSx,
} from '../components/listing/listingStyles'
import { useMyListings } from '../hooks/useMyListings'
import type { ListingDetails } from '../types/listing'
import { detailsToPreview } from '../utils/listingPreview'

const headerSx = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 3,
  flexWrap: 'wrap',
} satisfies SxProps<Theme>

const gridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
  gap: 4,
  alignItems: 'start',
} satisfies SxProps<Theme>

const cardFooterSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.5,
  flexWrap: 'wrap',
  mt: 1.5,
} satisfies SxProps<Theme>

const emptySx = {
  ...noticeSx,
  display: 'grid',
  justifyItems: 'start',
  gap: 1.5,
  p: { xs: 3, sm: 4 },
} satisfies SxProps<Theme>

const AddListingButton = () => {
  const { t } = useTranslation()
  return (
    <Button
      component={RouterLink}
      to="/listing/new"
      variant="contained"
      size="large"
      startIcon={<PlusIcon />}
      sx={solidButtonSx}
    >
      {t('myListings.add')}
    </Button>
  )
}

const MyListingCard = ({ listing }: { listing: ListingDetails }) => {
  const { t } = useTranslation()
  const location = `${listing.neighborhood}, ${listing.city}`

  return (
    <Box component="article" aria-label={location}>
      <ListingPreviewCard listing={detailsToPreview(listing)} />
      <Box sx={cardFooterSx}>
        <Box component="span" sx={statusSx(listing.published)}>
          {listing.published
            ? t('listing.edit.statusPublished')
            : t('listing.edit.statusDraft')}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {listing.published ? (
            <Button
              component={RouterLink}
              to={`/listings/${listing.id}`}
              variant="text"
              aria-label={t('myListings.viewFor', { location })}
            >
              {t('myListings.view')}
            </Button>
          ) : null}
          <Button
            component={RouterLink}
            to={`/listing/${listing.id}/edit`}
            variant="outlined"
            aria-label={t('myListings.editFor', { location })}
          >
            {t('myListings.edit')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export const MyListingsView = () => {
  const { t } = useTranslation()
  const { state, retry } = useMyListings()

  return (
    <Box sx={pageSx}>
      <Box sx={headerSx}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Typography variant="h1" sx={titleSx}>
            {t('myListings.title')}
          </Typography>
          <Typography sx={subtitleSx}>{t('myListings.subtitle')}</Typography>
        </Box>
        <AddListingButton />
      </Box>

      {state.status === 'loading' ? <PageLoader /> : null}

      {state.status === 'error' ? (
        <Alert
          severity="error"
          sx={{ borderRadius: '16px', alignItems: 'center' }}
          action={
            <Button color="inherit" size="small" onClick={retry}>
              {t('myListings.retry')}
            </Button>
          }
        >
          {t('myListings.loadFailed')}{' '}
          {t(state.errorCode, { defaultValue: t('error.unknown') })}
        </Alert>
      ) : null}

      {state.status === 'loaded' && state.listings.length === 0 ? (
        <Box sx={emptySx}>
          <Typography component="h2" sx={{ fontSize: 22, fontWeight: 800 }}>
            {t('myListings.emptyTitle')}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {t('myListings.emptyBody')}
          </Typography>
          <AddListingButton />
        </Box>
      ) : null}

      {state.status === 'loaded' && state.listings.length > 0 ? (
        <Box component="section" aria-label={t('myListings.title')} sx={gridSx}>
          {state.listings.map((listing) => (
            <MyListingCard key={listing.id} listing={listing} />
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

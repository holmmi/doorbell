import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { ControlledTextField } from '../components/form/ControlledTextField'
import { ListingPhotoPicker } from '../components/listing/ListingPhotoPicker'
import { ListingPreviewCard } from '../components/listing/ListingPreviewCard'
import { usePublishListing } from '../hooks/usePublishListing'
import { listingFormSchema } from '../schemas/listing'
import type { ListingFormInput, ListingFormValues } from '../schemas/listing'
import { brand, shadows } from '../theme/tokens'
import { listingRooms } from '../types/listing'

const defaultValues: ListingFormInput = {
  neighborhood: '',
  city: '',
  availableFrom: '',
  rent: '',
  squareMeters: '',
  rooms: 'STUDIO',
  extraCosts: '',
}

const pageSx = {
  width: '100%',
  maxWidth: 1200,
  mx: 'auto',
  px: { xs: 0, sm: 4 },
  pt: 6,
  pb: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 4.5,
  // Doorbell input style from the UI kit, scoped to this view.
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: 'background.paper',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: brand.borderInput,
      borderWidth: 1.5,
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: brand.purple200,
    },
    '&.Mui-focused': { boxShadow: shadows.focusRing },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: brand.purple,
      borderWidth: 1.5,
    },
  },
} as const

const backLinkSx = {
  alignSelf: 'flex-start',
  px: 0,
  py: 0,
  minHeight: 0,
  fontSize: 17,
  fontWeight: 600,
  '&:hover': { bgcolor: 'transparent' },
} as const

const formCardSx = {
  bgcolor: 'background.paper',
  border: `1px solid ${brand.border}`,
  borderRadius: '22px',
  p: { xs: 2.5, sm: 4 },
  display: 'flex',
  flexDirection: 'column',
  gap: 3.25,
} as const

const fieldGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    sm: 'repeat(2, minmax(0, 1fr))',
  },
  gap: 2.25,
} as const

const roomChipSx = (selected: boolean) => ({
  height: 44,
  px: 1,
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 600,
  border: `1.5px solid ${selected ? brand.purple : brand.borderInput}`,
  bgcolor: selected ? brand.purple50 : 'background.paper',
  color: selected ? brand.purple : 'text.primary',
  '&:hover': { bgcolor: brand.purple50 },
})

// The theme's contained button is a gradient; the UI kit uses solid purple.
const solidButtonSx = {
  background: 'none',
  bgcolor: brand.purple,
  '&:hover': { background: 'none', bgcolor: brand.purpleHover },
} as const

const publishButtonSx = (published: boolean) => ({
  ...solidButtonSx,
  minHeight: 58,
  fontSize: 18,
  bgcolor: published ? brand.success : brand.purple,
  boxShadow: published ? 'none' : shadows.cta,
  '&.Mui-disabled': {
    color: 'common.white',
    bgcolor: published ? brand.success : brand.purple200,
  },
})

const previewLabelSx = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  lineHeight: 1.4,
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const

// Announces the publish progress to screen readers without showing it twice.
const visuallyHiddenSx = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
} as const

const liveAlertSx = {
  bgcolor: brand.purple50,
  border: `1.5px solid ${brand.purple200}`,
  borderRadius: '16px',
  color: 'text.primary',
  p: 2.5,
} as const

export const CreateListingView = () => {
  const { t } = useTranslation()
  const {
    photos,
    photoError,
    serverError,
    stage,
    locked,
    published,
    addPhotos,
    removePhoto,
    publish,
  } = usePublishListing()
  const { control, handleSubmit } = useForm<
    ListingFormInput,
    unknown,
    ListingFormValues
  >({
    resolver: zodResolver(listingFormSchema),
    defaultValues,
  })
  const draft = { ...defaultValues, ...useWatch({ control }) }

  const busy = stage !== 'idle'
  const disabled = locked || published
  const progressText = busy ? t(`listing.progress.${stage}`) : null

  return (
    <Box sx={pageSx}>
      <Button component={RouterLink} to="/" variant="text" sx={backLinkSx}>
        {t('listing.back')}
      </Button>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 40, md: 52 },
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
          }}
        >
          {t('listing.title')}
        </Typography>
        <Typography
          sx={{
            fontSize: '1.1875rem',
            lineHeight: 1.5,
            color: 'text.secondary',
          }}
        >
          {t('listing.subtitle')}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
          gap: 5,
          alignItems: 'start',
        }}
      >
        <Box
          component="form"
          noValidate
          onSubmit={(event) => void handleSubmit(publish)(event)}
          sx={formCardSx}
        >
          {serverError ? (
            <Alert severity="error" sx={{ borderRadius: '16px' }}>
              {t(serverError, { defaultValue: t('error.unknown') })}
            </Alert>
          ) : null}

          <ListingPhotoPicker
            photos={photos}
            disabled={disabled}
            error={photoError}
            onAdd={addPhotos}
            onRemove={removePhoto}
          />

          <Box sx={fieldGridSx}>
            <ControlledTextField
              control={control}
              name="neighborhood"
              label={t('listing.neighborhood')}
              placeholder={t('listing.neighborhoodPlaceholder')}
              autoComplete="address-level3"
              disabled={disabled}
            />
            <ControlledTextField
              control={control}
              name="city"
              label={t('listing.city')}
              placeholder={t('listing.cityPlaceholder')}
              autoComplete="address-level2"
              disabled={disabled}
            />
            <ControlledTextField
              control={control}
              name="rent"
              label={t('listing.rent')}
              type="number"
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              disabled={disabled}
            />
            <ControlledTextField
              control={control}
              name="squareMeters"
              label={t('listing.squareMeters')}
              type="number"
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              disabled={disabled}
            />
            <ControlledTextField
              control={control}
              name="availableFrom"
              label={t('listing.availableFrom')}
              type="date"
              disabled={disabled}
            />
            <ControlledTextField
              control={control}
              name="extraCosts"
              label={t('listing.extraCosts')}
              placeholder={t('listing.extraCostsPlaceholder')}
              disabled={disabled}
            />
            <Box
              sx={{
                gridColumn: '1 / -1',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
                {t('listing.rooms')}
              </Typography>
              <Controller
                control={control}
                name="rooms"
                render={({ field }) => (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {listingRooms.map((room) => (
                      <Chip
                        key={room}
                        label={t(`listing.roomTypes.${room}`)}
                        onClick={() => field.onChange(room)}
                        disabled={disabled}
                        variant={field.value === room ? 'filled' : 'outlined'}
                        aria-pressed={field.value === room}
                        sx={roomChipSx(field.value === room)}
                      />
                    ))}
                  </Box>
                )}
              />
            </Box>
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={busy || published}
            startIcon={
              busy ? <CircularProgress size={18} color="inherit" /> : null
            }
            sx={publishButtonSx(published)}
          >
            {published
              ? t('listing.published')
              : (progressText ?? t('listing.publish'))}
          </Button>
          {progressText ? (
            <Typography role="status" sx={visuallyHiddenSx}>
              {progressText}
            </Typography>
          ) : null}
        </Box>

        <Box
          sx={{
            position: { md: 'sticky' },
            top: 110,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
          }}
        >
          <Typography sx={previewLabelSx}>{t('listing.preview')}</Typography>
          <ListingPreviewCard
            listing={{
              neighborhood: draft.neighborhood,
              city: draft.city,
              availableFrom: draft.availableFrom,
              rent: Number(draft.rent) || 0,
              squareMeters: Number(draft.squareMeters) || 0,
              rooms: draft.rooms,
              extraCosts: draft.extraCosts ?? '',
              imageUrl: photos[0]?.previewUrl,
            }}
          />
          {published ? (
            <Alert severity="success" icon={false} sx={liveAlertSx}>
              <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
                {t('listing.liveTitle')}
              </Typography>
              <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                {t('listing.liveBody', { city: draft.city })}
              </Typography>
              <Button
                component={RouterLink}
                to="/"
                variant="contained"
                sx={[solidButtonSx, { mt: 2 }]}
              >
                {t('listing.backHome')}
              </Button>
            </Alert>
          ) : null}
        </Box>
      </Box>
    </Box>
  )
}

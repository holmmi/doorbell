import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Typography } from '@mui/material'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { ListingEditorLayout } from '../components/listing/ListingEditorLayout'
import { ListingFields } from '../components/listing/ListingFields'
import { ListingPhotoPicker } from '../components/listing/ListingPhotoPicker'
import { ListingPreviewCard } from '../components/listing/ListingPreviewCard'
import { noticeSx, solidButtonSx } from '../components/listing/listingStyles'
import { usePublishListing } from '../hooks/usePublishListing'
import {
  emptyListingForm,
  formToPreview,
  listingFormSchema,
} from '../schemas/listing'
import type { ListingFormInput, ListingFormValues } from '../schemas/listing'

export const CreateListingView = () => {
  const { t } = useTranslation()
  const {
    photos,
    photoError,
    serverError,
    stage,
    locked,
    published,
    listingId,
    addPhotos,
    removePhoto,
    movePhoto,
    publish,
  } = usePublishListing()
  const { control, handleSubmit } = useForm<
    ListingFormInput,
    unknown,
    ListingFormValues
  >({
    resolver: zodResolver(listingFormSchema),
    defaultValues: emptyListingForm,
  })
  const draft = { ...emptyListingForm, ...useWatch({ control }) }

  const busy = stage !== 'idle'
  const disabled = locked || published

  return (
    <ListingEditorLayout
      title={t('listing.title')}
      subtitle={t('listing.subtitle')}
      onSubmit={(event) => void handleSubmit(publish)(event)}
      serverError={serverError}
      submitLabel={published ? t('listing.published') : t('listing.publish')}
      progressText={busy ? t(`listing.progress.${stage}`) : null}
      done={published}
      submitDisabled={busy || published}
      preview={
        <ListingPreviewCard
          listing={formToPreview(draft, photos[0]?.previewUrl)}
        />
      }
      aside={
        published ? (
          <Alert severity="success" icon={false} sx={noticeSx}>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
              {t('listing.liveTitle')}
            </Typography>
            <Typography sx={{ mt: 1, color: 'text.secondary' }}>
              {t('listing.liveBody', { city: draft.city })}
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                component={RouterLink}
                to="/"
                variant="contained"
                sx={solidButtonSx}
              >
                {t('listing.backHome')}
              </Button>
              {listingId ? (
                <Button
                  component={RouterLink}
                  to={`/listing/${listingId}/edit`}
                  variant="outlined"
                >
                  {t('listing.edit.cta')}
                </Button>
              ) : null}
            </Box>
          </Alert>
        ) : null
      }
    >
      <ListingPhotoPicker
        photos={photos}
        disabled={disabled}
        error={photoError}
        onAdd={addPhotos}
        onRemove={removePhoto}
        onMove={movePhoto}
      />
      <ListingFields control={control} disabled={disabled} />
    </ListingEditorLayout>
  )
}

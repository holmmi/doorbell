import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useParams } from 'react-router'
import { ApiError } from '../api/client'
import * as listingClient from '../api/listingClient'
import { PageLoader } from '../components/PageLoader'
import { ListingEditorLayout } from '../components/listing/ListingEditorLayout'
import { ListingFields } from '../components/listing/ListingFields'
import { ListingPhotoPicker } from '../components/listing/ListingPhotoPicker'
import { ListingPreviewCard } from '../components/listing/ListingPreviewCard'
import {
  noticeSx,
  pageSx,
  solidButtonSx,
  statusSx,
} from '../components/listing/listingStyles'
import { useAuth } from '../hooks/useAuth'
import { useEditListing } from '../hooks/useEditListing'
import {
  formToPreview,
  listingFormSchema,
  listingToFormInput,
} from '../schemas/listing'
import type { ListingFormInput, ListingFormValues } from '../schemas/listing'
import type { ListingDetails } from '../types/listing'

// Both mean there is no listing of yours at this address.
const notFoundCodes = new Set([
  'error.listing.notFound',
  'error.request.invalid',
])

type EditListingFormProps = {
  initialListing: ListingDetails
}

const EditListingForm = ({ initialListing }: EditListingFormProps) => {
  const { t } = useTranslation()
  const {
    listing,
    photos,
    photoError,
    serverError,
    notice,
    stage,
    busy,
    addPhotos,
    removePhoto,
    movePhoto,
    save,
    publish,
  } = useEditListing(initialListing)
  const { control, handleSubmit, reset } = useForm<
    ListingFormInput,
    unknown,
    ListingFormValues
  >({
    resolver: zodResolver(listingFormSchema),
    defaultValues: listingToFormInput(initialListing),
  })
  const draft = { ...listingToFormInput(listing), ...useWatch({ control }) }

  // The backend unpublishes a listing that is saved without photos.
  const unpublishes = listing.published && photos.length === 0
  const canPublish = !listing.published && listing.ready

  const onSubmit = handleSubmit(async (values) => {
    const saved = await save(values)
    if (saved) reset(listingToFormInput(saved))
  })

  return (
    <ListingEditorLayout
      title={t('listing.edit.title')}
      subtitle={t('listing.edit.subtitle')}
      onSubmit={(event) => void onSubmit(event)}
      serverError={serverError}
      submitLabel={
        unpublishes
          ? t('listing.edit.saveAndUnpublish')
          : t('listing.edit.save')
      }
      progressText={busy ? t(`listing.progress.${stage}`) : null}
      submitDisabled={busy}
      preview={
        <ListingPreviewCard
          listing={formToPreview(
            draft,
            photos[0]?.previewUrl,
            listing.createdAt
          )}
        />
      }
      aside={
        <>
          <Box sx={statusSx(listing.published)}>
            {listing.published
              ? t('listing.edit.statusPublished')
              : t('listing.edit.statusDraft')}
          </Box>
          {notice ? (
            <Alert severity="success" icon={false} sx={noticeSx} role="status">
              <Typography sx={{ fontWeight: 700 }}>
                {t(`listing.edit.notice.${notice}`)}
              </Typography>
            </Alert>
          ) : null}
          {canPublish ? (
            <Box sx={[noticeSx, { display: 'grid', gap: 1.5 }]}>
              <Typography sx={{ color: 'text.secondary' }}>
                {t('listing.edit.draftHint')}
              </Typography>
              <Button
                variant="contained"
                onClick={() => void publish()}
                disabled={busy}
                sx={[solidButtonSx, { justifySelf: 'start' }]}
              >
                {t('listing.publish')}
              </Button>
            </Box>
          ) : null}
        </>
      }
    >
      <ListingPhotoPicker
        photos={photos}
        disabled={busy}
        error={photoError}
        onAdd={addPhotos}
        onRemove={removePhoto}
        onMove={movePhoto}
      />
      {unpublishes ? (
        <Alert severity="warning" sx={{ borderRadius: '16px' }}>
          {t('listing.edit.unpublishWarning')}
        </Alert>
      ) : null}
      <ListingFields control={control} disabled={busy} />
    </ListingEditorLayout>
  )
}

export const EditListingView = () => {
  const { t } = useTranslation()
  const { listingId = '' } = useParams()
  const { user } = useAuth()
  const [listing, setListing] = useState<ListingDetails | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listingClient
      .getListing(listingId)
      .then((loaded) => {
        if (!active) return
        // Published listings are public, so check that this one is yours.
        if (loaded.ownerId === user?.id) setListing(loaded)
        else setErrorCode('error.listing.notFound')
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorCode(error instanceof ApiError ? error.code : 'error.network')
        }
      })
    return () => {
      active = false
    }
  }, [listingId, user?.id])

  if (errorCode) {
    return (
      <Box sx={pageSx}>
        <Alert severity="error" sx={{ borderRadius: '16px' }}>
          {notFoundCodes.has(errorCode)
            ? t('error.listing.notFound')
            : t(errorCode, { defaultValue: t('error.unknown') })}
        </Alert>
        <Button
          component={RouterLink}
          to="/"
          variant="contained"
          sx={[solidButtonSx, { alignSelf: 'flex-start' }]}
        >
          {t('listing.backHome')}
        </Button>
      </Box>
    )
  }

  if (!listing) return <PageLoader />

  return <EditListingForm key={listing.id} initialListing={listing} />
}

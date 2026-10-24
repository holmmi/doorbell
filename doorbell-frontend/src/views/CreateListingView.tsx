import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Typography,
} from '@mui/material'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, Link as RouterLink } from 'react-router'
import { ApiError } from '../api/client'
import { listingClient } from '../api/listingClient'
import { ControlledTextField } from '../components/form/ControlledTextField'
import { CloseIcon, PlusIcon } from '../components/icons'
import { ListingPreviewCard } from '../components/listing/ListingPreviewCard'
import { PageLoader } from '../components/PageLoader'
import { useAuth } from '../hooks/useAuth'
import { listingFormSchema } from '../schemas/listing'
import type { ListingFormInput, ListingFormValues } from '../schemas/listing'
import { brand, shadows } from '../theme/tokens'
import { listingRooms } from '../types/listing'
import type { ListingImageInput } from '../types/listing'

type PendingPhoto = {
  key: string
  file: File
  previewUrl: string
  objectKey?: string
  uploadUrl?: string
  uploaded: boolean
}

type SubmissionStage =
  'idle' | 'creating' | 'uploading' | 'saving' | 'publishing'

const allowedPhotoTypes = new Set(['image/png', 'image/jpg', 'image/jpeg'])
const cities = ['Helsinki', 'Tampere', 'Turku']
const mosaicSize = 3

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
    bgcolor: '#FFFFFF',
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
  '& .MuiSelect-icon': { color: brand.purple },
} as const

export function CreateListingView() {
  const { t } = useTranslation()
  const { user, status } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef(new Set<string>())
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [stage, setStage] = useState<SubmissionStage>('idle')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [imagesFinalized, setImagesFinalized] = useState(false)
  const [publishedId, setPublishedId] = useState<string | null>(null)

  const defaultValues: ListingFormInput = {
    neighborhood: '',
    city: 'Helsinki',
    availableFrom: '',
    rent: '',
    squareMeters: '',
    rooms: 'STUDIO',
    extraCosts: '',
  }
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ListingFormInput, unknown, ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues,
  })
  const draft = { ...defaultValues, ...useWatch({ control }) }

  useEffect(() => {
    const previewUrls = previewUrlsRef.current
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const updatePhoto = (updatedPhoto: PendingPhoto) => {
    setPhotos((currentPhotos) =>
      currentPhotos.map((photo) =>
        photo.key === updatedPhoto.key ? updatedPhoto : photo
      )
    )
  }

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selectedFiles.length === 0) return

    const supportedFiles = selectedFiles.filter((file) =>
      allowedPhotoTypes.has(file.type)
    )
    const nextPhotos = supportedFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file)
      previewUrlsRef.current.add(previewUrl)
      return {
        key: crypto.randomUUID(),
        file,
        previewUrl,
        uploaded: false,
      }
    })

    setPhotos((currentPhotos) => [...currentPhotos, ...nextPhotos])
    setPhotoError(
      supportedFiles.length === selectedFiles.length
        ? null
        : 'listing.validation.photoType'
    )
  }

  const removePhoto = (key: string) => {
    const photo = photos.find((currentPhoto) => currentPhoto.key === key)
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl)
      previewUrlsRef.current.delete(photo.previewUrl)
    }
    setPhotos((currentPhotos) =>
      currentPhotos.filter((currentPhoto) => currentPhoto.key !== key)
    )
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    setPhotoError(null)

    if (!imagesFinalized && photos.length === 0) {
      setPhotoError('listing.validation.photosRequired')
      return
    }

    try {
      let listingId = draftId
      if (!listingId) {
        setStage('creating')
        const listing = await listingClient.createListing(values)
        listingId = listing.id
        setDraftId(listingId)
      }

      if (!imagesFinalized) {
        setStage('uploading')
        const imageInputs: ListingImageInput[] = []

        for (const [index, selectedPhoto] of photos.entries()) {
          let photo = selectedPhoto
          let uploadUrl = photo.uploadUrl

          if (!photo.objectKey || !uploadUrl) {
            const upload = await listingClient.requestImageUpload(
              listingId,
              photo.file.type
            )
            photo = {
              ...photo,
              objectKey: upload.objectKey,
              uploadUrl: upload.uploadUrl,
            }
            uploadUrl = upload.uploadUrl
            updatePhoto(photo)
          }

          if (!uploadUrl || !photo.objectKey) {
            throw new ApiError(0, 'error.listing.image.uploadFailed')
          }
          const objectKey = photo.objectKey

          if (!photo.uploaded) {
            try {
              await listingClient.uploadImage(uploadUrl, photo.file)
            } catch (error) {
              updatePhoto({
                ...photo,
                objectKey: undefined,
                uploadUrl: undefined,
                uploaded: false,
              })
              throw error
            }
            photo = { ...photo, uploaded: true }
            updatePhoto(photo)
          }

          imageInputs.push({
            objectKey,
            displayOrder: index + 1,
          })
        }

        setStage('saving')
        await listingClient.saveListingImages(listingId, values, imageInputs)
        setImagesFinalized(true)
      }

      setStage('publishing')
      const result = await listingClient.publishListing(listingId)
      setPublishedId(result.id)
    } catch (error) {
      setServerError(error instanceof ApiError ? error.code : 'error.network')
    } finally {
      setStage('idle')
    }
  })

  if (status === 'loading') return <PageLoader />
  if (status === 'anonymous') return <Navigate to="/login" replace />

  if (user?.role !== 'LANDLORD') {
    return (
      <Box sx={pageSx}>
        <Alert severity="error" sx={{ borderRadius: '16px' }}>
          {t('error.authorization.forbidden')}
        </Alert>
      </Box>
    )
  }

  const published = publishedId !== null
  const busy = isSubmitting || stage !== 'idle'
  const locked = busy || imagesFinalized || published
  const progressText = stage === 'idle' ? null : t(`listing.progress.${stage}`)
  const mosaicPhotos = photos.slice(0, mosaicSize)
  const extraPhotos = photos.slice(mosaicSize)

  const openFilePicker = () => fileInputRef.current?.click()

  const addTile = (sx: object) => (
    <ButtonBase
      onClick={openFilePicker}
      disabled={locked}
      aria-label={t('listing.addPhotos')}
      sx={{
        ...sx,
        borderRadius: '12px',
        border: `1.5px dashed ${brand.purple200}`,
        bgcolor: brand.purple50,
        color: 'primary.main',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        fontSize: 15,
        fontWeight: 700,
        fontFamily: 'inherit',
        transition: 'border-color 200ms ease',
        '&:hover': { borderColor: brand.purple },
      }}
    >
      <PlusIcon />
      {t('listing.addPhotos')}
    </ButtonBase>
  )

  const photoTile = (photo: PendingPhoto, sx: object) => (
    <Box
      key={photo.key}
      sx={{ ...sx, position: 'relative', minHeight: 0, minWidth: 0 }}
    >
      <Box
        component="img"
        src={photo.previewUrl}
        alt={photo.file.name}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '12px',
          display: 'block',
        }}
      />
      {locked ? null : (
        <IconButton
          size="small"
          aria-label={t('listing.removePhoto', { name: photo.file.name })}
          onClick={() => removePhoto(photo.key)}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            bgcolor: 'rgba(255, 255, 255, 0.92)',
            color: brand.ink,
            '&:hover': { bgcolor: '#FFFFFF' },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} style={{ strokeWidth: 2.5 }} />
        </IconButton>
      )}
    </Box>
  )

  return (
    <Box sx={pageSx}>
      <Button
        component={RouterLink}
        to="/"
        variant="text"
        sx={{
          alignSelf: 'flex-start',
          px: 0,
          py: 0,
          minHeight: 0,
          fontSize: 17,
          fontWeight: 600,
          '&:hover': { bgcolor: 'transparent' },
        }}
      >
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
          onSubmit={(event) => void onSubmit(event)}
          sx={{
            bgcolor: '#FFFFFF',
            border: `1px solid ${brand.border}`,
            borderRadius: '22px',
            p: { xs: 2.5, sm: 4 },
            display: 'flex',
            flexDirection: 'column',
            gap: 3.25,
          }}
        >
          {serverError ? (
            <Alert severity="error" sx={{ borderRadius: '16px' }}>
              {t(serverError, { defaultValue: t('error.unknown') })}
            </Alert>
          ) : null}

          <Box
            component="section"
            aria-labelledby="listing-photos-heading"
            sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Typography
                id="listing-photos-heading"
                sx={{ fontSize: 15, fontWeight: 700 }}
              >
                {t('listing.photos')}
              </Typography>
              {photos.length > 0 ? (
                <Typography
                  sx={{ fontSize: 14, fontWeight: 600, color: 'primary.main' }}
                >
                  {t('listing.photosAdded', { count: photos.length })}
                </Typography>
              ) : null}
            </Box>
            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept="image/png,image/jpg,image/jpeg"
              multiple
              onChange={addPhotos}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: 1.25,
                height: 210,
              }}
            >
              {mosaicPhotos.map((photo, index) =>
                photoTile(photo, index === 0 ? { gridRow: 'span 2' } : {})
              )}
              {photos.length === 0
                ? addTile({ gridColumn: '1 / -1', gridRow: '1 / -1' })
                : null}
              {photos.length === 1 ? addTile({ gridRow: 'span 2' }) : null}
              {photos.length === 2 ? addTile({}) : null}
            </Box>
            {extraPhotos.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 1.25,
                }}
              >
                {extraPhotos.map((photo) =>
                  photoTile(photo, { aspectRatio: '1 / 1' })
                )}
              </Box>
            ) : null}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                {t('listing.photoHint')}
              </Typography>
              {photos.length >= mosaicSize ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={openFilePicker}
                  disabled={locked}
                  sx={{ flexShrink: 0, px: 1, py: 0.5 }}
                >
                  {t('listing.addMore')}
                </Button>
              ) : null}
            </Box>
            {photoError ? (
              <Typography
                role="alert"
                sx={{ fontSize: 14, fontWeight: 600, color: 'error.main' }}
              >
                {t(photoError)}
              </Typography>
            ) : null}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 2.25,
            }}
          >
            <ControlledTextField
              control={control}
              name="neighborhood"
              label={t('listing.neighborhood')}
              placeholder={t('listing.neighborhoodPlaceholder')}
              autoComplete="address-level3"
              disabled={locked}
            />
            <ControlledTextField
              control={control}
              name="city"
              label={t('listing.city')}
              select
              disabled={locked}
            >
              {cities.map((city) => (
                <MenuItem key={city} value={city}>
                  {city}
                </MenuItem>
              ))}
            </ControlledTextField>
            <ControlledTextField
              control={control}
              name="rent"
              label={t('listing.rent')}
              type="number"
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              disabled={locked}
            />
            <ControlledTextField
              control={control}
              name="squareMeters"
              label={t('listing.squareMeters')}
              type="number"
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              disabled={locked}
            />
            <ControlledTextField
              control={control}
              name="availableFrom"
              label={t('listing.availableFrom')}
              type="date"
              disabled={locked}
            />
            <ControlledTextField
              control={control}
              name="extraCosts"
              label={t('listing.extraCosts')}
              placeholder={t('listing.extraCostsPlaceholder')}
              disabled={locked}
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
                    {listingRooms.map((room) => {
                      const selected = field.value === room
                      return (
                        <Chip
                          key={room}
                          label={t(`listing.roomTypes.${room}`)}
                          onClick={() => field.onChange(room)}
                          disabled={locked}
                          variant={selected ? 'filled' : 'outlined'}
                          aria-pressed={selected}
                          sx={{
                            height: 44,
                            px: 1,
                            borderRadius: 999,
                            fontSize: 15,
                            fontWeight: 600,
                            border: `1.5px solid ${selected ? brand.purple : brand.borderInput}`,
                            bgcolor: selected ? brand.purple50 : '#FFFFFF',
                            color: selected ? brand.purple : brand.ink,
                            '&:hover': { bgcolor: brand.purple50 },
                          }}
                        />
                      )
                    })}
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
            sx={{
              minHeight: 58,
              fontSize: 18,
              background: 'none',
              bgcolor: published ? brand.success : brand.purple,
              boxShadow: published ? 'none' : shadows.cta,
              '&:hover': {
                background: 'none',
                bgcolor: brand.purpleHover,
                boxShadow: shadows.cta,
              },
              '&.Mui-disabled': {
                color: '#FFFFFF',
                bgcolor: published ? brand.success : brand.purple200,
              },
            }}
          >
            {published
              ? t('listing.published')
              : (progressText ?? t('listing.publish'))}
          </Button>
          {progressText ? (
            <Typography role="status" sx={visuallyHidden}>
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
          <Typography
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              lineHeight: 1.4,
              textTransform: 'uppercase',
              color: 'text.secondary',
            }}
          >
            {t('listing.preview')}
          </Typography>
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
            <Alert
              severity="success"
              icon={false}
              sx={{
                bgcolor: brand.purple50,
                border: `1.5px solid ${brand.purple200}`,
                borderRadius: '16px',
                color: brand.ink,
                p: 2.5,
              }}
            >
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
                sx={{
                  mt: 2,
                  background: 'none',
                  bgcolor: brand.purple,
                  '&:hover': { background: 'none', bgcolor: brand.purpleHover },
                }}
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

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
} as const

import { Box, Button, ButtonBase, IconButton, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  allowedPhotoTypes,
  type ListingPhoto,
} from '../../hooks/useListingPhotos'
import { brand } from '../../theme/tokens'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
} from '../icons'

// The first photos form a mosaic (one large, the rest small); any further
// photos are shown as thumbnails below it.
const mosaicSize = 3

const mosaicSx = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gridTemplateRows: '1fr 1fr',
  gap: 1.25,
  height: 210,
} as const

const thumbnailGridSx = {
  display: 'grid',
  // Wide enough for the remove and move buttons on each thumbnail.
  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  gap: 1.25,
} as const

const addTileSx = {
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
} as const

const photoSx = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: '12px',
  display: 'block',
} as const

const tileButtonSx = {
  width: 28,
  height: 28,
  bgcolor: 'rgba(255, 255, 255, 0.92)',
  color: 'text.primary',
  '&:hover': { bgcolor: 'background.paper' },
  '&.Mui-disabled': { bgcolor: 'rgba(255, 255, 255, 0.6)' },
} as const

const removeButtonSx = {
  ...tileButtonSx,
  position: 'absolute',
  top: 8,
  right: 8,
} as const

const moveButtonsSx = {
  position: 'absolute',
  left: 8,
  bottom: 8,
  display: 'flex',
  gap: 0.5,
} as const

type ListingPhotoPickerProps = {
  photos: ListingPhoto[]
  disabled: boolean
  error: string | null
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
  onMove: (key: string, offset: -1 | 1) => void
}

export const ListingPhotoPicker = ({
  photos,
  disabled,
  error,
  onAdd,
  onRemove,
  onMove,
}: ListingPhotoPickerProps) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const openPicker = () => inputRef.current?.click()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    // Reset so choosing the same file again still fires a change.
    event.target.value = ''
    if (files.length > 0) onAdd(files)
  }

  const addTile = (sx: SxProps<Theme>) => (
    <ButtonBase
      onClick={openPicker}
      disabled={disabled}
      aria-label={t('listing.addPhotos')}
      sx={[addTileSx, sx] as SxProps<Theme>}
    >
      <PlusIcon />
      {t('listing.addPhotos')}
    </ButtonBase>
  )

  const photoName = (photo: ListingPhoto, index: number) =>
    photo.kind === 'new'
      ? photo.file.name
      : t('listing.photoNumber', { number: index + 1 })

  const photoTile = (
    photo: ListingPhoto,
    index: number,
    sx: SxProps<Theme>
  ) => (
    <Box
      key={photo.key}
      sx={
        [
          { position: 'relative', minHeight: 0, minWidth: 0 },
          sx,
        ] as SxProps<Theme>
      }
    >
      <Box
        component="img"
        src={photo.previewUrl}
        alt={photoName(photo, index)}
        sx={photoSx}
      />
      {disabled ? null : (
        <>
          <IconButton
            size="small"
            aria-label={t('listing.removePhoto', {
              name: photoName(photo, index),
            })}
            onClick={() => onRemove(photo.key)}
            sx={removeButtonSx}
          >
            <CloseIcon sx={{ fontSize: 16 }} style={{ strokeWidth: 2.5 }} />
          </IconButton>
          {photos.length > 1 ? (
            <Box sx={moveButtonsSx}>
              <IconButton
                size="small"
                aria-label={t('listing.movePhotoEarlier', {
                  name: photoName(photo, index),
                })}
                disabled={index === 0}
                onClick={() => onMove(photo.key, -1)}
                sx={tileButtonSx}
              >
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={t('listing.movePhotoLater', {
                  name: photoName(photo, index),
                })}
                disabled={index === photos.length - 1}
                onClick={() => onMove(photo.key, 1)}
                sx={tileButtonSx}
              >
                <ChevronRightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          ) : null}
        </>
      )}
    </Box>
  )

  return (
    <Box
      component="section"
      aria-labelledby="listing-photos-heading"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
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
        ref={inputRef}
        hidden
        type="file"
        accept={allowedPhotoTypes.join(',')}
        multiple
        onChange={handleChange}
      />
      <Box sx={mosaicSx}>
        {photos
          .slice(0, mosaicSize)
          .map((photo, index) =>
            photoTile(photo, index, index === 0 ? { gridRow: 'span 2' } : {})
          )}
        {photos.length === 0
          ? addTile({ gridColumn: '1 / -1', gridRow: '1 / -1' })
          : null}
        {photos.length === 1 ? addTile({ gridRow: 'span 2' }) : null}
        {photos.length === 2 ? addTile({}) : null}
      </Box>
      {photos.length > mosaicSize ? (
        <Box sx={thumbnailGridSx}>
          {photos
            .slice(mosaicSize)
            .map((photo, index) =>
              photoTile(photo, mosaicSize + index, { aspectRatio: '1 / 1' })
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
            onClick={openPicker}
            disabled={disabled}
            sx={{ flexShrink: 0, px: 1, py: 0.5 }}
          >
            {t('listing.addMore')}
          </Button>
        ) : null}
      </Box>
      {error ? (
        <Typography
          role="alert"
          sx={{ fontSize: 14, fontWeight: 600, color: 'error.main' }}
        >
          {t(error)}
        </Typography>
      ) : null}
    </Box>
  )
}

import { Box, Button, ButtonBase, IconButton, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  allowedPhotoTypes,
  type PendingPhoto,
} from '../../hooks/usePublishListing'
import { brand } from '../../theme/tokens'
import { CloseIcon, PlusIcon } from '../icons'

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
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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

const removeButtonSx = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 28,
  height: 28,
  bgcolor: 'rgba(255, 255, 255, 0.92)',
  color: 'text.primary',
  '&:hover': { bgcolor: 'background.paper' },
} as const

type ListingPhotoPickerProps = {
  photos: PendingPhoto[]
  disabled: boolean
  error: string | null
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
}

export const ListingPhotoPicker = ({
  photos,
  disabled,
  error,
  onAdd,
  onRemove,
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

  const photoTile = (photo: PendingPhoto, sx: SxProps<Theme>) => (
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
        alt={photo.file.name}
        sx={photoSx}
      />
      {disabled ? null : (
        <IconButton
          size="small"
          aria-label={t('listing.removePhoto', { name: photo.file.name })}
          onClick={() => onRemove(photo.key)}
          sx={removeButtonSx}
        >
          <CloseIcon sx={{ fontSize: 16 }} style={{ strokeWidth: 2.5 }} />
        </IconButton>
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
            photoTile(photo, index === 0 ? { gridRow: 'span 2' } : {})
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
            .map((photo) => photoTile(photo, { aspectRatio: '1 / 1' }))}
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

import { Box, Chip, Typography } from '@mui/material'
import { Controller, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { ListingFormInput, ListingFormValues } from '../../schemas/listing'
import { rooms } from '../../types/listing'
import { ControlledTextField } from '../form/ControlledTextField'
import { fieldGridSx, roomChipSx } from './listingStyles'

type ListingFieldsProps = {
  control: Control<ListingFormInput, unknown, ListingFormValues>
  disabled: boolean
}

// The listing detail fields shared by the create and edit views.
export const ListingFields = ({ control, disabled }: ListingFieldsProps) => {
  const { t } = useTranslation()

  return (
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
              {rooms.map((room) => (
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
  )
}

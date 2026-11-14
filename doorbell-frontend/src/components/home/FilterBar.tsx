import { Box, ListSubheader, MenuItem, Select, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeedFilters, ListingFilterOptions } from '../../types/listing'

const minSizes = [30, 40, 50]
const locationValue = (city: string, neighborhood = '') =>
  city ? JSON.stringify([city, neighborhood]) : ''

interface FilterBarProps {
  filters: FeedFilters
  options: ListingFilterOptions | null
  onChange: (filters: FeedFilters) => void
}

interface FilterFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  disabled?: boolean
}

const FilterField = ({
  id,
  label,
  value,
  onChange,
  children,
  disabled,
}: FilterFieldProps) => {
  const labelId = `${id}-label`

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: 0,
      }}
    >
      <Typography
        id={labelId}
        component="span"
        sx={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Select
        id={id}
        labelId={labelId}
        value={value}
        displayEmpty
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        sx={{
          height: 56,
          fontSize: 19,
          bgcolor: 'background.paper',
          borderRadius: '12px',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.100' },
          '& .MuiSelect-icon': { color: 'primary.main' },
        }}
      >
        {children}
      </Select>
    </Box>
  )
}

export const FilterBar = ({ filters, options, onChange }: FilterBarProps) => {
  const { t, i18n } = useTranslation()
  const locations = (options?.locations ?? []).flatMap(
    ({ city, neighborhoods }) => [
      { city, neighborhood: '' },
      ...neighborhoods.map((neighborhood) => ({ city, neighborhood })),
    ]
  )
  const prices = [...(options?.maxPrices ?? [])].sort(
    (a, b) => Number(a) - Number(b)
  )

  return (
    <Box
      sx={{
        mt: 6,
        width: 960,
        textAlign: 'left',
        maxWidth: '100%',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'minmax(0, 1.5fr) repeat(2, minmax(0, 1fr))',
        },
        gap: 2.5,
        p: '20px 24px 24px',
        bgcolor: 'homeSurface',
        border: '1px solid',
        borderColor: 'homeSurfaceBorder',
        borderRadius: '24px',
      }}
    >
      <FilterField
        id="home-filter-location"
        label={t('home.filters.location')}
        value={locationValue(filters.city, filters.neighborhood)}
        disabled={options === null}
        onChange={(value) => {
          const location = locations.find(
            ({ city, neighborhood }) =>
              locationValue(city, neighborhood) === value
          )
          onChange({
            ...filters,
            city: location?.city ?? '',
            neighborhood: location?.neighborhood ?? '',
          })
        }}
      >
        <MenuItem value="">{t('home.filters.anyLocation')}</MenuItem>
        {(options?.locations ?? []).flatMap(({ city, neighborhoods }) => [
          <ListSubheader key={`heading:${city}`}>{city}</ListSubheader>,
          <MenuItem key={locationValue(city)} value={locationValue(city)}>
            {t('home.filters.wholeCity', { city })}
          </MenuItem>,
          ...neighborhoods.map((neighborhood) => (
            <MenuItem
              key={locationValue(city, neighborhood)}
              value={locationValue(city, neighborhood)}
            >
              {t('home.filters.neighborhoodInCity', { city, neighborhood })}
            </MenuItem>
          )),
        ])}
      </FilterField>

      <FilterField
        id="home-filter-max-price"
        label={t('home.filters.maxPrice')}
        value={filters.maxPrice ? String(filters.maxPrice) : ''}
        disabled={options === null}
        onChange={(maxPrice) =>
          onChange({ ...filters, maxPrice: Number(maxPrice) })
        }
      >
        <MenuItem value="">{t('home.filters.noLimit')}</MenuItem>
        {prices.map((price) => (
          <MenuItem key={price} value={String(Number(price))}>
            {new Intl.NumberFormat(i18n.language, {
              style: 'currency',
              currency: 'EUR',
              minimumFractionDigits: Number.isInteger(Number(price)) ? 0 : 2,
              maximumFractionDigits: 2,
            }).format(Number(price))}
          </MenuItem>
        ))}
      </FilterField>

      <FilterField
        id="home-filter-size"
        label={t('home.filters.size')}
        value={filters.minSize ? String(filters.minSize) : ''}
        onChange={(minSize) =>
          onChange({ ...filters, minSize: Number(minSize) })
        }
      >
        <MenuItem value="">{t('home.filters.anySize')}</MenuItem>
        {minSizes.map((size) => (
          <MenuItem key={size} value={String(size)}>
            {t('home.filters.minSize', { size })}
          </MenuItem>
        ))}
      </FilterField>
    </Box>
  )
}

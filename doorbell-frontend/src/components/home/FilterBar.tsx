import { Box, MenuItem, Select, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeedFilters, ListingFilterOptions } from '../../types/listing'

const minSizes = [30, 40, 50]
// Fixed budget steps keep the dropdown useful regardless of distinct rents.
const maxPrices = [500, 1000, 1500, 2000, 2500, 3000]

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
  const locations = options?.locations ?? []
  const neighborhoods =
    locations.find(({ city }) => city === filters.city)?.neighborhoods ?? []

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
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'minmax(0, 1fr) minmax(0, 1.4fr) repeat(2, minmax(0, 0.8fr))',
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
        id="home-filter-city"
        label={t('home.filters.city')}
        value={filters.city}
        disabled={options === null}
        onChange={(city) => onChange({ ...filters, city, neighborhood: '' })}
      >
        <MenuItem value="">{t('home.filters.anyCity')}</MenuItem>
        {locations.map(({ city }) => (
          <MenuItem key={city} value={city}>
            {city}
          </MenuItem>
        ))}
      </FilterField>

      <FilterField
        id="home-filter-neighborhood"
        label={t('home.filters.neighborhood')}
        value={filters.neighborhood}
        disabled={neighborhoods.length === 0}
        onChange={(neighborhood) => onChange({ ...filters, neighborhood })}
      >
        <MenuItem value="">{t('home.filters.allNeighborhoods')}</MenuItem>
        {neighborhoods.map((neighborhood) => (
          <MenuItem key={neighborhood} value={neighborhood}>
            {neighborhood}
          </MenuItem>
        ))}
      </FilterField>

      <FilterField
        id="home-filter-max-price"
        label={t('home.filters.maxPrice')}
        value={filters.maxPrice ? String(filters.maxPrice) : ''}
        onChange={(maxPrice) =>
          onChange({ ...filters, maxPrice: Number(maxPrice) })
        }
      >
        <MenuItem value="">{t('home.filters.noLimit')}</MenuItem>
        {maxPrices.map((price) => (
          <MenuItem key={price} value={String(price)}>
            {new Intl.NumberFormat(i18n.language, {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            }).format(price)}
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

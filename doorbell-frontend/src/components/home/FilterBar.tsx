import { Box, MenuItem, Select, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FeedFilters } from '../../types/listing'
import { formatNumber } from '../../utils/format'

const cities = ['Helsinki', 'Espoo', 'Tampere', 'Turku']
const maxPrices = [1000, 1250, 1500, 2000, 3000, 5000]
const minSizes = [30, 40, 50]

interface FilterBarProps {
  filters: FeedFilters
  neighborhoods: string[]
  onChange: (filters: FeedFilters) => void
}

interface FilterFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

function FilterField({
  id,
  label,
  value,
  onChange,
  children,
}: FilterFieldProps) {
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

export function FilterBar({
  filters,
  neighborhoods,
  onChange,
}: FilterBarProps) {
  const { t, i18n } = useTranslation()

  return (
    <Box
      sx={{
        mt: 6,
        width: 960,
        textAlign: 'left',
        maxWidth: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
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
        onChange={(city) => onChange({ ...filters, city, neighborhood: '' })}
      >
        <MenuItem value="">{t('home.filters.anyCity')}</MenuItem>
        {cities.map((city) => (
          <MenuItem key={city} value={city}>
            {city}
          </MenuItem>
        ))}
      </FilterField>

      <FilterField
        id="home-filter-neighborhood"
        label={t('home.filters.neighborhood')}
        value={filters.neighborhood}
        onChange={(neighborhood) => onChange({ ...filters, neighborhood })}
      >
        <MenuItem value="">{t('home.filters.allAreas')}</MenuItem>
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
        {maxPrices.map((price) => (
          <MenuItem key={price} value={String(price)}>
            {t('home.filters.price', {
              price: formatNumber(price, i18n.language),
            })}
          </MenuItem>
        ))}
        <MenuItem value="">{t('home.filters.noLimit')}</MenuItem>
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

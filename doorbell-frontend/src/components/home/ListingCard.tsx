import { Box, Button, ButtonBase, Divider, Typography } from '@mui/material'
import { useState, type MouseEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { HomeListing } from '../../types/listing'
import { formatDayMonth, formatNumber } from './format'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

interface ListingCardProps {
  listing: HomeListing
  today: string
  likeOpacity: number
  dislikeOpacity: number
}

// Carousel controls must never start a swipe on the surrounding card.
const stopPointer = (event: PointerEvent) => event.stopPropagation()
const controlClick = (action: () => void) => (event: MouseEvent) => {
  event.stopPropagation()
  action()
}

const arrowSx = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 44,
  borderRadius: '50%',
  bgcolor: 'rgba(255, 255, 255, 0.92)',
  color: 'text.primary',
  boxShadow: '0 4px 12px rgba(26, 26, 46, 0.18)',
  '&:hover': { bgcolor: 'common.white' },
} as const

const stampSx = {
  position: 'absolute',
  top: 72,
  px: 2,
  py: 0.5,
  fontSize: 40,
  fontWeight: 800,
  letterSpacing: '0.06em',
  lineHeight: 1.2,
  border: '4px solid',
  borderRadius: '12px',
  bgcolor: 'rgba(255, 255, 255, 0.85)',
  pointerEvents: 'none',
} as const

export function ListingCard({
  listing,
  today,
  likeOpacity,
  dislikeOpacity,
}: ListingCardProps) {
  const { t, i18n } = useTranslation()
  const [imageIndex, setImageIndex] = useState(0)
  const imageCount = listing.images.length
  const showImage = (index: number) =>
    setImageIndex((index + imageCount) % imageCount)

  return (
    <Box
      component="article"
      sx={{
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: 'primary.main',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 16px 40px rgba(110, 68, 255, 0.12)',
      }}
    >
      <Box
        sx={{ position: 'relative', height: 420, bgcolor: 'photoPlaceholder' }}
      >
        {listing.images.map((image, index) => (
          <Box
            key={image.id}
            component="img"
            src={image.url}
            alt={t('home.card.photoAlt', {
              number: index + 1,
              count: imageCount,
            })}
            draggable={false}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: index === imageIndex ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          />
        ))}

        {listing.createdAt === today ? (
          <Typography
            component="span"
            sx={{
              position: 'absolute',
              top: 18,
              left: 18,
              px: '13px',
              py: '8px',
              borderRadius: '8px',
              bgcolor: 'primary.main',
              color: 'common.white',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              pointerEvents: 'none',
            }}
          >
            {t('home.card.newToday')}
          </Typography>
        ) : null}

        {imageCount > 0 ? (
          <Typography
            component="span"
            sx={{
              position: 'absolute',
              top: 18,
              right: 18,
              px: '12px',
              py: '6px',
              borderRadius: '999px',
              bgcolor: 'rgba(26, 26, 46, 0.55)',
              color: 'common.white',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              pointerEvents: 'none',
            }}
          >
            {t('home.card.photoCounter', {
              number: imageIndex + 1,
              count: imageCount,
            })}
          </Typography>
        ) : null}

        <Typography
          component="span"
          aria-hidden="true"
          sx={{
            ...stampSx,
            left: 28,
            color: 'primary.main',
            borderColor: 'primary.main',
            transform: 'rotate(-12deg)',
          }}
          style={{ opacity: likeOpacity }}
        >
          {t('home.deck.likeStamp')}
        </Typography>
        <Typography
          component="span"
          aria-hidden="true"
          sx={{
            ...stampSx,
            right: 28,
            color: 'error.main',
            borderColor: 'error.main',
            transform: 'rotate(12deg)',
          }}
          style={{ opacity: dislikeOpacity }}
        >
          {t('home.deck.dislikeStamp')}
        </Typography>

        {imageCount > 1 ? (
          <>
            <ButtonBase
              aria-label={t('home.card.previousPhoto')}
              onPointerDown={stopPointer}
              onClick={controlClick(() => showImage(imageIndex - 1))}
              sx={{ ...arrowSx, left: 14 }}
            >
              <ChevronLeftIcon />
            </ButtonBase>
            <ButtonBase
              aria-label={t('home.card.nextPhoto')}
              onPointerDown={stopPointer}
              onClick={controlClick(() => showImage(imageIndex + 1))}
              sx={{ ...arrowSx, right: 14 }}
            >
              <ChevronRightIcon />
            </ButtonBase>

            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                px: '10px',
                py: '7px',
                borderRadius: '999px',
                bgcolor: 'rgba(26, 26, 46, 0.45)',
              }}
            >
              {listing.images.map((image, index) => (
                <ButtonBase
                  key={image.id}
                  aria-label={t('home.card.showPhoto', { number: index + 1 })}
                  aria-current={index === imageIndex}
                  onPointerDown={stopPointer}
                  onClick={controlClick(() => showImage(index))}
                  sx={{
                    width: index === imageIndex ? 18 : 7,
                    height: 7,
                    borderRadius: '999px',
                    bgcolor:
                      index === imageIndex
                        ? 'common.white'
                        : 'rgba(255, 255, 255, 0.5)',
                    transition: 'width 200ms ease',
                  }}
                />
              ))}
            </Box>
          </>
        ) : null}
      </Box>

      <Box
        sx={{
          px: 4,
          py: '30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Typography
              component="span"
              sx={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {t('home.card.price', {
                price: formatNumber(listing.monthlyPrice, i18n.language),
              })}
            </Typography>
            <Typography
              component="span"
              sx={{ fontSize: 20, fontWeight: 600, color: 'primary.main' }}
            >
              {listing.availableFrom <= today
                ? t('home.card.availableNow')
                : t('home.card.availableFrom', {
                    date: formatDayMonth(listing.availableFrom, i18n.language),
                  })}
            </Typography>
          </Box>
          <Typography
            component="span"
            sx={{ fontSize: 15, fontWeight: 500, color: 'text.secondary' }}
          >
            {listing.extraCosts.trim() || t('home.card.noExtraCosts')}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'grey.100' }} />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography
              component="h3"
              sx={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              {t('home.card.location', {
                neighborhood: listing.neighborhood,
                city: listing.city,
              })}
            </Typography>
            <Typography
              component="span"
              sx={{ fontSize: 18, color: 'text.secondary' }}
            >
              {t('home.card.specs', {
                rooms: t(`home.rooms.${listing.rooms}`),
                size: formatNumber(listing.squareMeters, i18n.language),
              })}
            </Typography>
          </Box>
          {/* TODO: details page */}
          <Button
            component={Link}
            to={`/listings/${listing.id}`}
            draggable={false}
            sx={{
              flexShrink: 0,
              minWidth: 0,
              p: '6px 0',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: 0,
              '&:hover': { bgcolor: 'transparent', color: 'primary.dark' },
            }}
          >
            {t('home.card.viewDetails')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

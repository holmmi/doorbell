import { Box, IconButton } from '@mui/material'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { HomeListing } from '../../types/listing'
import { CheckIcon, XIcon } from './icons'
import { ListingCard } from './ListingCard'

interface SwipeDeckProps {
  listings: HomeListing[]
  today: string
  canSwipe: boolean
  onDecide: (listing: HomeListing, liked: boolean) => void
}

type Direction = -1 | 1

const VISIBLE_CARDS = 3
const DRAG_THRESHOLD = 6
const SWIPE_DISTANCE = 130
const STAMP_DISTANCE = 120
const FLY_OUT_MS = 380
const EASING = 'cubic-bezier(.2,.7,.3,1)'

const clamp = (value: number) => Math.min(Math.max(value, 0), 1)

const actionButtonSx = (color: string, glow: string) => ({
  width: 76,
  height: 76,
  bgcolor: color,
  color: 'common.white',
  boxShadow: `0 14px 30px ${glow}`,
  transition: 'transform 200ms cubic-bezier(.3,1.6,.5,1)',
  '&:hover': { bgcolor: color, transform: 'scale(1.08)' },
  '&:active': { transform: 'scale(.94)' },
})

export function SwipeDeck({
  listings,
  today,
  canSwipe,
  onDecide,
}: SwipeDeckProps) {
  const { t } = useTranslation()
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [exit, setExit] = useState<Direction | null>(null)
  const pointerStartXRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const exitTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const timer = exitTimerRef
    return () => window.clearTimeout(timer.current)
  }, [])

  const top = listings.at(0)

  // Animate the top card away, then hand the decision to the parent. The
  // parent either removes the card or keeps it, in which case it springs back.
  const flyOut = (direction: Direction) => {
    if (!top || exit !== null) return
    setDragging(false)
    setExit(direction)
    exitTimerRef.current = window.setTimeout(() => {
      onDecide(top, direction === 1)
      setExit(null)
      setDx(0)
    }, FLY_OUT_MS)
  }

  const handlePointerDownCapture = () => {
    suppressClickRef.current = false
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canSwipe || exit !== null || !event.isPrimary || event.button !== 0) {
      return
    }
    pointerStartXRef.current = event.clientX
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStartXRef.current === null) return
    const offset = event.clientX - pointerStartXRef.current
    // Capture only after a real drag so clicks on inner buttons still work.
    if (!dragging) {
      if (Math.abs(offset) < DRAG_THRESHOLD) return
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging(true)
    }
    setDx(offset)
  }

  const handlePointerEnd = () => {
    pointerStartXRef.current = null
    if (!dragging) return
    setDragging(false)
    suppressClickRef.current = true
    if (Math.abs(dx) > SWIPE_DISTANCE) {
      flyOut(dx > 0 ? 1 : -1)
    } else {
      setDx(0)
    }
  }

  // A drag ends with a click on the card; swallow it so nothing activates.
  const handleClickCapture = (event: MouseEvent) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  const progress = exit === null ? clamp(Math.abs(dx) / SWIPE_DISTANCE) : 1

  const cardStyle = (index: number): CSSProperties => {
    if (index === 0) {
      return {
        transform:
          exit === null
            ? `translateX(${dx}px) rotate(${dx / 20}deg)`
            : `translateX(${exit * 140}%) rotate(${exit * 24}deg)`,
        opacity: exit === null ? 1 : 0,
        transition: dragging
          ? 'none'
          : exit === null
            ? `transform 300ms ${EASING}, opacity 300ms ${EASING}`
            : `transform ${FLY_OUT_MS}ms ${EASING}, opacity ${FLY_OUT_MS}ms ${EASING}`,
        cursor: canSwipe ? (dragging ? 'grabbing' : 'grab') : 'default',
        zIndex: VISIBLE_CARDS,
      }
    }
    const transition = dragging ? 'none' : `transform 350ms ${EASING}`
    if (index === 1) {
      return {
        transform: `scale(${0.95 + 0.05 * progress}) translateY(${14 * (1 - progress)}px)`,
        transition,
        zIndex: VISIBLE_CARDS - 1,
      }
    }
    return {
      transform: 'scale(0.9) translateY(28px)',
      transition,
      zIndex: VISIBLE_CARDS - 2,
    }
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'grid' }}>
        {listings.slice(0, VISIBLE_CARDS).map((listing, index) => {
          const isTop = index === 0
          return (
            <Box
              key={listing.id}
              inert={!isTop}
              onPointerDownCapture={
                isTop ? handlePointerDownCapture : undefined
              }
              onPointerDown={isTop ? handlePointerDown : undefined}
              onPointerMove={isTop ? handlePointerMove : undefined}
              onPointerUp={isTop ? handlePointerEnd : undefined}
              onPointerCancel={isTop ? handlePointerEnd : undefined}
              onClickCapture={isTop ? handleClickCapture : undefined}
              sx={{
                gridArea: '1 / 1',
                touchAction: 'pan-y',
                userSelect: 'none',
                pointerEvents: isTop ? 'auto' : 'none',
              }}
              style={cardStyle(index)}
            >
              <ListingCard
                listing={listing}
                today={today}
                likeOpacity={
                  isTop ? (exit === 1 ? 1 : clamp(dx / STAMP_DISTANCE)) : 0
                }
                dislikeOpacity={
                  isTop ? (exit === -1 ? 1 : clamp(-dx / STAMP_DISTANCE)) : 0
                }
              />
            </Box>
          )
        })}
      </Box>

      {canSwipe ? (
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 5 }}>
          <IconButton
            aria-label={t('home.deck.dislike')}
            onClick={() => flyOut(-1)}
            sx={actionButtonSx('error.main', 'rgba(239, 122, 133, 0.4)')}
          >
            <XIcon sx={{ fontSize: 32 }} />
          </IconButton>
          <IconButton
            aria-label={t('home.deck.like')}
            onClick={() => flyOut(1)}
            sx={actionButtonSx('primary.main', 'rgba(110, 68, 255, 0.4)')}
          >
            <CheckIcon sx={{ fontSize: 32 }} />
          </IconButton>
        </Box>
      ) : null}
    </Box>
  )
}

import { brand, shadows } from '../../theme/tokens'

// Styles shared by the create and edit listing views.

export const pageSx = {
  width: '100%',
  maxWidth: 1200,
  mx: 'auto',
  px: { xs: 0, sm: 4 },
  pt: 6,
  pb: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 4.5,
  // Doorbell input style from the UI kit, scoped to the listing views.
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: 'background.paper',
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
} as const

export const backLinkSx = {
  alignSelf: 'flex-start',
  px: 0,
  py: 0,
  minHeight: 0,
  fontSize: 17,
  fontWeight: 600,
  '&:hover': { bgcolor: 'transparent' },
} as const

export const titleSx = {
  fontSize: { xs: 40, md: 52 },
  fontWeight: 800,
  lineHeight: 1.05,
  letterSpacing: '-0.025em',
} as const

export const subtitleSx = {
  fontSize: '1.1875rem',
  lineHeight: 1.5,
  color: 'text.secondary',
} as const

export const columnsSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
  gap: 5,
  alignItems: 'start',
} as const

export const formCardSx = {
  bgcolor: 'background.paper',
  border: `1px solid ${brand.border}`,
  borderRadius: '22px',
  p: { xs: 2.5, sm: 4 },
  display: 'flex',
  flexDirection: 'column',
  gap: 3.25,
} as const

export const asideSx = {
  position: { md: 'sticky' },
  top: 110,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.75,
} as const

export const fieldGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    sm: 'repeat(2, minmax(0, 1fr))',
  },
  gap: 2.25,
} as const

export const roomChipSx = (selected: boolean) => ({
  height: 44,
  px: 1,
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 600,
  border: `1.5px solid ${selected ? brand.purple : brand.borderInput}`,
  bgcolor: selected ? brand.purple50 : 'background.paper',
  color: selected ? brand.purple : 'text.primary',
  '&:hover': { bgcolor: brand.purple50 },
})

// The theme's contained button is a gradient; the UI kit uses solid purple.
export const solidButtonSx = {
  background: 'none',
  bgcolor: brand.purple,
  '&:hover': { background: 'none', bgcolor: brand.purpleHover },
} as const

export const submitButtonSx = (done: boolean) => ({
  ...solidButtonSx,
  minHeight: 58,
  fontSize: 18,
  bgcolor: done ? brand.success : brand.purple,
  boxShadow: done ? 'none' : shadows.cta,
  '&.Mui-disabled': {
    color: 'common.white',
    bgcolor: done ? brand.success : brand.purple200,
  },
})

export const previewLabelSx = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  lineHeight: 1.4,
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const

// Announces progress to screen readers without showing it twice.
export const visuallyHiddenSx = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
} as const

export const noticeSx = {
  bgcolor: brand.purple50,
  border: `1.5px solid ${brand.purple200}`,
  borderRadius: '16px',
  color: 'text.primary',
  p: 2.5,
} as const

export const statusSx = (published: boolean) => ({
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  px: 1.5,
  py: 0.75,
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 700,
  bgcolor: published ? brand.purple50 : 'background.paper',
  color: published ? brand.purple : 'text.secondary',
  border: `1.5px solid ${published ? brand.purple200 : brand.borderInput}`,
  '&::before': {
    content: '""',
    width: 8,
    height: 8,
    borderRadius: '50%',
    bgcolor: published ? brand.success : brand.borderInput,
  },
})

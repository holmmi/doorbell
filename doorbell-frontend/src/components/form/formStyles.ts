import { brand, shadows } from '../../theme/tokens'

// Doorbell input style from the UI kit. Spread into a page or form container
// to apply it to every outlined input inside.
export const doorbellInputsSx = {
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

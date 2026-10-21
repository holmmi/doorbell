import { createTheme } from '@mui/material/styles'

declare module '@mui/material/styles' {
  interface Palette {
    authPanelShadow: string
    selectedRoleBackground: string
    homeSurface: string
    homeSurfaceBorder: string
    photoPlaceholder: string
    emptyDeckBorder: string
  }

  interface PaletteOptions {
    authPanelShadow?: string
    selectedRoleBackground?: string
    homeSurface?: string
    homeSurfaceBorder?: string
    photoPlaceholder?: string
    emptyDeckBorder?: string
  }
}

const palette = {
  primary: {
    main: '#6E44FF',
    light: '#B892FF',
  },
  secondary: {
    main: '#FF90B3',
    light: '#FFC2E2',
  },
  error: {
    main: '#EF7A85',
  },
  background: {
    default: '#FFF9FC',
    paper: '#FFFFFF',
  },
  grey: {
    50: '#F5F5F5',
    100: '#EAEAEA',
    200: '#D9D9D9',
    300: '#C7C7C7',
    400: '#9E9E9E',
    500: '#7A7A7A',
    600: '#666666',
  },
  text: {
    primary: '#1F1A2D',
    secondary: '#605A75',
    tertiary: '#FFFFFF',
  },
  authPanelShadow: 'rgba(26, 26, 46, 0.06)',
  selectedRoleBackground: 'rgba(110, 68, 255, 0.08)',
  homeSurface: '#FBFAFF',
  homeSurfaceBorder: '#EEEDF5',
  photoPlaceholder: '#EAEAFF',
  emptyDeckBorder: '#D9CFFF',
}

export const theme = createTheme({
  palette,
  typography: {
    fontFamily: '"Gabarito", "Geist", "Segoe UI", sans-serif',
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.04em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    button: {
      fontWeight: 700,
      letterSpacing: '0.02em',
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 18,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          boxShadow: 'none',
          padding: '0.8rem 1.4rem',
          fontWeight: 700,
          textTransform: 'none',
        },
        contained: {
          background: 'linear-gradient(135deg, #6E44FF 0%, #B892FF 100%)',
          color: '#FFFFFF',
          '&:hover': {
            background: 'linear-gradient(135deg, #6137ff 0%, #a980ff 100%)',
          },
        },
        outlined: {
          borderColor: 'rgba(110, 68, 255, 0.32)',
          color: '#6E44FF',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: '1px solid rgba(110, 68, 255, 0.12)',
          boxShadow: '0 18px 40px rgba(110, 68, 255, 0.08)',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
})

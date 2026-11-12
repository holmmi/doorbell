import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import type { FormEventHandler, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import {
  asideSx,
  backLinkSx,
  columnsSx,
  formCardSx,
  pageSx,
  previewLabelSx,
  submitButtonSx,
  subtitleSx,
  titleSx,
  visuallyHiddenSx,
} from './listingStyles'

type ListingEditorLayoutProps = {
  title: string
  subtitle: string
  onSubmit: FormEventHandler<HTMLFormElement>
  serverError: string | null
  // Form contents above the submit button: photos, fields, warnings.
  children: ReactNode
  submitLabel: string
  // Shown on the button and announced to screen readers while working.
  progressText: string | null
  // Turns the button green, e.g. once the listing is published.
  done?: boolean
  submitDisabled: boolean
  preview: ReactNode
  // Shown below the preview: status, success messages.
  aside?: ReactNode
}

// Page frame shared by the create and edit listing views: header, the form
// card on the left and the live preview on the right.
export const ListingEditorLayout = ({
  title,
  subtitle,
  onSubmit,
  serverError,
  children,
  submitLabel,
  progressText,
  done = false,
  submitDisabled,
  preview,
  aside,
}: ListingEditorLayoutProps) => {
  const { t } = useTranslation()

  return (
    <Box sx={pageSx}>
      <Button component={RouterLink} to="/" variant="text" sx={backLinkSx}>
        {t('listing.back')}
      </Button>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Typography variant="h1" sx={titleSx}>
          {title}
        </Typography>
        <Typography sx={subtitleSx}>{subtitle}</Typography>
      </Box>

      <Box sx={columnsSx}>
        <Box component="form" noValidate onSubmit={onSubmit} sx={formCardSx}>
          {serverError ? (
            <Alert severity="error" sx={{ borderRadius: '16px' }}>
              {t(serverError, { defaultValue: t('error.unknown') })}
            </Alert>
          ) : null}

          {children}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitDisabled}
            startIcon={
              progressText ? (
                <CircularProgress size={18} color="inherit" />
              ) : null
            }
            sx={submitButtonSx(done)}
          >
            {progressText ?? submitLabel}
          </Button>
          {progressText ? (
            <Typography role="status" sx={visuallyHiddenSx}>
              {progressText}
            </Typography>
          ) : null}
        </Box>

        <Box sx={asideSx}>
          <Typography sx={previewLabelSx}>{t('listing.preview')}</Typography>
          {preview}
          {aside}
        </Box>
      </Box>
    </Box>
  )
}

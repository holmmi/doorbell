import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'
import { PageLoader } from '../components/PageLoader'
import { ControlledTextField } from '../components/form/ControlledTextField'
import { doorbellInputsSx } from '../components/form/formStyles'
import { ProfilePicture } from '../components/profile/ProfilePicture'
import { useAuth } from '../hooks/useAuth'
import {
  profileChanges,
  profileFormSchema,
  profileToFormValues,
  type ProfileFormValues,
} from '../schemas/profile'
import { brand } from '../theme/tokens'
import type { UserInfo } from '../types/user'

const pageSx = {
  width: '100%',
  maxWidth: 800,
  mx: 'auto',
  px: { xs: 0, sm: 4 },
  pt: { xs: 4, md: 7 },
  pb: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  ...doorbellInputsSx,
} as const

const titleSx = {
  fontSize: { xs: 40, md: 52 },
  fontWeight: 800,
  lineHeight: 1.05,
  letterSpacing: '-0.025em',
} as const

const subtitleSx = {
  fontSize: '1.1875rem',
  lineHeight: 1.5,
  color: 'text.secondary',
} as const

const cardSx = {
  bgcolor: 'background.paper',
  border: `1px solid ${brand.border}`,
  borderRadius: '22px',
  p: { xs: 2.5, sm: 4 },
  display: 'flex',
  flexDirection: 'column',
  gap: 3.75,
} as const

const sectionLabelSx = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const

const fieldGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    sm: 'repeat(2, minmax(0, 1fr))',
  },
  gap: 2.25,
} as const

const roleTagSx = {
  alignSelf: 'flex-start',
  px: 1.5,
  py: 0.75,
  borderRadius: '8px',
  bgcolor: brand.purple50,
  color: brand.purple,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
} as const

const detailSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  m: 0,
  '& dt': { fontSize: 15, fontWeight: 700 },
  '& dd': {
    m: 0,
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
    px: 1.75,
    borderRadius: '12px',
    bgcolor: brand.purple50,
    color: 'text.secondary',
    overflowWrap: 'anywhere',
  },
} as const

const footerSx = {
  display: 'flex',
  gap: 1.5,
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  pt: 2.5,
  borderTop: `1px solid ${brand.border}`,
} as const

// On phones the note takes its own line above the buttons.
const footerNoteSx = {
  flex: { xs: '1 1 100%', sm: '1 1 0' },
  fontSize: 15,
  color: 'text.secondary',
} as const

type Feedback = { severity: 'success' | 'error'; message: string }

type ProfileFormProps = {
  initialUser: UserInfo
}

const ProfileForm = ({ initialUser }: ProfileFormProps) => {
  const { t } = useTranslation()
  const { updateProfile } = useAuth()
  // The last loaded or saved account: the baseline for changes and Cancel.
  const [saved, setSaved] = useState(initialUser)
  const [removePicture, setRemovePicture] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileToFormValues(initialUser),
  })
  const draft = { ...profileToFormValues(saved), ...useWatch({ control }) }

  const hasChanges =
    Object.keys(profileChanges(saved, draft, removePicture)).length > 0
  const edited = isDirty || removePicture

  const onSubmit = handleSubmit(async (values) => {
    const update = profileChanges(saved, values, removePicture)
    if (Object.keys(update).length === 0) return

    setSaving(true)
    setFeedback(null)
    try {
      const updated = await updateProfile(update)
      setSaved(updated)
      reset(profileToFormValues(updated))
      setRemovePicture(false)
      setFeedback({ severity: 'success', message: 'profile.saved' })
    } catch (error) {
      // Keep the draft so the user can fix it or try again.
      setFeedback({
        severity: 'error',
        message: error instanceof ApiError ? error.code : 'error.network',
      })
    } finally {
      setSaving(false)
    }
  })

  const cancel = () => {
    reset(profileToFormValues(saved))
    setRemovePicture(false)
    setFeedback(null)
  }

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      onChange={() => {
        if (feedback?.severity === 'success') setFeedback(null)
      }}
      sx={cardSx}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          flexWrap: 'wrap',
        }}
      >
        <ProfilePicture
          picturePath={removePicture ? null : saved.picturePath}
          firstName={draft.firstName}
          lastName={draft.lastName}
        />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Typography
            component="p"
            sx={{ fontSize: 28, fontWeight: 800, overflowWrap: 'anywhere' }}
          >
            {`${draft.firstName} ${draft.lastName}`.trim()}
          </Typography>
          <Box component="span" sx={roleTagSx}>
            {t(`auth.${saved.role.toLowerCase()}`)}
          </Box>
          {saved.picturePath ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
              }}
            >
              {removePicture ? (
                <>
                  <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                    {t('profile.pictureWillBeRemoved')}
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setRemovePicture(false)}
                    disabled={saving}
                  >
                    {t('profile.keepPicture')}
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setRemovePicture(true)
                    setFeedback(null)
                  }}
                  disabled={saving}
                >
                  {t('profile.removePicture')}
                </Button>
              )}
            </Box>
          ) : null}
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="profile-about"
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}
      >
        <Typography id="profile-about" component="h2" sx={sectionLabelSx}>
          {t('profile.about')}
        </Typography>
        <Box sx={fieldGridSx}>
          <ControlledTextField
            control={control}
            name="firstName"
            label={t('auth.firstName')}
            autoComplete="given-name"
            required
            disabled={saving}
          />
          <ControlledTextField
            control={control}
            name="lastName"
            label={t('auth.lastName')}
            autoComplete="family-name"
            required
            disabled={saving}
          />
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="profile-contact"
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}
      >
        <Typography id="profile-contact" component="h2" sx={sectionLabelSx}>
          {t('profile.contact')}
        </Typography>
        <Box sx={fieldGridSx}>
          <Box component="dl" sx={detailSx}>
            <dt>{t('auth.email')}</dt>
            <dd>{saved.email}</dd>
          </Box>
          <ControlledTextField
            control={control}
            name="phone"
            label={t('profile.phone')}
            placeholder={t('profile.phonePlaceholder')}
            type="tel"
            autoComplete="tel"
            disabled={saving}
          />
        </Box>
      </Box>

      {feedback ? (
        <Alert
          severity={feedback.severity}
          role={feedback.severity === 'success' ? 'status' : 'alert'}
          sx={{ borderRadius: '16px' }}
        >
          {t(feedback.message, { defaultValue: t('error.unknown') })}
        </Alert>
      ) : null}

      <Box sx={footerSx}>
        <Typography sx={footerNoteSx}>{t('profile.note')}</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="large"
            onClick={cancel}
            disabled={saving || !edited}
          >
            {t('profile.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={saving || !hasChanges}
            startIcon={
              saving ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export const ProfileView = () => {
  const { t } = useTranslation()
  const { refreshUser } = useAuth()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Always load fresh account data when the page opens. A 401 signs the user
  // out in AuthProvider, and ProtectedRoute then shows the login view.
  useEffect(() => {
    let active = true
    refreshUser()
      .then((loaded) => {
        if (active) setUser(loaded)
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorCode(error instanceof ApiError ? error.code : 'error.network')
        }
      })
    return () => {
      active = false
    }
  }, [refreshUser, attempt])

  const retry = () => {
    setErrorCode(null)
    setAttempt((current) => current + 1)
  }

  return (
    <Box sx={pageSx}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Typography variant="h1" sx={titleSx}>
          {t('profile.title')}
        </Typography>
        <Typography sx={subtitleSx}>{t('profile.subtitle')}</Typography>
      </Box>

      {errorCode ? (
        <Alert
          severity="error"
          sx={{ borderRadius: '16px', alignItems: 'center' }}
          action={
            <Button color="inherit" size="small" onClick={retry}>
              {t('profile.retry')}
            </Button>
          }
        >
          {t('profile.loadFailed')}{' '}
          {t(errorCode, { defaultValue: t('error.unknown') })}
        </Alert>
      ) : user ? (
        <ProfileForm key={user.id} initialUser={user} />
      ) : (
        <PageLoader />
      )}
    </Box>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { AuthPanel } from '../components/auth/AuthPanel'
import { ControlledTextField } from '../components/form/ControlledTextField'
import { HomeIcon, KeyIcon } from '../components/icons'
import { useAuth } from '../hooks/useAuth'
import {
  registrationSchema,
  type RegistrationFormValues,
} from '../schemas/auth'

const roleOptions = [
  {
    role: 'TENANT',
    title: 'auth.tenant',
    body: 'auth.tenantBody',
    Icon: HomeIcon,
  },
  {
    role: 'LANDLORD',
    title: 'auth.landlord',
    body: 'auth.landlordBody',
    Icon: KeyIcon,
  },
] as const

export function RegistrationView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register } = useAuth()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'TENANT',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    try {
      await register(values)
      void navigate('/')
    } catch (error) {
      setApiError(error instanceof ApiError ? error.code : 'error.network')
    }
  })

  return (
    <AuthPanel
      mode="registration"
      title={t('auth.registrationTitle')}
      description={t('auth.registrationDescription')}
    >
      <Stack spacing={2.5}>
        {apiError ? (
          <Alert severity="error">
            {t(apiError, { defaultValue: t('error.unknown') })}
          </Alert>
        ) : null}

        <Box
          component="form"
          noValidate
          onSubmit={(event) => {
            void onSubmit(event)
          }}
        >
          <Stack spacing={2.5}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Box>
                  <Typography sx={{ mb: 1.25, fontSize: 15, fontWeight: 700 }}>
                    {t('auth.chooseRole')}
                  </Typography>
                  <Box
                    role="radiogroup"
                    aria-label={t('auth.chooseRole')}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1.5,
                    }}
                  >
                    {roleOptions.map((option) => {
                      const selected = field.value === option.role
                      return (
                        <ButtonBase
                          key={option.role}
                          role="radio"
                          aria-checked={selected}
                          onClick={() => field.onChange(option.role)}
                          sx={{
                            width: '100%',
                            minWidth: 0,
                            minHeight: 140,
                            p: 2,
                            border: '1.5px solid',
                            borderColor: selected ? 'primary.main' : 'grey.300',
                            borderRadius: '18px',
                            bgcolor: selected
                              ? 'selectedRoleBackground'
                              : 'background.paper',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            textAlign: 'left',
                            gap: 1,
                            '&:focus-visible': {
                              outline: '2px solid',
                              outlineColor: 'primary.main',
                              outlineOffset: 2,
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              flexShrink: 0,
                              borderRadius: '12px',
                              bgcolor: selected
                                ? 'primary.main'
                                : 'primary.light',
                              color: 'common.white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <option.Icon />
                          </Box>
                          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                            {t(option.title)}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 14,
                              color: 'text.secondary',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {t(option.body)}
                          </Typography>
                        </ButtonBase>
                      )
                    })}
                  </Box>
                </Box>
              )}
            />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <ControlledTextField
                control={control}
                name="firstName"
                label={t('auth.firstName')}
                autoComplete="given-name"
              />
              <ControlledTextField
                control={control}
                name="lastName"
                label={t('auth.lastName')}
                autoComplete="family-name"
              />
            </Box>
            <ControlledTextField
              control={control}
              name="email"
              label={t('auth.email')}
              type="email"
              autoComplete="email"
            />
            <ControlledTextField
              control={control}
              name="password"
              label={t('auth.password')}
              type="password"
              autoComplete="new-password"
              helperText={t('auth.passwordHint')}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? t('auth.submitting')
                : t('auth.registrationAction')}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </AuthPanel>
  )
}

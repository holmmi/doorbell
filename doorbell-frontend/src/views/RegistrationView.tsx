import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  SvgIcon,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { userClient } from '../api/userClient'
import { AuthPanel } from '../components/auth/AuthPanel'
import { AuthTextField } from '../components/auth/AuthTextField'
import {
  registrationSchema,
  type RegistrationFormValues,
} from '../schemas/auth'
import type { UserRole } from '../types/user'

const roleOptions = [
  { role: 'TENANT', title: 'auth.tenant', body: 'auth.tenantBody' },
  { role: 'LANDLORD', title: 'auth.landlord', body: 'auth.landlordBody' },
] as const

function RoleIcon({ role }: { role: UserRole }) {
  return (
    <SvgIcon
      viewBox="0 0 24 24"
      sx={{
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      {role === 'TENANT' ? (
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      ) : (
        <>
          <path d="M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4Z" />
          <circle cx="16.5" cy="7.5" r=".5" />
        </>
      )}
    </SvgIcon>
  )
}

export function RegistrationView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
      await userClient.register(values)
      await userClient.login({ email: values.email, password: values.password })
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
                            <RoleIcon role={option.role} />
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
              <AuthTextField
                control={control}
                name="firstName"
                label={t('auth.firstName')}
                autoComplete="given-name"
              />
              <AuthTextField
                control={control}
                name="lastName"
                label={t('auth.lastName')}
                autoComplete="family-name"
              />
            </Box>
            <AuthTextField
              control={control}
              name="email"
              label={t('auth.email')}
              type="email"
              autoComplete="email"
            />
            <AuthTextField
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

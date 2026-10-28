import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Stack } from '@mui/material'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { AuthPanel } from '../components/auth/AuthPanel'
import { ControlledTextField } from '../components/form/ControlledTextField'
import { useAuth } from '../hooks/useAuth'
import { loginSchema, type LoginFormValues } from '../schemas/auth'

export const LoginView = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    try {
      await login(values)
      void navigate('/')
    } catch (error) {
      setApiError(error instanceof ApiError ? error.code : 'error.network')
    }
  })

  return (
    <AuthPanel
      mode="login"
      title={t('auth.loginTitle')}
      description={t('auth.loginDescription')}
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
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('auth.submitting') : t('auth.loginAction')}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </AuthPanel>
  )
}

import { Box, Button, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate } from 'react-router'

type AuthMode = 'login' | 'registration'

type AuthPanelProps = {
  mode: AuthMode
  title: string
  description: string
  children: React.ReactNode
}

export function AuthPanel({
  mode,
  title,
  description,
  children,
}: AuthPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Paper
      component="section"
      elevation={0}
      sx={(theme) => ({
        width: '100%',
        boxSizing: 'border-box',
        p: { xs: 3, sm: 5 },
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'grey.200',
        borderRadius: '28px',
        boxShadow: `0 10px 30px ${theme.palette.authPanelShadow}`,
      })}
    >
      <Stack spacing={3.5}>
        <Tabs
          value={mode}
          onChange={(_, nextMode: AuthMode) => {
            void navigate(nextMode === 'login' ? '/login' : '/registration')
          }}
          variant="fullWidth"
          aria-label={t('auth.switchForm')}
        >
          <Tab value="registration" label={t('auth.signUp')} />
          <Tab value="login" label={t('auth.logIn')} />
        </Tabs>

        <Box>
          <Typography variant="h3" component="h1">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {description}
          </Typography>
        </Box>

        {children}

        <Button
          component={RouterLink}
          to="/"
          variant="text"
          sx={{ alignSelf: 'center' }}
        >
          {t('auth.demo')}
        </Button>
      </Stack>
    </Paper>
  )
}

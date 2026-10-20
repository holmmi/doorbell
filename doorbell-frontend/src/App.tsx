import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { AuthLayout } from './components/AuthLayout'
import './i18n'
import { theme } from './theme/theme'
import { HomeView } from './views/HomeView'
import { MatchesView } from './views/MatchesView'
import { ProfileView } from './views/ProfileView'

const LoginView = lazy(() =>
  import('./views/LoginView').then(({ LoginView }) => ({ default: LoginView }))
)
const RegistrationView = lazy(() =>
  import('./views/RegistrationView').then(({ RegistrationView }) => ({
    default: RegistrationView,
  }))
)

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route
              path="/login"
              element={
                <Suspense fallback={null}>
                  <LoginView />
                </Suspense>
              }
            />
            <Route
              path="/registration"
              element={
                <Suspense fallback={null}>
                  <RegistrationView />
                </Suspense>
              }
            />
          </Route>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeView />} />
            <Route path="/matches" element={<MatchesView />} />
            <Route path="/profile" element={<ProfileView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

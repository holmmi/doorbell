import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { AuthLayout } from './components/AuthLayout'
import { PageLoader } from './components/PageLoader'
import { AuthProvider } from './auth/AuthProvider'
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
const CreateListingView = lazy(() =>
  import('./views/CreateListingView').then(({ CreateListingView }) => ({
    default: CreateListingView,
  }))
)

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route
                path="/login"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <LoginView />
                  </Suspense>
                }
              />
              <Route
                path="/registration"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <RegistrationView />
                  </Suspense>
                }
              />
            </Route>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomeView />} />
              <Route path="/matches" element={<MatchesView />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route
                path="/landlord/listings/new"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <CreateListingView />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App

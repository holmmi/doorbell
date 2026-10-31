import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { AuthLayout } from './components/AuthLayout'
import { PageLoader } from './components/PageLoader'
import './i18n'
import { theme } from './theme/theme'
import { MatchesProvider } from './state/MatchesProvider'

// Views are named exports, so map each one to the default export lazy expects.
const lazyView = <T extends Record<string, ComponentType>>(
  load: () => Promise<T>,
  name: keyof T
) => lazy(() => load().then((module) => ({ default: module[name] })))

const HomeView = lazyView(() => import('./views/HomeView'), 'HomeView')
const MatchesView = lazyView(() => import('./views/MatchesView'), 'MatchesView')
const ProfileView = lazyView(() => import('./views/ProfileView'), 'ProfileView')
const LoginView = lazyView(() => import('./views/LoginView'), 'LoginView')
const RegistrationView = lazyView(
  () => import('./views/RegistrationView'),
  'RegistrationView'
)
const CreateListingView = lazyView(
  () => import('./views/CreateListingView'),
  'CreateListingView'
)

const page = (View: ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <View />
  </Suspense>
)

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <MatchesProvider>
            <Routes>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={page(LoginView)} />
                <Route path="/registration" element={page(RegistrationView)} />
              </Route>
              <Route element={<AppShell />}>
                <Route path="/" element={page(HomeView)} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/profile" element={page(ProfileView)} />
                </Route>
                <Route element={<ProtectedRoute role="TENANT" />}>
                  <Route path="/matches" element={page(MatchesView)} />
                </Route>
                <Route element={<ProtectedRoute role="LANDLORD" />}>
                  <Route
                    path="/listing/new"
                    element={page(CreateListingView)}
                  />
                </Route>
              </Route>
            </Routes>
          </MatchesProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

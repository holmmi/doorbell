import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import './i18n'
import { theme } from './theme/theme'
import { HomeView } from './views/HomeView'
import { MatchesView } from './views/MatchesView'
import { ProfileView } from './views/ProfileView'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
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

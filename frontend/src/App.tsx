import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { Route, Routes, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import TradesPage from './pages/TradesPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

const theme = createTheme({
  shape: { borderRadius: 12 },
  palette: {
    background: {
      default: '#f5f7fb'
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { boxShadow: '0 4px 18px rgba(0,0,0,0.05)' }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true }
    }
  }
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/trades" element={<ProtectedRoute><TradesPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}

export default App

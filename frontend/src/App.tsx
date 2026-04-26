import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Box } from '@mui/material'
import { Route, Routes, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import AppErrorBoundary from './components/ui/AppErrorBoundary'
import LoadingState from './components/ui/LoadingState'
import { trackPageView } from './utils/analytics/ga4'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const CheckEmailPage = lazy(() => import('./pages/CheckEmailPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TodayPage = lazy(() => import('./pages/TodayPage'))
const TradesPage = lazy(() => import('./pages/TradesPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const NotebookPage = lazy(() => import('./pages/NotebookPage'))
const SessionPage = lazy(() => import('./pages/SessionPage'))
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'))
const BacktestingPage = lazy(() => import('./pages/BacktestingPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const CookiesPage = lazy(() => import('./pages/CookiesPage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const InsightDetailPage = lazy(() => import('./pages/InsightDetailPage'))
const AdminContentPage = lazy(() => import('./pages/admin/AdminContentPage'))
const AdminContentEditorPage = lazy(() => import('./pages/admin/AdminContentEditorPage'))
const AdminContentTypesPage = lazy(() => import('./pages/admin/AdminContentTypesPage'))

function GaRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/') {
      return
    }
    trackPageView(`${location.pathname}${location.search}`)
  }, [location.pathname, location.search])

  return null
}

function RouteFallback() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
      <LoadingState rows={1} height={48} />
    </Box>
  )
}

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<RouteFallback />}>
      {node}
    </Suspense>
  )
}

function App() {
  return (
    <AppErrorBoundary>
      <>
        <GaRouteTracker />
        <Routes>
          <Route path="/login" element={withSuspense(<LoginPage />)} />
          <Route path="/register" element={withSuspense(<RegisterPage />)} />
          <Route path="/register/confirm" element={withSuspense(<CheckEmailPage />)} />
          <Route path="/verify" element={withSuspense(<VerifyEmailPage />)} />
          <Route path="/forgot-password" element={withSuspense(<ForgotPasswordPage />)} />
          <Route path="/reset-password" element={withSuspense(<ResetPasswordPage />)} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/today" replace />} />
            <Route path="/terms" element={withSuspense(<TermsPage />)} />
            <Route path="/privacy" element={withSuspense(<PrivacyPage />)} />
            <Route path="/cookies" element={withSuspense(<CookiesPage />)} />
            <Route path="/today" element={<ProtectedRoute>{withSuspense(<TodayPage />)}</ProtectedRoute>} />
            <Route path="/today/session" element={<ProtectedRoute>{withSuspense(<SessionPage />)}</ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute>{withSuspense(<DashboardPage />)}</ProtectedRoute>} />
            <Route path="/trades" element={<ProtectedRoute>{withSuspense(<TradesPage />)}</ProtectedRoute>} />
            <Route path="/strategies" element={<ProtectedRoute>{withSuspense(<StrategiesPage />)}</ProtectedRoute>} />
            <Route path="/backtesting" element={<ProtectedRoute>{withSuspense(<BacktestingPage />)}</ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute>{withSuspense(<CalendarPage />)}</ProtectedRoute>} />
            <Route path="/notebook" element={<ProtectedRoute>{withSuspense(<NotebookPage />)}</ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute>{withSuspense(<AnalyticsPage />)}</ProtectedRoute>} />
            <Route path="/diagnostics" element={<ProtectedRoute>{withSuspense(<DiagnosticsPage />)}</ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><Navigate to="/insights/today" replace /></ProtectedRoute>} />
            <Route path="/insights/today" element={<ProtectedRoute>{withSuspense(<InsightsPage />)}</ProtectedRoute>} />
            <Route path="/insights/week" element={<ProtectedRoute>{withSuspense(<InsightsPage />)}</ProtectedRoute>} />
            <Route path="/insights/playbooks" element={<ProtectedRoute>{withSuspense(<InsightsPage />)}</ProtectedRoute>} />
            <Route path="/insights/learn" element={<ProtectedRoute>{withSuspense(<InsightsPage />)}</ProtectedRoute>} />
            <Route path="/insights/:idOrSlug" element={<ProtectedRoute>{withSuspense(<InsightDetailPage />)}</ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute>{withSuspense(<SettingsPage />)}</ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute>{withSuspense(<ProfilePage />)}</ProtectedRoute>} />
            <Route path="/admin/content" element={<AdminRoute>{withSuspense(<AdminContentPage />)}</AdminRoute>} />
            <Route path="/admin/content/types" element={<AdminRoute>{withSuspense(<AdminContentTypesPage />)}</AdminRoute>} />
            <Route path="/admin/content/new" element={<AdminRoute>{withSuspense(<AdminContentEditorPage />)}</AdminRoute>} />
            <Route path="/admin/content/:id" element={<AdminRoute>{withSuspense(<AdminContentEditorPage />)}</AdminRoute>} />
          </Route>
        </Routes>
      </>
    </AppErrorBoundary>
  )
}

export default App

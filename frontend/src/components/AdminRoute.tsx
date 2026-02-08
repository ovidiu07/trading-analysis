import { Box, Button, Stack, Typography } from '@mui/material'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import LoadingState from './ui/LoadingState'
import { useI18n } from '../i18n'

type AdminRouteProps = {
  children: ReactNode
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, initializing, user } = useAuth()
  const { t } = useI18n()
  const location = useLocation()

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
        <LoadingState rows={1} height={48} />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user?.role !== 'ADMIN') {
    return (
      <Box sx={{ py: 6 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography variant="h5">{t('admin.accessRequiredTitle')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('admin.accessRequiredBody')}
          </Typography>
          <Button variant="contained" component={Link} to="/dashboard">{t('admin.backToDashboard')}</Button>
        </Stack>
      </Box>
    )
  }

  return <>{children}</>
}

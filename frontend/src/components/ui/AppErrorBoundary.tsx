import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useI18n } from '../../i18n'

type AppErrorBoundaryProps = {
  children: ReactNode
  title: string
  description: string
  reloadLabel: string
}

type AppErrorBoundaryState = {
  hasError: boolean
}

class AppErrorBoundaryInner extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Unhandled render error', error, info)
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, py: 8 }}>
          <Alert severity="error" sx={{ width: '100%', maxWidth: 560 }}>
            <Stack spacing={1.25} alignItems="flex-start">
              <Typography variant="h6">{this.props.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {this.props.description}
              </Typography>
              <Button variant="contained" size="small" onClick={this.handleReload}>
                {this.props.reloadLabel}
              </Button>
            </Stack>
          </Alert>
        </Box>
      )
    }

    return this.props.children
  }
}

export default function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return (
    <AppErrorBoundaryInner
      title={t('errors.genericTitle')}
      description={t('errors.renderFailure')}
      reloadLabel={t('errors.reload')}
    >
      {children}
    </AppErrorBoundaryInner>
  )
}

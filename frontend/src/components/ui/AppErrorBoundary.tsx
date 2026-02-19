import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
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
              <Typography variant="h6">Something went wrong</Typography>
              <Typography variant="body2" color="text.secondary">
                An unexpected error occurred while rendering this page.
              </Typography>
              <Button variant="contained" size="small" onClick={this.handleReload}>
                Reload
              </Button>
            </Stack>
          </Alert>
        </Box>
      )
    }

    return this.props.children
  }
}

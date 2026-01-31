import { Alert, AlertTitle } from '@mui/material'

type ErrorBannerProps = {
  title?: string
  message: string
}

export default function ErrorBanner({ title = 'Something went wrong', message }: ErrorBannerProps) {
  return (
    <Alert severity="error">
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  )
}

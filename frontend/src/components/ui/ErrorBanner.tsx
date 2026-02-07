import { Alert, AlertTitle } from '@mui/material'
import { useI18n } from '../../i18n'

type ErrorBannerProps = {
  title?: string
  message: string
}

export default function ErrorBanner({ title = 'Something went wrong', message }: ErrorBannerProps) {
  const { t } = useI18n()
  const resolvedTitle = title === 'Something went wrong' ? t('errors.genericTitle') : title
  return (
    <Alert severity="error">
      <AlertTitle>{resolvedTitle}</AlertTitle>
      {message}
    </Alert>
  )
}

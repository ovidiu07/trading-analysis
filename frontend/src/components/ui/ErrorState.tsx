import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { Box, Button, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'
import { useI18n } from '../../i18n'

type ErrorStateProps = {
  title?: string
  description: string
  action?: ReactNode
  onRetry?: () => void
}

export default function ErrorState({ title, description, action, onRetry }: ErrorStateProps) {
  const { t } = useI18n()
  return (
    <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 6, textAlign: 'center' }}>
      <Box sx={{ color: 'error.main', display: 'inline-flex' }}>
        <ErrorOutlineIcon />
      </Box>
      <Typography variant="subtitle1">{title || t('errors.genericTitle')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      {onRetry && (
        <Button onClick={onRetry} size="small" variant="outlined">
          {t('common.retry')}
        </Button>
      )}
      {action}
    </Stack>
  )
}

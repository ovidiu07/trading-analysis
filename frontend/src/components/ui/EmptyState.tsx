import { Box, Stack, Typography } from '@mui/material'
import { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}

export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 6, textAlign: 'center' }}>
      {icon && <Box sx={{ fontSize: 32, color: 'text.secondary' }}>{icon}</Box>}
      <Typography variant="h6">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Stack>
  )
}

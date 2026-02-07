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
    <Stack
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={{
        py: 5,
        px: 2,
        textAlign: 'center',
        minHeight: 160,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      {icon && <Box sx={{ fontSize: 28, color: 'text.secondary' }}>{icon}</Box>}
      <Typography variant="subtitle1">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Stack>
  )
}

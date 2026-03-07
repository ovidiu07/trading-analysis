import { Box, Stack, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  sx?: SxProps<Theme>
}

export default function EmptyState({ title, description, action, icon, sx }: EmptyStateProps) {
  const baseSx = {
    py: 5,
    px: 2,
    textAlign: 'center',
    minHeight: 160,
    border: '1px dashed',
    borderColor: 'divider',
    borderRadius: 2
  } as const

  const stackSx: SxProps<Theme> = Array.isArray(sx)
    ? [baseSx, ...sx]
    : sx
      ? [baseSx, sx]
      : baseSx

  return (
    <Stack
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={stackSx}
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

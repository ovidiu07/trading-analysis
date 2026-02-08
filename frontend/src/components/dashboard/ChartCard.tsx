import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Box, Card, CardContent, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material'
import { ReactNode } from 'react'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'

type ChartCardProps = {
  title: string
  subtitle?: string
  tooltipText?: string
  loading?: boolean
  error?: string
  emptyTitle?: string
  emptyDescription?: string
  height: number
  children?: ReactNode
}

export default function ChartCard({
  title,
  subtitle,
  tooltipText,
  loading,
  error,
  emptyTitle,
  emptyDescription,
  height,
  children
}: ChartCardProps) {
  return (
    <Card sx={{ height: '100%', width: '100%', minWidth: 0 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5, minWidth: 0 }}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>
          {tooltipText && (
            <Tooltip title={tooltipText} arrow>
              <IconButton size="small" aria-label={title}>
                <InfoOutlinedIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {loading ? (
          <Skeleton variant="rectangular" height={height} />
        ) : error ? (
          <ErrorState description={error} />
        ) : !children ? (
          <EmptyState
            title={emptyTitle || 'No data'}
            description={emptyDescription}
          />
        ) : (
          <Box sx={{ width: '100%', minWidth: 0, mx: 'auto' }}>
            {children}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

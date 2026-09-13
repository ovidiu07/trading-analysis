import type { ReactNode } from 'react'
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import { useI18n } from '../../i18n'

export function DemoBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <Chip
      size="small"
      label={compact ? t('workstation.demoShort') : t('workstation.demo')}
      title={t('workstation.demo')}
      color="warning"
      variant="outlined"
      sx={{ height: 22, fontSize: 10.5, borderRadius: 1 }}
    />
  )
}

export function WorkstationCard({
  title,
  icon: Icon,
  action,
  children,
  demo = false,
  sx
}: {
  title: string
  icon: SvgIconComponent
  action?: ReactNode
  children: ReactNode
  demo?: boolean
  sx?: object
}) {
  return (
    <Card className="workstation-card" sx={{ height: '100%', minWidth: 0, ...sx }}>
      <CardContent sx={{ p: { xs: 1.5, xl: 1.75 }, '&:last-child': { pb: { xs: 1.5, xl: 1.75 } } }}>
        <Stack spacing={1.25}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <Icon sx={{ fontSize: 19, color: 'primary.main', flexShrink: 0 }} />
              <Typography component="h2" variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
              {demo ? <DemoBadge compact /> : null}
              {action}
            </Stack>
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  )
}

export function MetricRow({
  label,
  value,
  change,
  direction = 'flat'
}: {
  label: string
  value: string
  change?: string
  direction?: 'positive' | 'negative' | 'flat'
}) {
  const color = direction === 'positive' ? 'trading.profit' : direction === 'negative' ? 'trading.loss' : 'text.primary'
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
      sx={{ py: 0.55, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
    >
      <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
      <Stack direction="row" spacing={1} alignItems="baseline">
        <Typography className="metric-value" variant="caption" sx={{ color, fontWeight: 650 }}>{value}</Typography>
        {change ? <Typography className="metric-value" variant="caption" sx={{ color, minWidth: 54, textAlign: 'right' }}>{change}</Typography> : null}
      </Stack>
    </Stack>
  )
}

export function PanelNumber({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 22,
        height: 22,
        borderRadius: 1,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontSize: 11,
        fontWeight: 800
      }}
    >
      {children}
    </Box>
  )
}

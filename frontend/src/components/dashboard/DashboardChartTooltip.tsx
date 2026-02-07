import { Paper, Stack, Typography } from '@mui/material'
import { formatCurrency } from '../../utils/format'
import { useI18n } from '../../i18n'

type RechartsPayloadEntry = {
  value: number
  payload: {
    date?: string
    value?: number
    tradeCount?: number
  }
}

type DashboardChartTooltipProps = {
  active?: boolean
  payload?: RechartsPayloadEntry[]
  label?: string
  currency: string
}

export default function DashboardChartTooltip({ active, payload, label, currency }: DashboardChartTooltipProps) {
  const { t } = useI18n()

  if (!active || !payload || payload.length === 0) return null

  const point = payload[0]
  const value = point?.value ?? point?.payload?.value ?? 0
  const tradeCount = point?.payload?.tradeCount

  return (
    <Paper sx={{ px: 1.25, py: 1, border: '1px solid', borderColor: 'divider', minWidth: 130 }}>
      <Stack spacing={0.35}>
        <Typography variant="caption" color="text.secondary">
          {label || point?.payload?.date || '—'}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: value >= 0 ? 'success.main' : 'error.main',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum"'
          }}
        >
          {formatCurrency(value, currency)}
        </Typography>
        {typeof tradeCount === 'number' && (
          <Typography variant="caption" color="text.secondary">
            {t('dashboard.chartTooltip.tradeCount', { count: tradeCount })}
          </Typography>
        )}
      </Stack>
    </Paper>
  )
}

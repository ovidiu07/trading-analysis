import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material'
import { TradeRequest } from '../../api/trades'
import { useI18n } from '../../i18n'
import { formatCurrency, formatNumber, formatPercent, formatSignedCurrency } from '../../utils/format'
import { calculateTradeLiveMetrics } from '../../utils/tradeCalculations'

type NullableNumber = number | string | null | undefined

type TradeLiveSummaryValues = {
  status?: TradeRequest['status']
  direction?: TradeRequest['direction']
  entryPrice?: NullableNumber
  exitPrice?: NullableNumber
  quantity?: NullableNumber
  stopLossPrice?: NullableNumber
  fees?: NullableNumber
  commission?: NullableNumber
  slippage?: NullableNumber
  riskAmount?: NullableNumber
  capitalUsed?: NullableNumber
}

type TradeLiveSummaryProps = {
  values: TradeLiveSummaryValues
  baseCurrency: string
  onUseCalculatedRisk?: (riskValue: number) => void
}

const asNumber = (value: NullableNumber): number | null => {
  if (value === undefined || value === null || Number.isNaN(value)) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\\s+/g, '').replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600}>{value}</Typography>
  </Stack>
)

export function TradeLiveSummary({ values, baseCurrency, onUseCalculatedRisk }: TradeLiveSummaryProps) {
  const { t } = useI18n()

  const metrics = calculateTradeLiveMetrics({
    direction: values.direction,
    entryPrice: asNumber(values.entryPrice),
    exitPrice: asNumber(values.exitPrice),
    quantity: asNumber(values.quantity),
    stopLossPrice: asNumber(values.stopLossPrice),
    fees: asNumber(values.fees),
    commission: asNumber(values.commission),
    slippage: asNumber(values.slippage),
    riskAmount: asNumber(values.riskAmount),
    capitalUsed: asNumber(values.capitalUsed)
  })
  const quantity = asNumber(values.quantity)
  const entryPrice = asNumber(values.entryPrice)
  const stopLossPrice = asNumber(values.stopLossPrice)

  const warnings: Array<{ key: string; severity: 'warning' | 'error'; text: string }> = []

  if (values.status === 'CLOSED' && asNumber(values.exitPrice) === null) {
    warnings.push({
      key: 'closed-missing-exit',
      severity: 'warning',
      text: t('trades.form.summaryWarnings.closedWithoutExit')
    })
  }

  if (quantity !== null && quantity <= 0) {
    warnings.push({
      key: 'qty-non-positive',
      severity: 'error',
      text: t('trades.form.summaryWarnings.quantityNonPositive')
    })
  }

  if (
    entryPrice !== null
    && stopLossPrice !== null
    && values.direction
    && ((values.direction === 'LONG' && stopLossPrice > entryPrice)
      || (values.direction === 'SHORT' && stopLossPrice < entryPrice))
  ) {
    warnings.push({
      key: 'sl-inconsistent',
      severity: 'warning',
      text: t('trades.form.summaryWarnings.stopLossInconsistent')
    })
  }

  const statusLabel = values.status ? t(`trades.status.${values.status}`) : '—'
  const directionLabel = values.direction ? t(`trades.direction.${values.direction}`) : '—'

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>{t('trades.form.liveSummaryTitle')}</Typography>
          <Typography variant="caption" color="text.secondary">{t('trades.form.liveSummarySubtitle')}</Typography>

          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              label={statusLabel}
              color={values.status === 'CLOSED' ? 'primary' : 'warning'}
              variant="outlined"
            />
            <Chip
              size="small"
              label={directionLabel}
              color={values.direction === 'LONG' ? 'success' : 'error'}
              variant="outlined"
            />
          </Stack>

          <Divider />

          <SummaryRow
            label={t('trades.form.pnlGross')}
            value={metrics.grossPnl === null ? '—' : formatSignedCurrency(metrics.grossPnl, baseCurrency)}
          />
          <SummaryRow
            label={t('trades.form.costsTotal')}
            value={formatCurrency(metrics.costs, baseCurrency)}
          />
          <SummaryRow
            label={t('trades.form.pnlNet')}
            value={metrics.netPnl === null ? '—' : formatSignedCurrency(metrics.netPnl, baseCurrency)}
          />
          <SummaryRow
            label={t('trades.form.pnlPercent')}
            value={metrics.pnlPercent === null ? '—' : formatPercent(metrics.pnlPercent)}
          />
          <SummaryRow
            label={t('trades.form.riskAmount')}
            value={metrics.riskValue === null ? '—' : formatCurrency(metrics.riskValue, baseCurrency)}
          />
          <SummaryRow
            label={t('trades.form.rMultiple')}
            value={metrics.rMultiple === null ? '—' : formatNumber(metrics.rMultiple, 2)}
          />

          {asNumber(values.riskAmount) === null && metrics.riskFromPrices !== null && onUseCalculatedRisk && (
            <Box>
              <Button size="small" onClick={() => onUseCalculatedRisk(metrics.riskFromPrices!)}>
                {t('trades.form.useCalculatedRisk')}
              </Button>
            </Box>
          )}

          {warnings.length > 0 && (
            <Stack spacing={1}>
              {warnings.map((warning) => (
                <Alert key={warning.key} severity={warning.severity}>
                  {warning.text}
                </Alert>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

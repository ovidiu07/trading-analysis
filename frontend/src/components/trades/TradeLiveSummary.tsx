import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography
} from '@mui/material'
import { TradeRequest } from '../../api/trades'
import { useI18n } from '../../i18n'
import { formatCurrency, formatNumber, formatSignedCurrency } from '../../utils/format'
import { parseLocalizedNumberInput } from '../../utils/numberInput'
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
  variant?: 'desktop' | 'compact'
  maxWarnings?: number
}

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600}>{value}</Typography>
  </Stack>
)

const CompactMetric = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600}>{value}</Typography>
  </Stack>
)

export function TradeLiveSummary({
  values,
  baseCurrency,
  onUseCalculatedRisk,
  variant = 'desktop',
  maxWarnings = Number.POSITIVE_INFINITY
}: TradeLiveSummaryProps) {
  const { t } = useI18n()
  const [showAllWarnings, setShowAllWarnings] = useState(false)
  const isCompact = variant === 'compact'

  const metrics = calculateTradeLiveMetrics({
    direction: values.direction,
    entryPrice: parseLocalizedNumberInput(values.entryPrice) ?? null,
    exitPrice: parseLocalizedNumberInput(values.exitPrice) ?? null,
    quantity: parseLocalizedNumberInput(values.quantity) ?? null,
    stopLossPrice: parseLocalizedNumberInput(values.stopLossPrice) ?? null,
    fees: parseLocalizedNumberInput(values.fees) ?? null,
    commission: parseLocalizedNumberInput(values.commission) ?? null,
    slippage: parseLocalizedNumberInput(values.slippage) ?? null,
    riskAmount: parseLocalizedNumberInput(values.riskAmount) ?? null,
    capitalUsed: parseLocalizedNumberInput(values.capitalUsed) ?? null
  })
  const quantity = parseLocalizedNumberInput(values.quantity) ?? null
  const entryPrice = parseLocalizedNumberInput(values.entryPrice) ?? null
  const stopLossPrice = parseLocalizedNumberInput(values.stopLossPrice) ?? null

  const warnings = useMemo(() => {
    const items: Array<{ key: string; severity: 'warning' | 'error'; text: string }> = []

    if (values.status === 'CLOSED' && parseLocalizedNumberInput(values.exitPrice) === undefined) {
      items.push({
        key: 'closed-missing-exit',
        severity: 'warning',
        text: t('trades.form.summaryWarnings.closedWithoutExit')
      })
    }

    if (quantity !== null && quantity <= 0) {
      items.push({
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
      items.push({
        key: 'sl-inconsistent',
        severity: 'warning',
        text: t('trades.form.summaryWarnings.stopLossInconsistent')
      })
    }

    return items
  }, [entryPrice, quantity, stopLossPrice, t, values.direction, values.exitPrice, values.status])

  const statusLabel = values.status ? t(`trades.status.${values.status}`) : '—'
  const directionLabel = values.direction ? t(`trades.direction.${values.direction}`) : '—'
  const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, maxWarnings)
  const hasCollapsedWarnings = warnings.length > maxWarnings

  const content = (
    <Stack spacing={isCompact ? 1 : 1.25}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Box>
          <Typography variant={isCompact ? 'subtitle2' : 'subtitle1'} fontWeight={700}>
            {t('trades.form.liveSummaryTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('trades.form.liveSummarySubtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75}>
          <Chip
            size="small"
            label={statusLabel}
            color={values.status === 'CLOSED' ? 'primary' : 'warning'}
            variant="outlined"
          />
          <Chip
            size="small"
            label={directionLabel}
            color={values.direction === 'LONG' ? 'success' : values.direction === 'SHORT' ? 'error' : 'default'}
            variant="outlined"
          />
        </Stack>
      </Stack>

      <Divider />

      {isCompact ? (
        <Stack spacing={0.85}>
          <CompactMetric
            label={t('trades.form.pnlNet')}
            value={metrics.netPnl === null ? '—' : formatSignedCurrency(metrics.netPnl, baseCurrency)}
          />
          <CompactMetric
            label={t('trades.form.pnlGross')}
            value={metrics.grossPnl === null ? '—' : formatSignedCurrency(metrics.grossPnl, baseCurrency)}
          />
          <CompactMetric
            label={t('trades.form.costsTotal')}
            value={formatCurrency(metrics.costs, baseCurrency)}
          />
          <CompactMetric
            label={t('trades.form.riskAmount')}
            value={metrics.riskValue === null ? '—' : formatCurrency(metrics.riskValue, baseCurrency)}
          />
          <CompactMetric
            label={t('trades.form.rMultiple')}
            value={metrics.rMultiple === null ? '—' : formatNumber(metrics.rMultiple, 2)}
          />
        </Stack>
      ) : (
        <Stack spacing={1}>
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
            value={metrics.pnlPercent === null ? '—' : `${formatNumber(metrics.pnlPercent, 2)}%`}
          />
          <SummaryRow
            label={t('trades.form.riskAmount')}
            value={metrics.riskValue === null ? '—' : formatCurrency(metrics.riskValue, baseCurrency)}
          />
          <SummaryRow
            label={t('trades.form.rMultiple')}
            value={metrics.rMultiple === null ? '—' : formatNumber(metrics.rMultiple, 2)}
          />
        </Stack>
      )}

      {parseLocalizedNumberInput(values.riskAmount) === undefined && metrics.riskFromPrices !== null && onUseCalculatedRisk && (
        <Box>
          <Button size="small" onClick={() => onUseCalculatedRisk(metrics.riskFromPrices!)}>
            {t('trades.form.useCalculatedRisk')}
          </Button>
        </Box>
      )}

      {visibleWarnings.length > 0 && (
        <Stack spacing={0.75}>
          {visibleWarnings.map((warning) => (
            <Alert key={warning.key} severity={warning.severity} sx={{ py: 0.25 }}>
              {warning.text}
            </Alert>
          ))}
          {hasCollapsedWarnings && (
            <Button size="small" onClick={() => setShowAllWarnings(true)} sx={{ alignSelf: 'flex-start' }}>
              {t('trades.form.viewAllWarnings')}
            </Button>
          )}
          {showAllWarnings && warnings.length > maxWarnings && (
            <Button size="small" onClick={() => setShowAllWarnings(false)} sx={{ alignSelf: 'flex-start' }}>
              {t('trades.form.showFewerWarnings')}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  )

  if (isCompact) {
    return content
  }

  return (
    <Card variant="outlined">
      <CardContent>{content}</CardContent>
    </Card>
  )
}


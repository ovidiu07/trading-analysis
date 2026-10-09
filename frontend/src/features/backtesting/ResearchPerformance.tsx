import { Suspense, lazy, useId, useState } from 'react'
import { Alert, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import type { BacktestingMetric, BacktestingTrade } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import { computeResearchMetrics } from './research'
import LoadingState from '../../components/ui/LoadingState'
const Charts = lazy(() => import('./BacktestingCharts'))

export const formatMoney = (value: number | null | undefined, currency: string | null | undefined, locale: string) => value == null || !currency ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
export const basisExpectancy = (metrics: BacktestingMetric, currency: string) => currency ? metrics.currencyMetrics?.[currency]?.expectancy ?? null : metrics.expectancy
export const formatBasis = (value: number | null | undefined, currency: string, locale: string) => currency ? formatMoney(value, currency, locale) : value == null ? '—' : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}R`
export function AnalysisBasis({ value, onChange, metrics }: { value: string; onChange: (value: string) => void; metrics: BacktestingMetric }) {
  const { t } = useI18n()
  const labelId = useId()
  return <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel id={labelId}>{t('backtesting.replay.basis')}</InputLabel><Select labelId={labelId} label={t('backtesting.replay.basis')} value={value} onChange={event => onChange(event.target.value)}><MenuItem value="">R</MenuItem>{Object.keys(metrics.currencyMetrics || {}).map(currency => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}</Select></FormControl>
}

export default function ResearchPerformance({ trades, metrics }: { trades: BacktestingTrade[]; metrics: BacktestingMetric }) {
  const { t, locale } = useI18n()
  const currencies = Object.keys(metrics.currencyMetrics || {})
  const [selection, setSelection] = useState<string | null>(null)
  const currency = selection != null && (selection === '' || currencies.includes(selection)) ? selection : currencies[0] || ''
  const money = currency ? metrics.currencyMetrics?.[currency] : undefined
  const rows = currency ? trades.filter(trade => trade.currency === currency && trade.netPnl != null) : trades
  const selectedMetrics = computeResearchMetrics(rows)
  const [dimension, setDimension] = useState('day')
  const groupLabelId = useId()
  const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
  const amount = (value: number | null | undefined) => formatBasis(value, currency, locale)
  const factor = currency ? money?.profitFactor : metrics.profitFactor
  const cards: Array<[string, string | number]> = [
    ['totalCompleted', selectedMetrics.trades], ['winRate', `${number(selectedMetrics.winRate)}%`],
    [currency ? 'replay.netPnl' : 'totalR', amount(money?.netPnl ?? (currency ? null : metrics.totalR))],
    ['expectancy', amount(money?.expectancy ?? (currency ? null : metrics.expectancy))],
    ['profitFactor', factor == null ? t('backtesting.replay.noLossDenominator') : number(factor)],
    ['maximumDrawdown', amount(money?.maximumDrawdown ?? (currency ? null : metrics.maximumDrawdownR))],
    ['averageWinner', amount(money?.averageWinner ?? (currency ? null : metrics.averageWinR))],
    ['averageLoser', amount(money?.averageLoser ?? (currency ? null : metrics.averageLossR))],
    ['replay.largestWinner', amount(money?.largestWinner ?? (currency ? null : metrics.largestWinR))],
    ['replay.largestLoser', amount(money?.largestLoser ?? (currency ? null : metrics.largestLossR))],
    ['replay.maximumLosingStreak', selectedMetrics.maximumLosingStreak || 0],
    ['replay.currentLosingStreak', selectedMetrics.currentLosingStreak || 0]
  ]
  if (money) cards.push(['replay.grossProfit', amount(money.grossProfit)], ['replay.grossLoss', amount(money.grossLoss)], ['replay.commission', amount(money.commission)],
    ['replay.averageHolding', money.averageHoldingMinutes == null ? '—' : `${number(money.averageHoldingMinutes)} min`], ['replay.averageBars', number(money.averageDurationBars)],
    ['replay.averageMfe', amount(money.averageFavorableExcursion)], ['replay.averageMae', amount(money.averageAdverseExcursion)])
  const groups = new Map<string, BacktestingTrade[]>()
  const label = (trade: BacktestingTrade) => {
    switch (dimension) {
      case 'day': return trade.exitDate || trade.date
      case 'hour': return trade.entryTime.slice(0, 2) + ':00'
      case 'weekday': return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(`${trade.date}T12:00:00Z`))
      case 'direction': return t(`backtesting.direction.${trade.direction}`)
      case 'source': return t(`backtesting.sources.${trade.source}`)
      case 'scope': return trade.tradeScope
      case 'instrument': return trade.instrument
      case 'exitSignal': return trade.exitSignal || t('backtesting.replay.unspecified')
      default: return trade.session || t('backtesting.replay.unspecified')
    }
  }
  rows.forEach(trade => { const key = label(trade); groups.set(key, [...(groups.get(key) || []), trade]) })
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between"><Typography component="h2" variant="h6">{t('backtesting.replay.performance')}</Typography><AnalysisBasis metrics={metrics} value={currency} onChange={setSelection} /></Stack>
    {metrics.rSampleSize !== metrics.trades && <Alert severity="info">{t('backtesting.replay.rCoverage', { known: metrics.rSampleSize || 0, total: metrics.trades })}</Alert>}
    {money && <Alert severity="info">{t('backtesting.replay.moneyCoverage', { count: money.trades, total: metrics.trades, currency })}</Alert>}
    {trades.some(trade => trade.importFormat) && <Alert severity="info">{t('backtesting.replay.analysisCaveats')}</Alert>}
    <Grid container spacing={1.25}>{cards.map(([key, value]) => <Grid item xs={6} md={4} lg={2} key={key}><Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}><Typography variant="caption" color="text.secondary">{t(key.startsWith('replay.') ? `backtesting.${key}` : `backtesting.metrics.${key}`)}</Typography><Typography variant="h6" sx={{ fontWeight: 850, overflowWrap: 'anywhere' }}>{value}</Typography></Paper></Grid>)}</Grid>
    <Suspense fallback={<LoadingState rows={2} height={280} />}><Charts trades={rows} currency={currency} /></Suspense>
    <Paper variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>{t('backtesting.replay.breakdowns')}</Typography><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id={groupLabelId}>{t('backtesting.replay.groupBy')}</InputLabel><Select labelId={groupLabelId} label={t('backtesting.replay.groupBy')} value={dimension} onChange={event => setDimension(event.target.value)}>{['day', 'hour', 'weekday', 'direction', 'session', 'instrument', 'exitSignal', 'source', 'scope'].map(key => <MenuItem key={key} value={key}>{t(`backtesting.replay.dimensions.${key}`)}</MenuItem>)}</Select></FormControl></Stack>
      <TableContainer><Table size="small"><TableHead><TableRow>{['condition', 'tradeCount', 'winRate', 'expectancy'].map(key => <TableCell key={key}>{t(`backtesting.edge.${key}`)}</TableCell>)}<TableCell>{t(currency ? 'backtesting.replay.netPnl' : 'backtesting.metrics.totalR')}</TableCell><TableCell>{t('backtesting.metrics.profitFactor')}</TableCell><TableCell>{t('backtesting.metrics.maximumDrawdown')}</TableCell></TableRow></TableHead><TableBody>{[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, group]) => {
        const m = computeResearchMetrics(group), c = m.currencyMetrics?.[currency]
        return <TableRow key={name}><TableCell>{name}</TableCell><TableCell>{m.trades}</TableCell><TableCell>{number(m.winRate)}%</TableCell><TableCell>{amount(basisExpectancy(m, currency))}</TableCell><TableCell>{amount(currency ? c?.netPnl : m.totalR)}</TableCell><TableCell>{number(currency ? c?.profitFactor : m.profitFactor)}</TableCell><TableCell>{amount(currency ? c?.maximumDrawdown : m.maximumDrawdownR)}</TableCell></TableRow>
      })}</TableBody></Table></TableContainer>
    </Stack></Paper>
  </Stack>
}

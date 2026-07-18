import { Box, Button, Grid, Paper, Stack, Typography, useTheme } from '@mui/material'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { BacktestingTrade } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import { computeResearchMetrics } from './research'

type ChartPoint = { label: string; value: number; drawdown: number }

const round = (value: number) => Number(value.toFixed(2))

export default function BacktestingCharts({ trades }: { trades: BacktestingTrade[] }) {
  const { t, locale } = useI18n()
  const theme = useTheme()
  const [showConditions, setShowConditions] = useState(false)
  const sorted = [...trades].sort((left, right) => `${left.date}${left.entryTime}`.localeCompare(`${right.date}${right.entryTime}`))
  let cumulative = 0
  let peak = 0
  const curve: ChartPoint[] = sorted.map((trade, index) => {
    cumulative += Number(trade.pnlR || 0)
    peak = Math.max(peak, cumulative)
    return {
      label: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(`${trade.date}T12:00:00`)),
      value: round(cumulative),
      drawdown: round(peak - cumulative)
    }
  }).filter((_, index) => index === 0 || index === sorted.length - 1 || index % Math.max(1, Math.floor(sorted.length / 40)) === 0)
  const sourceData = (['MANUAL', 'IMPORT', 'LIVE'] as const).map((source) => {
    const metrics = computeResearchMetrics(trades.filter((trade) => trade.source === source))
    return { source: t(`backtesting.sources.${source}`), expectancy: metrics.expectancy, trades: metrics.trades }
  })
  const groupExpectancy = (label: (trade: BacktestingTrade) => string) => Object.entries(
    trades.reduce<Record<string, BacktestingTrade[]>>((groups, trade) => {
      const key = label(trade)
      groups[key] = [...(groups[key] || []), trade]
      return groups
    }, {})
  ).map(([name, rows]) => ({ name, expectancy: computeResearchMetrics(rows).expectancy, trades: rows.length }))
    .sort((left, right) => right.trades - left.trades)
    .slice(0, 8)
  const sessionData = groupExpectancy((trade) => trade.session || t('backtesting.workspace.anySession'))
  const directionData = groupExpectancy((trade) => t(`backtesting.direction.${trade.direction}`))
  const weekdayData = groupExpectancy((trade) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${trade.date}T12:00:00`)))

  if (!trades.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="subtitle1">{t('backtesting.empty.chartsTitle')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('backtesting.empty.chartsBody')}</Typography>
      </Paper>
    )
  }

  const tooltipFormatter = (value: number | string) => [`${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value))}R`]
  return (
    <Grid container spacing={1.5}>
      <Grid item xs={12} lg={7}>
        <ChartShell
          title={t('backtesting.charts.cumulativeR')}
          summary={t('backtesting.charts.cumulativeRSummary', { count: trades.length })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 12, right: 16, bottom: 4, left: -12 }}>
              <defs>
                <linearGradient id="backtesting-cumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={30} />
              <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(value) => `${value}R`} />
              <Tooltip formatter={tooltipFormatter} contentStyle={{ background: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" name={t('backtesting.metrics.cumulativeR')} stroke={theme.palette.primary.main} fill="url(#backtesting-cumulative)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>
      </Grid>
      <Grid item xs={12} lg={5}>
        <ChartShell
          title={t('backtesting.charts.drawdown')}
          summary={t('backtesting.charts.drawdownSummary')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 12, right: 16, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={30} />
              <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(value) => `${value}R`} />
              <Tooltip formatter={tooltipFormatter} contentStyle={{ background: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8 }} />
              <Line type="monotone" dataKey="drawdown" name={t('backtesting.metrics.maximumDrawdown')} stroke={theme.palette.error.main} dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>
      </Grid>
      <Grid item xs={12}>
        <ChartShell
          title={t('backtesting.charts.performanceBySource')}
          summary={t('backtesting.charts.performanceBySourceSummary')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourceData} margin={{ top: 12, right: 16, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="source" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(value) => `${value}R`} />
              <Tooltip formatter={tooltipFormatter} contentStyle={{ background: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="expectancy" name={t('backtesting.metrics.expectancy')} fill={theme.palette.secondary.main} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </Grid>
      <Grid item xs={12}>
        <Button aria-expanded={showConditions} onClick={() => setShowConditions((current) => !current)}>{showConditions ? t('backtesting.charts.hideConditionCharts') : t('backtesting.charts.showConditionCharts')}</Button>
      </Grid>
      {showConditions && <>
        <Grid item xs={12} lg={4}><BreakdownChart title={t('backtesting.charts.performanceBySession')} summary={t('backtesting.charts.performanceBySessionSummary', { count: trades.length })} data={sessionData} tooltipFormatter={tooltipFormatter} /></Grid>
        <Grid item xs={12} lg={4}><BreakdownChart title={t('backtesting.charts.resultsByDirection')} summary={t('backtesting.charts.resultsByDirectionSummary', { count: trades.length })} data={directionData} tooltipFormatter={tooltipFormatter} /></Grid>
        <Grid item xs={12} lg={4}><BreakdownChart title={t('backtesting.charts.performanceByWeekday')} summary={t('backtesting.charts.performanceByWeekdaySummary', { count: trades.length })} data={weekdayData} tooltipFormatter={tooltipFormatter} /></Grid>
      </>}
    </Grid>
  )
}

function BreakdownChart({ title, summary, data, tooltipFormatter }: { title: string; summary: string; data: Array<{ name: string; expectancy: number; trades: number }>; tooltipFormatter: (value: number | string) => string[] }) {
  const { t } = useI18n()
  const theme = useTheme()
  return <ChartShell title={title} summary={summary}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 12, right: 10, bottom: 18, left: -14 }}><CartesianGrid strokeDasharray="3 6" vertical={false} stroke={theme.palette.divider} /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={data.length > 4 ? -20 : 0} textAnchor={data.length > 4 ? 'end' : 'middle'} height={48} /><YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(value) => `${value}R`} /><Tooltip formatter={tooltipFormatter} contentStyle={{ background: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8 }} /><Bar dataKey="expectancy" name={t('backtesting.metrics.expectancy')} fill={theme.palette.primary.main} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartShell>
}

function ChartShell({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: 340 }} role="figure" aria-label={title}>
      <Stack spacing={0.25} sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{summary}</Typography>
      </Stack>
      <Box sx={{ height: 280 }}>{children}</Box>
    </Paper>
  )
}

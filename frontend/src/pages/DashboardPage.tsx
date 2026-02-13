import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { fetchDashboardSummary, fetchRecentTrades } from '../api/dashboard'
import { AnalyticsResponse } from '../api/analytics'
import { DailyPnlResponse, TradeResponse, fetchDailyPnl } from '../api/trades'
import { ApiError } from '../api/client'
import { formatCurrency } from '../utils/format'
import { useAuth } from '../auth/AuthContext'
import ErrorBanner from '../components/ui/ErrorBanner'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import KPIStatCard from '../components/dashboard/KPIStatCard'
import ChartCard from '../components/dashboard/ChartCard'
import DashboardChartTooltip from '../components/dashboard/DashboardChartTooltip'
import RecentTradesTable from '../components/dashboard/RecentTradesTable'
import { readDashboardQueryState } from '../features/dashboard/queryState'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/ui/EmptyState'
import { useDemoData } from '../features/demo/DemoDataContext'

type KpiCard = {
  label: string
  value: number | null
  formatType: 'currency' | 'percent' | 'ratio' | 'number'
  tooltipText: string
}

type DailyPnlPoint = {
  date: string
  value: number
  tradeCount?: number
}

const formatChartDateLabel = (value: string, locale: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(parsed)
}

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [summary, setSummary] = useState<AnalyticsResponse | null>(null)
  const [recentTrades, setRecentTrades] = useState<TradeResponse[]>([])
  const [dailyPnlSeries, setDailyPnlSeries] = useState<DailyPnlResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const { refreshToken } = useDemoData()
  const baseCurrency = user?.baseCurrency || 'USD'
  const timezone = user?.timezone || 'Europe/Bucharest'
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isCompact = useMediaQuery(theme.breakpoints.down('md'))
  const chartHeight = isMobile ? 220 : isCompact ? 260 : 320

  const queryState = useMemo(() => readDashboardQueryState(searchParams), [searchParams.toString()])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  const dashboardFilters = useMemo(() => ({
    from: queryState.from,
    to: queryState.to,
    status: queryState.status,
    market: (queryState.market as any) || undefined,
    accountId: queryState.accountId || undefined
  }), [queryState.accountId, queryState.from, queryState.market, queryState.status, queryState.to])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [summaryResponse, trades, dailyPnlResponse] = await Promise.all([
          fetchDashboardSummary(dashboardFilters),
          fetchRecentTrades(7, dashboardFilters),
          fetchDailyPnl({
            from: queryState.from,
            to: queryState.to,
            tz: timezone,
            basis: 'close'
          }).catch(() => [] as DailyPnlResponse[]),
        ])
        setSummary(summaryResponse)
        setRecentTrades(trades)
        setDailyPnlSeries(dailyPnlResponse)
      } catch (err) {
        const apiErr = err as ApiError
        setError(translateApiError(apiErr, t))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [dashboardFilters, queryState.from, queryState.to, t, timezone, refreshToken])

  const kpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    return [
      { label: t('dashboard.kpis.netPnl'), value: summary.kpi.totalPnlNet, formatType: 'currency', tooltipText: t('dashboard.help.kpiNetGross') },
      { label: t('dashboard.kpis.grossPnl'), value: summary.kpi.totalPnlGross, formatType: 'currency', tooltipText: t('dashboard.help.kpiNetGross') },
      { label: t('dashboard.kpis.winRate'), value: summary.kpi.winRate, formatType: 'percent', tooltipText: t('dashboard.help.kpiWinRate') },
      { label: t('dashboard.kpis.profitFactor'), value: summary.kpi.profitFactor, formatType: 'ratio', tooltipText: t('dashboard.help.kpiProfitFactor') },
      { label: t('dashboard.kpis.expectancy'), value: summary.kpi.expectancy, formatType: 'currency', tooltipText: t('dashboard.help.kpiExpectancy') },
      { label: t('dashboard.kpis.maxDrawdown'), value: -Math.abs(summary.drawdown?.maxDrawdown || 0), formatType: 'currency', tooltipText: t('dashboard.help.kpiDrawdown') },
    ]
  }, [summary, t])

  const kpiCards = useMemo<KpiCard[]>(() => {
    if (loading) {
      return Array.from({ length: 6 }, (_, idx) => ({
        label: `${t('dashboard.kpis.placeholder')} ${idx + 1}`,
        value: null,
        formatType: 'number',
        tooltipText: ''
      }))
    }
    return kpis
  }, [kpis, loading, t])

  const equityData = useMemo(() => summary?.equityCurve || [], [summary])
  const groupedPnl = useMemo<DailyPnlPoint[]>(() => {
    if (dailyPnlSeries.length > 0) {
      return dailyPnlSeries.map((point) => ({
        date: point.date,
        value: point.netPnl,
        tradeCount: point.tradeCount
      }))
    }

    return (summary?.groupedPnl || []).map((point) => ({
      date: point.date,
      value: point.value
    }))
  }, [dailyPnlSeries, summary?.groupedPnl])

  const toTradesList = useCallback(() => {
    const params = new URLSearchParams()
    params.set('openedAtFrom', queryState.from)
    params.set('openedAtTo', queryState.to)
    if (queryState.status !== 'ALL') {
      params.set('status', queryState.status)
    }
    navigate(`/trades?${params.toString()}`)
  }, [navigate, queryState.from, queryState.status, queryState.to])

  const toTradeDetail = useCallback((trade: TradeResponse) => {
    const params = new URLSearchParams()
    params.set('tradeId', trade.id)
    params.set('openedAtFrom', queryState.from)
    params.set('openedAtTo', queryState.to)
    if (queryState.status !== 'ALL') {
      params.set('status', queryState.status)
    }
    navigate(`/trades?${params.toString()}`)
  }, [navigate, queryState.from, queryState.status, queryState.to])

  const chartError = error ? t('dashboard.chartError') : ''
  const hasNoTrades = !loading && !error && (summary?.kpi?.totalTrades ?? 0) === 0 && recentTrades.length === 0
  const xAxisTickProps = useMemo(
    () => ({
      fontSize: isMobile ? 10 : 11,
      fill: theme.palette.text.secondary
    }),
    [isMobile, theme.palette.text.secondary]
  )

  return (
    <Stack
      spacing={2.5}
      sx={{
        width: '100%',
        maxWidth: '100%',
        mx: 'auto',
        minWidth: 0,
        overflowX: 'clip',
        '& > *': { minWidth: 0 },
        '& .MuiGrid-container': { width: '100%', m: 0 },
        '& .MuiGrid-item': { minWidth: 0 }
      }}
    >
      {error && <ErrorBanner message={error} />}
      {hasNoTrades && (
        <EmptyState
          title={t('dashboard.empty.noTradesTitle')}
          description={t('dashboard.empty.noTradesBody')}
          action={(
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" onClick={() => navigate('/trades')}>
                {t('dashboard.empty.importTrades')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/trades')}>
                {t('dashboard.empty.addTrade')}
              </Button>
            </Stack>
          )}
        />
      )}

      <Card>
        <CardContent sx={{ py: 1.5 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.goToTodayHint')}
            </Typography>
            <Button variant="contained" size="small" onClick={() => navigate('/today')}>
              {t('dashboard.goToToday')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ width: '100%', m: 0 }}>
        {kpiCards.map((kpi, idx) => (
          <Grid item xs={6} sm={6} md={4} key={`${kpi.label}-${idx}`}>
            <KPIStatCard
              label={kpi.label}
              value={kpi.value}
              formatType={kpi.formatType}
              tooltipText={kpi.tooltipText}
              currency={baseCurrency}
              loading={loading}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={{ xs: 0, sm: 2 }} sx={{ width: '100%', m: 0 }}>
        <Grid item xs={12} md={6}>
          <ChartCard
            title={t('dashboard.equityCurve.title')}
            subtitle={t('dashboard.equityCurve.subtitle')}
            tooltipText={t('dashboard.help.chartEquityCurve')}
            loading={loading}
            error={chartError}
            emptyTitle={t('dashboard.equityCurve.emptyTitle')}
            emptyDescription={t('dashboard.equityCurve.emptyBody')}
            height={chartHeight}
          >
            {equityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={equityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.9)} />
                  <XAxis
                    dataKey="date"
                    tick={xAxisTickProps}
                    minTickGap={isMobile ? 16 : 24}
                    tickFormatter={(value) => formatChartDateLabel(String(value), locale)}
                    interval={isMobile ? 'preserveStartEnd' : 'preserveEnd'}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v as number, baseCurrency)}
                    tick={{ ...xAxisTickProps }}
                    width={isMobile ? 56 : 72}
                  />
                  <ReferenceLine y={0} stroke={theme.palette.divider} strokeDasharray="5 5" />
                  <ChartTooltip content={<DashboardChartTooltip currency={baseCurrency} />} />
                  <Area type="monotone" dataKey="value" stroke={theme.palette.primary.main} fill={theme.palette.primary.dark} fillOpacity={0.35} />
                </AreaChart>
              </ResponsiveContainer>
            ) : undefined}
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard
            title={t('dashboard.dailyPnl.title')}
            subtitle={t('dashboard.dailyPnl.subtitle')}
            tooltipText={t('dashboard.help.chartDailyPnl')}
            loading={loading}
            error={chartError}
            emptyTitle={t('dashboard.dailyPnl.emptyTitle')}
            emptyDescription={t('dashboard.dailyPnl.emptyBody')}
            height={chartHeight}
          >
            {groupedPnl.length > 0 ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={groupedPnl}>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.9)} />
                  <XAxis
                    dataKey="date"
                    tick={xAxisTickProps}
                    minTickGap={isMobile ? 16 : 24}
                    tickFormatter={(value) => formatChartDateLabel(String(value), locale)}
                    interval={isMobile ? 'preserveStartEnd' : 'preserveEnd'}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v as number, baseCurrency)}
                    tick={{ ...xAxisTickProps }}
                    width={isMobile ? 56 : 72}
                  />
                  <ReferenceLine y={0} stroke={theme.palette.divider} strokeDasharray="5 5" />
                  <ChartTooltip content={<DashboardChartTooltip currency={baseCurrency} />} />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    fill={theme.palette.primary.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : undefined}
          </ChartCard>
        </Grid>
      </Grid>

      <RecentTradesTable
        title={t('dashboard.recentTrades.title')}
        subtitle={t('dashboard.recentTrades.subtitle')}
        trades={recentTrades}
        loading={loading}
        currency={baseCurrency}
        onViewAll={toTradesList}
        onRowClick={toTradeDetail}
      />
    </Stack>
  )
}

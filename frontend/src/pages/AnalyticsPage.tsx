import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
  Line,
} from 'recharts'
import { AdviceCard, AnalyticsFilters, AnalyticsResponse, CoachResponse, fetchAnalyticsCoach, fetchAnalyticsSummary } from '../api/analytics'
import { ApiError } from '../api/client'
import { formatCurrency, formatNumber, formatPercent, formatSignedCurrency } from '../utils/format'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import CoachAdviceCard from '../components/analytics/CoachAdviceCard'
import { useNavigate } from 'react-router-dom'

const COLORS = ['#4caf50', '#f44336', '#2196f3']
const DEFAULT_FILTERS: AnalyticsFilters = { status: 'CLOSED', dateMode: 'CLOSE' }
type KpiCard = { label: string; value: string | number }

const TabPanel = ({ value, index, children }: { value: number; index: number; children: React.ReactNode }) => {
  if (value !== index) return null
  return <Box sx={{ mt: 2 }}>{children}</Box>
}

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return '—'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  return `${hours}h`
}

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS)
  const [summary, setSummary] = useState<AnalyticsResponse | null>(null)
  const [coach, setCoach] = useState<CoachResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [coachLoading, setCoachLoading] = useState<boolean>(false)
  const [error, setError] = useState('')
  const [coachError, setCoachError] = useState('')
  const [tab, setTab] = useState(0)
  const { user } = useAuth()
  const baseCurrency = user?.baseCurrency || 'USD'
  const navigate = useNavigate()

  const loadAnalytics = async (activeFilters: AnalyticsFilters = DEFAULT_FILTERS) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAnalyticsSummary(activeFilters)
      setSummary(data)
    } catch (err) {
      const apiErr = err as ApiError
      setError(apiErr.message || 'Unable to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const loadCoach = async (activeFilters: AnalyticsFilters = DEFAULT_FILTERS) => {
    setCoachLoading(true)
    setCoachError('')
    try {
      const data = await fetchAnalyticsCoach(activeFilters)
      setCoach(data)
    } catch (err) {
      const apiErr = err as ApiError
      setCoachError(apiErr.message || 'Unable to load coach insights')
    } finally {
      setCoachLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics(DEFAULT_FILTERS)
    loadCoach(DEFAULT_FILTERS)
  }, [])

  const applyFilters = () => {
    loadAnalytics(filters)
    loadCoach(filters)
  }

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
    loadAnalytics(DEFAULT_FILTERS)
    loadCoach(DEFAULT_FILTERS)
  }

  const kpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    const grossLoss = summary.kpi.grossLoss
    const pf =
      grossLoss === 0 && summary.kpi.grossProfit > 0
        ? '∞'
        : summary.kpi.profitFactor?.toFixed(2) ?? '—'
    return [
      { label: 'Net P&L', value: formatSignedCurrency(summary.kpi.totalPnlNet, baseCurrency) },
      { label: 'Win rate', value: formatPercent(summary.kpi.winRate) },
      { label: 'Profit factor', value: pf },
      { label: 'Expectancy', value: formatSignedCurrency(summary.kpi.expectancy, baseCurrency) },
      { label: 'Trades', value: summary.kpi.totalTrades ?? 0 },
      { label: 'Open trades', value: summary.kpi.openTrades ?? 0 },
    ]
  }, [baseCurrency, summary])

  const secondaryKpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    return [
      { label: 'Gross profit', value: formatSignedCurrency(summary.kpi.grossProfit, baseCurrency) },
      { label: 'Gross loss', value: formatSignedCurrency(-Math.abs(summary.kpi.grossLoss), baseCurrency) },
      { label: 'Avg win', value: formatSignedCurrency(summary.kpi.averageWin, baseCurrency) },
      { label: 'Avg loss', value: formatSignedCurrency(-Math.abs(summary.kpi.averageLoss), baseCurrency) },
      { label: 'Median trade', value: formatSignedCurrency(summary.kpi.medianPnl, baseCurrency) },
      { label: 'Payoff ratio', value: summary.kpi.payoffRatio?.toFixed(2) ?? '—' },
    ]
  }, [baseCurrency, summary])

  const costKpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    return [
      { label: 'Fees', value: formatSignedCurrency(summary.costs.totalFees, baseCurrency) },
      { label: 'Commission', value: formatSignedCurrency(summary.costs.totalCommission, baseCurrency) },
      { label: 'Slippage', value: formatSignedCurrency(summary.costs.totalSlippage, baseCurrency) },
      { label: 'Total costs', value: formatSignedCurrency(summary.costs.totalCosts, baseCurrency) },
      { label: 'Net vs gross', value: formatSignedCurrency(summary.costs.netVsGrossDelta, baseCurrency) },
    ]
  }, [baseCurrency, summary])

  const kpiCards = loading ? Array.from({ length: 6 }, (_, idx) => ({ label: `placeholder-${idx}`, value: '' })) : kpis

  const pnlHistogram = summary?.distribution?.pnlHistogram ?? []
  const drawdownSeries = summary?.drawdownSeries ?? []
  const rolling20 = summary?.rolling20 ?? []
  const rolling50 = summary?.rolling50 ?? []

  const symbolBars = useMemo(() => {
    if (!summary) return []
    return summary.attribution.symbols.slice(0, 8)
  }, [summary])

  const heatmapData = summary?.timeEdge?.hourOfDay ?? []
  const heatmapMax = Math.max(...heatmapData.map((d) => Math.abs(d.netPnl)), 0)

  const sortedCoachAdvice = useMemo(() => {
    const advice = coach?.advice ?? []
    const severityRank = { critical: 0, warn: 1, info: 2 }
    const confidenceRank = { high: 0, medium: 1, low: 2 }
    return [...advice].sort((a, b) => {
      const severityDelta = severityRank[a.severity] - severityRank[b.severity]
      if (severityDelta !== 0) return severityDelta
      return confidenceRank[a.confidence] - confidenceRank[b.confidence]
    })
  }, [coach])

  const handleViewTrades = (card: AdviceCard) => {
    const params = new URLSearchParams()
    const dateMode = card.filters?.dateMode || filters.dateMode || 'CLOSE'
    if (filters.from) {
      if (dateMode === 'OPEN') params.set('openedAtFrom', filters.from)
      else params.set('closedAtFrom', filters.from)
    }
    if (filters.to) {
      if (dateMode === 'OPEN') params.set('openedAtTo', filters.to)
      else params.set('closedAtTo', filters.to)
    }
    if (card.filters?.symbol || filters.symbol) params.set('symbol', card.filters?.symbol || filters.symbol || '')
    if (card.filters?.direction || filters.direction) params.set('direction', card.filters?.direction || filters.direction || '')
    if (card.filters?.status || filters.status) params.set('status', card.filters?.status || filters.status || '')
    const qs = params.toString()
    navigate(`/trades${qs ? `?${qs}` : ''}`)
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Analytics"
        subtitle="Pro-grade diagnostics across performance, consistency, and edge."
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-end" flexWrap="wrap">
              <ToggleButtonGroup
                color="primary"
                exclusive
                size="small"
                value={filters.dateMode ?? 'CLOSE'}
                onChange={(_, value) => value && setFilters((prev) => ({ ...prev, dateMode: value }))}
              >
                <ToggleButton value="OPEN">Open date</ToggleButton>
                <ToggleButton value="CLOSE">Close date</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                size="small"
                label="From"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filters.from || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filters.to || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
              />
              <TextField
                size="small"
                label="Symbol"
                value={filters.symbol || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))}
              />
              <TextField
                size="small"
                label="Direction"
                select
                SelectProps={{ native: true }}
                value={filters.direction || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value as 'LONG' | 'SHORT' }))}
              >
                <option value="">Any</option>
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </TextField>
              <TextField
                size="small"
                label="Status"
                select
                SelectProps={{ native: true }}
                value={filters.status || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as 'OPEN' | 'CLOSED' }))}
              >
                <option value="CLOSED">Closed</option>
                <option value="OPEN">Open</option>
              </TextField>
              <TextField
                size="small"
                label="Market"
                select
                SelectProps={{ native: true }}
                value={filters.market || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, market: e.target.value }))}
              >
                <option value="">Any</option>
                {summary?.filterOptions?.markets?.map((mkt) => (
                  <option key={mkt} value={mkt}>{mkt}</option>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Holding bucket"
                select
                SelectProps={{ native: true }}
                value={filters.holdingBucket || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, holdingBucket: e.target.value }))}
              >
                <option value="">Any</option>
                <option value="<5m">&lt;5m</option>
                <option value="5-15m">5-15m</option>
                <option value="15-60m">15-60m</option>
                <option value="1-4h">1-4h</option>
                <option value=">4h">&gt;4h</option>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.excludeOutliers ?? false}
                    onChange={(e) => setFilters((prev) => ({ ...prev, excludeOutliers: e.target.checked }))}
                  />
                }
                label="Exclude outliers"
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Strategy</InputLabel>
                <Select
                  multiple
                  label="Strategy"
                  value={filters.strategy ?? []}
                  onChange={(e) => setFilters((prev) => ({ ...prev, strategy: e.target.value as string[] }))}
                  renderValue={(selected) => (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {(selected as string[]).map((value) => (
                        <Chip key={value} size="small" label={value} />
                      ))}
                    </Stack>
                  )}
                >
                  {summary?.filterOptions?.strategies?.map((strategy) => (
                    <MenuItem key={strategy} value={strategy}>{strategy}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Setup</InputLabel>
                <Select
                  multiple
                  label="Setup"
                  value={filters.setup ?? []}
                  onChange={(e) => setFilters((prev) => ({ ...prev, setup: e.target.value as string[] }))}
                  renderValue={(selected) => (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {(selected as string[]).map((value) => (
                        <Chip key={value} size="small" label={value} />
                      ))}
                    </Stack>
                  )}
                >
                  {summary?.filterOptions?.setups?.map((setup) => (
                    <MenuItem key={setup} value={setup}>{setup}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Catalyst</InputLabel>
                <Select
                  multiple
                  label="Catalyst"
                  value={filters.catalyst ?? []}
                  onChange={(e) => setFilters((prev) => ({ ...prev, catalyst: e.target.value as string[] }))}
                  renderValue={(selected) => (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {(selected as string[]).map((value) => (
                        <Chip key={value} size="small" label={value} />
                      ))}
                    </Stack>
                  )}
                >
                  {summary?.filterOptions?.catalysts?.map((catalyst) => (
                    <MenuItem key={catalyst} value={catalyst}>{catalyst}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={applyFilters}>Apply</Button>
                <Button variant="text" onClick={resetFilters}>Reset</Button>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      {coachError && <ErrorBanner message={coachError} />}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
        <Tab label="Overview" />
        <Tab label="Coach" />
        <Tab label="Consistency" />
        <Tab label="Time edge" />
        <Tab label="Symbols & tags" />
        <Tab label="Risk" />
        <Tab label="Data quality" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
            {kpiCards.map((kpi, idx) => (
              <Card key={kpi.label || idx} sx={{ minWidth: 200 }}>
                <CardContent>
                  {loading ? (
                    <Skeleton height={32} />
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="text.secondary">{kpi.label}</Typography>
                      <Typography variant="h5" fontWeight={700}>{kpi.value}</Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </Stack>

          <Grid container spacing={2}>
            {secondaryKpis.map((kpi) => (
              <Grid item xs={12} sm={6} md={4} key={kpi.label}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">{kpi.label}</Typography>
                    <Typography variant="h6" fontWeight={600}>{kpi.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {costKpis.map((kpi) => (
              <Grid item xs={12} sm={6} md={4} key={kpi.label}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">{kpi.label}</Typography>
                    <Typography variant="h6" fontWeight={600}>{kpi.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <Typography variant="h6">Equity curve</Typography>
                    <Tooltip title="Cumulative net P&L based on closed trades ordered by close time.">
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton variant="rectangular" height={320} />
                  ) : (summary?.equityCurve?.length ?? 0) === 0 ? (
                    <EmptyState title="No equity data" description="Adjust the filters to include a broader trade range." />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={summary?.equityCurve}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} />
                        <Area type="monotone" dataKey="value" stroke="#1976d2" fill="#bbdefb" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <Typography variant="h6">Drawdown</Typography>
                    <Tooltip title="P&L drawdown computed on cumulative net P&L (peak-to-trough).">
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton variant="rectangular" height={320} />
                  ) : drawdownSeries.length === 0 ? (
                    <EmptyState title="No drawdown data" description="Add closed trades to see drawdowns." />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={drawdownSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} />
                        <Area type="monotone" dataKey="value" stroke="#ef5350" fill="#ffcdd2" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <Typography variant="h6">P&L histogram</Typography>
                    <Tooltip title="Distribution of trade net P&L, highlighting dispersion and outliers.">
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton variant="rectangular" height={320} />
                  ) : pnlHistogram.length === 0 ? (
                    <EmptyState title="No distribution data" description="Close trades to populate the histogram." />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={pnlHistogram}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" hide />
                        <YAxis />
                        <ChartTooltip formatter={(v: number) => formatNumber(v as number)} />
                        <Bar dataKey="count" fill="#1565c0" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <Typography variant="h6">Trader read</Typography>
                    <Tooltip title="Auto-generated insights with sample size context.">
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton height={240} />
                  ) : (summary?.traderRead?.insights?.length ?? 0) === 0 ? (
                    <EmptyState title="No insights yet" description="Add more trades to surface insights." />
                  ) : (
                    <Stack spacing={1}>
                      {summary?.traderRead?.insights.map((insight, idx) => (
                        <Typography variant="body2" key={`${insight.text}-${idx}`}>• {insight.text}</Typography>
                      ))}
                    </Stack>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Drawdown highlights</Typography>
                    <Typography variant="body2">Max drawdown: {formatCurrency(summary?.drawdown?.maxDrawdown, baseCurrency)}</Typography>
                    <Typography variant="body2">Recovery factor: {summary?.drawdown?.recoveryFactor?.toFixed(2) ?? '—'}</Typography>
                    <Typography variant="body2">Ulcer index: {summary?.drawdown?.ulcerIndex?.toFixed(2) ?? '—'}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Coach insights</Typography>
            <Typography variant="body2" color="text.secondary">
              Actionable guidance from your own trade history. No AI.
            </Typography>
          </Box>
          {coachLoading && (
            <Stack spacing={2}>
              {Array.from({ length: 3 }).map((_, idx) => (
                <Card key={`coach-skeleton-${idx}`}>
                  <CardContent>
                    <Skeleton height={120} />
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
          {!coachLoading && sortedCoachAdvice.length === 0 && (
            <EmptyState title="No coach insights yet" description="Log more closed trades to unlock coach insights." />
          )}
          {!coachLoading && sortedCoachAdvice.length > 0 && (
            <Stack spacing={2}>
              {sortedCoachAdvice.map((card) => (
                <CoachAdviceCard key={card.id} card={card} currency={baseCurrency} onViewTrades={handleViewTrades} />
              ))}
            </Stack>
          )}
        </Stack>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Rolling metrics (20 trades)</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={300} />
                ) : rolling20.length === 0 ? (
                  <EmptyState title="No rolling metrics" description="Need at least 20 closed trades." />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={rolling20}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip />
                      <Line type="monotone" dataKey="winRate" stroke="#4caf50" name="Win rate" />
                      <Line type="monotone" dataKey="profitFactor" stroke="#1976d2" name="Profit factor" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Streaks & weekly</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">Max win streak: {summary?.consistency?.streaks?.maxWinStreak ?? 0}</Typography>
                  <Typography variant="body2">Max loss streak: {summary?.consistency?.streaks?.maxLossStreak ?? 0}</Typography>
                  <Typography variant="body2">Current streak: {summary?.consistency?.streaks?.currentStreakType ?? '—'} ({summary?.consistency?.streaks?.currentStreakCount ?? 0})</Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2">Green weeks: {summary?.consistency?.greenWeeks ?? 0}</Typography>
                  <Typography variant="body2">Red weeks: {summary?.consistency?.redWeeks ?? 0}</Typography>
                  <Typography variant="body2">Best day: {summary?.consistency?.bestDay?.date ?? '—'} ({formatSignedCurrency(summary?.consistency?.bestDay?.value, baseCurrency)})</Typography>
                  <Typography variant="body2">Worst day: {summary?.consistency?.worstDay?.date ?? '—'} ({formatSignedCurrency(summary?.consistency?.worstDay?.value, baseCurrency)})</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Weekly grouped P&L</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={240} />
                ) : (summary?.weeklyPnl?.length ?? 0) === 0 ? (
                  <EmptyState title="No weekly P&L" description="Close trades to see weekly results." />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={summary?.weeklyPnl}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} />
                      <Bar dataKey="value" fill="#1565c0" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>P&L by day of week</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={260} />
                ) : (summary?.timeEdge?.dayOfWeek?.length ?? 0) === 0 ? (
                  <EmptyState title="No day-of-week edge" description="Need closed trades to compute." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary?.timeEdge?.dayOfWeek}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" />
                      <YAxis />
                      <ChartTooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} />
                      <Bar dataKey="netPnl" fill="#1976d2" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Holding time buckets</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={260} />
                ) : (summary?.timeEdge?.holdingBuckets?.length ?? 0) === 0 ? (
                  <EmptyState title="No holding time data" description="Closed trades needed for holding time analytics." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary?.timeEdge?.holdingBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" />
                      <YAxis />
                      <ChartTooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} />
                      <Bar dataKey="netPnl" fill="#4caf50" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">Avg holding: {formatDuration(summary?.timeEdge?.averageHoldingSeconds)}</Typography>
                <Typography variant="body2">Median holding: {formatDuration(summary?.timeEdge?.medianHoldingSeconds)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Hour-of-day heatmap (Net P&L)</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={140} />
                ) : heatmapData.length === 0 ? (
                  <EmptyState title="No hour-of-day data" description="Close trades to see hourly edge." />
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(40px, 1fr))', gap: 0.5 }}>
                      {heatmapData.map((bucket) => {
                        const intensity = heatmapMax === 0 ? 0 : Math.abs(bucket.netPnl) / heatmapMax
                        const color = bucket.netPnl >= 0
                          ? `rgba(76, 175, 80, ${0.2 + intensity * 0.6})`
                          : `rgba(244, 67, 54, ${0.2 + intensity * 0.6})`
                        return (
                          <Tooltip key={bucket.bucket} title={`${bucket.bucket}:00 • N=${bucket.trades} • Win ${formatPercent(bucket.winRate)}`}>
                            <Box sx={{ p: 1, textAlign: 'center', borderRadius: 1, backgroundColor: color }}>
                              <Typography variant="caption">{bucket.bucket}</Typography>
                            </Box>
                          </Tooltip>
                        )
                      })}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={4}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Top symbols</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={260} />
                ) : symbolBars.length === 0 ? (
                  <EmptyState title="No symbol data" description="Close trades with symbols to populate." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={symbolBars}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} />
                      <Bar
                        dataKey="netPnl"
                        fill="#1976d2"
                        onClick={(data) => setFilters((prev) => ({ ...prev, symbol: data?.name }))}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">Top 1 P&L share: {formatPercent(summary?.attribution?.concentration?.top1PnlShare ?? null)}</Typography>
                <Typography variant="body2">Top 3 P&L share: {formatPercent(summary?.attribution?.concentration?.top3PnlShare ?? null)}</Typography>
                <Typography variant="body2">Top 1 trade share: {formatPercent(summary?.attribution?.concentration?.top1TradeShare ?? null)}</Typography>
                <Typography variant="body2">Top 3 trade share: {formatPercent(summary?.attribution?.concentration?.top3TradeShare ?? null)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Strategy leaderboard</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={260} />
                ) : (summary?.attribution?.strategies?.length ?? 0) === 0 ? (
                  <EmptyState title="No strategy tags" description="Tag trades with strategies." />
                ) : (
                  <Stack spacing={1}>
                    {summary?.attribution?.strategies?.slice(0, 6).map((row) => (
                      <Stack key={row.name} direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">{row.name}</Typography>
                          {row.lowSample && <Chip size="small" label="Low sample" />}
                        </Stack>
                        <Typography variant="body2">{formatSignedCurrency(row.netPnl, baseCurrency)} • N={row.trades}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2">What to stop doing</Typography>
                {(summary?.attribution?.bottomSymbols ?? []).map((row) => (
                  <Typography key={row.name} variant="body2">• {row.name} ({formatSignedCurrency(row.netPnl, baseCurrency)}, N={row.trades})</Typography>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={5}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Risk analytics</Typography>
            {summary?.risk?.available ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Stack spacing={1}>
                    <Typography variant="body2">Average R: {summary.risk.averageR?.toFixed(2) ?? '—'}</Typography>
                    <Typography variant="body2">Median R: {summary.risk.medianR?.toFixed(2) ?? '—'}</Typography>
                    <Typography variant="body2">Expectancy (R): {summary.risk.expectancyR?.toFixed(2) ?? '—'}</Typography>
                    <Typography variant="body2">Win rate (R&gt;0): {formatPercent(summary.risk.winRateR)}</Typography>
                    <Typography variant="body2">Avg risk amount: {formatCurrency(summary.risk.averageRiskAmount, baseCurrency)}</Typography>
                    <Typography variant="body2">Avg risk %: {formatPercent(summary.risk.averageRiskPercent)}</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle2" gutterBottom>R distribution</Typography>
                  {(summary?.risk?.rDistribution?.length ?? 0) === 0 ? (
                    <EmptyState title="No R distribution" description="Track R multiples to see this chart." />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={summary.risk.rDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" hide />
                        <YAxis />
                        <ChartTooltip />
                        <Bar dataKey="count" fill="#7b1fa2" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Grid>
              </Grid>
            ) : (
              <EmptyState
                title="Risk data not available"
                description="Start tracking stop-loss or risk fields to unlock R analytics."
              />
            )}
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tab} index={6}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Data quality</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">Missing closed_at: {summary?.dataQuality?.missingClosedAtCount ?? 0}</Typography>
                  <Typography variant="body2">Open status with closed_at: {summary?.dataQuality?.inconsistentStatusCount ?? 0}</Typography>
                  <Typography variant="body2">Missing strategy tags: {summary?.dataQuality?.missingStrategyCount ?? 0}</Typography>
                  <Typography variant="body2">Missing setup tags: {summary?.dataQuality?.missingSetupCount ?? 0}</Typography>
                  <Typography variant="body2">Missing catalyst tags: {summary?.dataQuality?.missingCatalystCount ?? 0}</Typography>
                  <Typography variant="body2">Missing pnl %: {summary?.dataQuality?.missingPnlPercentCount ?? 0}</Typography>
                  <Typography variant="body2">Missing risk fields: {summary?.dataQuality?.missingRiskCount ?? 0}</Typography>
                  <Typography variant="body2">{summary?.dataQuality?.timezoneNote}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Outlier policy</Typography>
                <Typography variant="body2">Thresholds: {formatNumber(summary?.distribution?.outlierLower ?? null)} to {formatNumber(summary?.distribution?.outlierUpper ?? null)}</Typography>
                <Typography variant="body2">Outliers detected: {summary?.distribution?.outlierCount ?? 0}</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">Exclude outliers to see sensitivity changes.</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Field explanations</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>KPIs</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Win rate</strong>: Percentage of closed trades that finished green.</Typography>
                <Typography variant="body2"><strong>Profit factor</strong>: Gross profit divided by gross loss.</Typography>
                <Typography variant="body2"><strong>Expectancy</strong>: Average net P&L per closed trade.</Typography>
                <Typography variant="body2"><strong>Payoff ratio</strong>: Avg win divided by absolute avg loss.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Time & consistency</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Drawdown</strong>: Peak-to-trough decline on cumulative net P&L.</Typography>
                <Typography variant="body2"><strong>Rolling metrics</strong>: 20-trade rolling win rate and profit factor.</Typography>
                <Typography variant="body2"><strong>Heatmap</strong>: Hour-of-day net P&L in Europe/Bucharest time.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Stack>
  )
}

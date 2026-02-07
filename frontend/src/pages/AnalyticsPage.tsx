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
  useMediaQuery,
  useTheme,
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
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'

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
  const { t } = useI18n()
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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isCompact = useMediaQuery('(max-width:560px)')
  const chartHeights = {
    large: isCompact ? 190 : isMobile ? 220 : 320,
    medium: isCompact ? 170 : isMobile ? 200 : 260,
    small: isCompact ? 150 : isMobile ? 180 : 240
  }
  const compactInputSx = isCompact
    ? {
      '& .MuiInputBase-root': { minHeight: 38 },
      '& .MuiInputBase-input': { py: 0.75 }
    }
    : {}
  const tabSx = { minHeight: isCompact ? 40 : 48, px: isCompact ? 1.5 : 2 }

  const loadAnalytics = async (activeFilters: AnalyticsFilters = DEFAULT_FILTERS) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAnalyticsSummary(activeFilters)
      setSummary(data)
    } catch (err) {
      const apiErr = err as ApiError
      setError(translateApiError(apiErr, t, 'analytics.errors.loadAnalytics'))
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
      setCoachError(translateApiError(apiErr, t, 'analytics.errors.loadCoach'))
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
      { label: t('analytics.kpis.netPnl'), value: formatSignedCurrency(summary.kpi.totalPnlNet, baseCurrency) },
      { label: t('analytics.kpis.winRate'), value: formatPercent(summary.kpi.winRate) },
      { label: t('analytics.kpis.profitFactor'), value: pf },
      { label: t('analytics.kpis.expectancy'), value: formatSignedCurrency(summary.kpi.expectancy, baseCurrency) },
      { label: t('analytics.kpis.trades'), value: summary.kpi.totalTrades ?? 0 },
      { label: t('analytics.kpis.openTrades'), value: summary.kpi.openTrades ?? 0 },
    ]
  }, [baseCurrency, summary, t])

  const secondaryKpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    return [
      { label: t('analytics.kpis.grossProfit'), value: formatSignedCurrency(summary.kpi.grossProfit, baseCurrency) },
      { label: t('analytics.kpis.grossLoss'), value: formatSignedCurrency(-Math.abs(summary.kpi.grossLoss), baseCurrency) },
      { label: t('analytics.kpis.avgWin'), value: formatSignedCurrency(summary.kpi.averageWin, baseCurrency) },
      { label: t('analytics.kpis.avgLoss'), value: formatSignedCurrency(-Math.abs(summary.kpi.averageLoss), baseCurrency) },
      { label: t('analytics.kpis.medianTrade'), value: formatSignedCurrency(summary.kpi.medianPnl, baseCurrency) },
      { label: t('analytics.kpis.payoffRatio'), value: summary.kpi.payoffRatio?.toFixed(2) ?? t('common.na') },
    ]
  }, [baseCurrency, summary, t])

  const costKpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    return [
      { label: t('analytics.kpis.fees'), value: formatSignedCurrency(summary.costs.totalFees, baseCurrency) },
      { label: t('analytics.kpis.commission'), value: formatSignedCurrency(summary.costs.totalCommission, baseCurrency) },
      { label: t('analytics.kpis.slippage'), value: formatSignedCurrency(summary.costs.totalSlippage, baseCurrency) },
      { label: t('analytics.kpis.totalCosts'), value: formatSignedCurrency(summary.costs.totalCosts, baseCurrency) },
      { label: t('analytics.kpis.netVsGross'), value: formatSignedCurrency(summary.costs.netVsGrossDelta, baseCurrency) },
    ]
  }, [baseCurrency, summary, t])

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

  const advancedFilters = (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={isCompact ? 1.5 : 2} alignItems={{ xs: 'stretch', md: 'center' }} flexWrap="wrap">
      <TextField
        size="small"
        label={t('analytics.filters.market')}
        select
        SelectProps={{ native: true }}
        value={filters.market || ''}
        onChange={(e) => setFilters((prev) => ({ ...prev, market: e.target.value }))}
        fullWidth={isMobile}
        sx={{ minWidth: { xs: '100%', sm: 160 }, ...compactInputSx }}
      >
        <option value="">{t('trades.filters.any')}</option>
        {summary?.filterOptions?.markets?.map((mkt) => (
          <option key={mkt} value={mkt}>{mkt}</option>
        ))}
      </TextField>
      <TextField
        size="small"
        label={t('analytics.filters.holdingBucket')}
        select
        SelectProps={{ native: true }}
        value={filters.holdingBucket || ''}
        onChange={(e) => setFilters((prev) => ({ ...prev, holdingBucket: e.target.value }))}
        fullWidth={isMobile}
        sx={{ minWidth: { xs: '100%', sm: 160 }, ...compactInputSx }}
      >
        <option value="">{t('trades.filters.any')}</option>
        <option value="<5m">&lt;5m</option>
        <option value="5-15m">5-15m</option>
        <option value="15-60m">15-60m</option>
        <option value="1-4h">1-4h</option>
        <option value=">4h">&gt;4h</option>
      </TextField>
      <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, ...compactInputSx }} fullWidth={isMobile}>
        <InputLabel>{t('analytics.filters.strategy')}</InputLabel>
        <Select
          multiple
          label={t('analytics.filters.strategy')}
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
      <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, ...compactInputSx }} fullWidth={isMobile}>
        <InputLabel>{t('analytics.filters.setup')}</InputLabel>
        <Select
          multiple
          label={t('analytics.filters.setup')}
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
      <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, ...compactInputSx }} fullWidth={isMobile}>
        <InputLabel>{t('analytics.filters.catalyst')}</InputLabel>
        <Select
          multiple
          label={t('analytics.filters.catalyst')}
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
      <FormControlLabel
        sx={{ ml: 0 }}
        control={
          <Switch
            checked={filters.excludeOutliers ?? false}
            onChange={(e) => setFilters((prev) => ({ ...prev, excludeOutliers: e.target.checked }))}
          />
        }
        label={t('analytics.filters.excludeOutliers')}
      />
    </Stack>
  )

  const filterActions = (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
      <Button variant="contained" onClick={applyFilters} fullWidth={isMobile}>{t('common.apply')}</Button>
      <Button variant="text" onClick={resetFilters} fullWidth={isMobile}>{t('common.reset')}</Button>
    </Stack>
  )

  return (
    <Stack spacing={isCompact ? 2 : 3}>
      <PageHeader
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
      />

      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Stack spacing={isCompact ? 1.5 : 2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={isCompact ? 1 : 2} alignItems={{ xs: 'stretch', md: 'flex-end' }} flexWrap="wrap">
              <ToggleButtonGroup
                color="primary"
                exclusive
                size="small"
                value={filters.dateMode ?? 'CLOSE'}
                onChange={(_, value) => value && setFilters((prev) => ({ ...prev, dateMode: value }))}
                sx={{
                  flexWrap: 'wrap',
                  width: { xs: '100%', sm: 'auto' },
                  '& .MuiToggleButton-root': { minHeight: isCompact ? 34 : 36, flex: { xs: 1, sm: '0 0 auto' } }
                }}
              >
                <ToggleButton value="OPEN">{t('analytics.filters.openDate')}</ToggleButton>
                <ToggleButton value="CLOSE">{t('analytics.filters.closeDate')}</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                size="small"
                label={t('analytics.filters.from')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filters.from || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                fullWidth={isMobile}
                sx={{ minWidth: { xs: '100%', sm: 140 }, ...compactInputSx }}
              />
              <TextField
                size="small"
                label={t('analytics.filters.to')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filters.to || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                fullWidth={isMobile}
                sx={{ minWidth: { xs: '100%', sm: 140 }, ...compactInputSx }}
              />
              <TextField
                size="small"
                label={t('analytics.filters.symbol')}
                value={filters.symbol || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))}
                fullWidth={isMobile}
                sx={{ minWidth: { xs: '100%', sm: 140 }, ...compactInputSx }}
              />
              <TextField
                size="small"
                label={t('analytics.filters.direction')}
                select
                SelectProps={{ native: true }}
                value={filters.direction || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value as 'LONG' | 'SHORT' }))}
                fullWidth={isMobile}
                sx={{ minWidth: { xs: '100%', sm: 140 }, ...compactInputSx }}
              >
                <option value="">{t('trades.filters.any')}</option>
                <option value="LONG">{t('trades.direction.LONG')}</option>
                <option value="SHORT">{t('trades.direction.SHORT')}</option>
              </TextField>
              <TextField
                size="small"
                label={t('analytics.filters.status')}
                select
                SelectProps={{ native: true }}
                value={filters.status || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as 'OPEN' | 'CLOSED' }))}
                fullWidth={isMobile}
                sx={{ minWidth: { xs: '100%', sm: 140 }, ...compactInputSx }}
              >
                <option value="CLOSED">{t('trades.status.CLOSED')}</option>
                <option value="OPEN">{t('trades.status.OPEN')}</option>
              </TextField>
            </Stack>
            {isMobile ? (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('analytics.filters.advanced')}</AccordionSummary>
                <AccordionDetails>
                  {advancedFilters}
                </AccordionDetails>
              </Accordion>
            ) : (
              advancedFilters
            )}
            {filterActions}
          </Stack>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      {coachError && <ErrorBanner message={coachError} />}

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons={isCompact ? false : 'auto'}
        allowScrollButtonsMobile
        sx={{
          minHeight: isCompact ? 40 : 48,
          '& .MuiTabs-scroller': { overflowX: 'auto' },
          '& .MuiTabs-flexContainer': { gap: isCompact ? 1 : 2, px: isCompact ? 0.5 : 0 }
        }}
      >
        <Tab label={t('analytics.tabs.overview')} sx={tabSx} />
        <Tab label={t('analytics.tabs.coach')} sx={tabSx} />
        <Tab label={t('analytics.tabs.consistency')} sx={tabSx} />
        <Tab label={t('analytics.tabs.timeEdge')} sx={tabSx} />
        <Tab label={t('analytics.tabs.symbolsAndTags')} sx={tabSx} />
        <Tab label={t('analytics.tabs.risk')} sx={tabSx} />
        <Tab label={t('analytics.tabs.dataQuality')} sx={tabSx} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
            {kpiCards.map((kpi, idx) => (
              <Card key={kpi.label || idx} sx={{ minWidth: { xs: 160, sm: 200 } }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  {loading ? (
                    <Skeleton height={32} />
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                        {kpi.label}
                      </Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>
                        {kpi.value}
                      </Typography>
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                      {kpi.label}
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '1rem', sm: '1.2rem' } }}>
                      {kpi.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {costKpis.map((kpi) => (
              <Grid item xs={12} sm={6} md={4} key={kpi.label}>
                <Card>
                  <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                      {kpi.label}
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '1rem', sm: '1.2rem' } }}>
                      {kpi.value}
                    </Typography>
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
                    <Typography variant="h6">{t('analytics.overview.equityCurve.title')}</Typography>
                    <Tooltip title={t('analytics.overview.equityCurve.tooltip')}>
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton variant="rectangular" height={chartHeights.large} />
                  ) : (summary?.equityCurve?.length ?? 0) === 0 ? (
                    <EmptyState title={t('analytics.overview.equityCurve.emptyTitle')} description={t('analytics.overview.equityCurve.emptyBody')} />
                  ) : (
                    <ResponsiveContainer width="100%" height={chartHeights.large}>
                      <AreaChart data={summary?.equityCurve}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} minTickGap={isMobile ? 12 : 20} />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
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
                    <Typography variant="h6">{t('analytics.overview.drawdown.title')}</Typography>
                    <Tooltip title={t('analytics.overview.drawdown.tooltip')}>
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton variant="rectangular" height={chartHeights.large} />
                  ) : drawdownSeries.length === 0 ? (
                    <EmptyState title={t('analytics.overview.drawdown.emptyTitle')} description={t('analytics.overview.drawdown.emptyBody')} />
                  ) : (
                    <ResponsiveContainer width="100%" height={chartHeights.large}>
                      <AreaChart data={drawdownSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} minTickGap={isMobile ? 12 : 20} />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
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
                    <Typography variant="h6">{t('analytics.overview.histogram.title')}</Typography>
                    <Tooltip title={t('analytics.overview.histogram.tooltip')}>
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton variant="rectangular" height={chartHeights.large} />
                  ) : pnlHistogram.length === 0 ? (
                    <EmptyState title={t('analytics.overview.histogram.emptyTitle')} description={t('analytics.overview.histogram.emptyBody')} />
                  ) : (
                    <ResponsiveContainer width="100%" height={chartHeights.large}>
                      <BarChart data={pnlHistogram}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" hide />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
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
                    <Typography variant="h6">{t('analytics.overview.traderRead.title')}</Typography>
                    <Tooltip title={t('analytics.overview.traderRead.tooltip')}>
                      <IconButton size="small"><InfoOutlinedIcon fontSize="inherit" /></IconButton>
                    </Tooltip>
                  </Stack>
                  {loading ? (
                    <Skeleton height={240} />
                  ) : (summary?.traderRead?.insights?.length ?? 0) === 0 ? (
                    <EmptyState title={t('analytics.overview.traderRead.emptyTitle')} description={t('analytics.overview.traderRead.emptyBody')} />
                  ) : (
                    <Stack spacing={1}>
                      {summary?.traderRead?.insights.map((insight, idx) => (
                        <Typography variant="body2" key={`${insight.text}-${idx}`}>• {insight.text}</Typography>
                      ))}
                    </Stack>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">{t('analytics.overview.drawdownHighlights.title')}</Typography>
                    <Typography variant="body2">{t('analytics.overview.drawdownHighlights.maxDrawdown')}: {formatCurrency(summary?.drawdown?.maxDrawdown, baseCurrency)}</Typography>
                    <Typography variant="body2">{t('analytics.overview.drawdownHighlights.recoveryFactor')}: {summary?.drawdown?.recoveryFactor?.toFixed(2) ?? t('common.na')}</Typography>
                    <Typography variant="body2">{t('analytics.overview.drawdownHighlights.ulcerIndex')}: {summary?.drawdown?.ulcerIndex?.toFixed(2) ?? t('common.na')}</Typography>
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
            <Typography variant="h6" fontWeight={700}>{t('analytics.coachSection.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('analytics.coachSection.subtitle')}
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
            <EmptyState title={t('analytics.coachSection.emptyTitle')} description={t('analytics.coachSection.emptyBody')} />
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
                <Typography variant="h6" gutterBottom>{t('analytics.consistency.rollingMetrics.title')}</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={chartHeights.medium} />
                ) : rolling20.length === 0 ? (
                  <EmptyState title={t('analytics.consistency.rollingMetrics.emptyTitle')} description={t('analytics.consistency.rollingMetrics.emptyBody')} />
                ) : (
                  <ResponsiveContainer width="100%" height={chartHeights.medium}>
                    <LineChart data={rolling20}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} minTickGap={isMobile ? 12 : 20} />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <ChartTooltip />
                      <Line type="monotone" dataKey="winRate" stroke="#4caf50" name={t('analytics.kpis.winRate')} />
                      <Line type="monotone" dataKey="profitFactor" stroke="#1976d2" name={t('analytics.kpis.profitFactor')} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>{t('analytics.consistency.streaks.title')}</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">{t('analytics.consistency.streaks.maxWin')}: {summary?.consistency?.streaks?.maxWinStreak ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.consistency.streaks.maxLoss')}: {summary?.consistency?.streaks?.maxLossStreak ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.consistency.streaks.current')}: {summary?.consistency?.streaks?.currentStreakType ?? t('common.na')} ({summary?.consistency?.streaks?.currentStreakCount ?? 0})</Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2">{t('analytics.consistency.streaks.greenWeeks')}: {summary?.consistency?.greenWeeks ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.consistency.streaks.redWeeks')}: {summary?.consistency?.redWeeks ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.consistency.streaks.bestDay')}: {summary?.consistency?.bestDay?.date ?? t('common.na')} ({formatSignedCurrency(summary?.consistency?.bestDay?.value, baseCurrency)})</Typography>
                  <Typography variant="body2">{t('analytics.consistency.streaks.worstDay')}: {summary?.consistency?.worstDay?.date ?? t('common.na')} ({formatSignedCurrency(summary?.consistency?.worstDay?.value, baseCurrency)})</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>{t('analytics.consistency.weeklyPnl.title')}</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={chartHeights.small} />
                ) : (summary?.weeklyPnl?.length ?? 0) === 0 ? (
                  <EmptyState title={t('analytics.consistency.weeklyPnl.emptyTitle')} description={t('analytics.consistency.weeklyPnl.emptyBody')} />
                ) : (
                  <ResponsiveContainer width="100%" height={chartHeights.small}>
                    <BarChart data={summary?.weeklyPnl}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} minTickGap={isMobile ? 12 : 20} />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
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
                <Typography variant="h6" gutterBottom>{t('analytics.timeEdge.dayOfWeek.title')}</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={chartHeights.medium} />
                ) : (summary?.timeEdge?.dayOfWeek?.length ?? 0) === 0 ? (
                  <EmptyState title={t('analytics.timeEdge.dayOfWeek.emptyTitle')} description={t('analytics.timeEdge.dayOfWeek.emptyBody')} />
                ) : (
                  <ResponsiveContainer width="100%" height={chartHeights.medium}>
                    <BarChart data={summary?.timeEdge?.dayOfWeek}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" tick={{ fontSize: isMobile ? 10 : 12 }} minTickGap={isMobile ? 12 : 20} />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
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
                <Typography variant="h6" gutterBottom>{t('analytics.timeEdge.holdingBuckets.title')}</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={chartHeights.medium} />
                ) : (summary?.timeEdge?.holdingBuckets?.length ?? 0) === 0 ? (
                  <EmptyState title={t('analytics.timeEdge.holdingBuckets.emptyTitle')} description={t('analytics.timeEdge.holdingBuckets.emptyBody')} />
                ) : (
                  <ResponsiveContainer width="100%" height={chartHeights.medium}>
                    <BarChart data={summary?.timeEdge?.holdingBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" tick={{ fontSize: isMobile ? 10 : 12 }} minTickGap={isMobile ? 12 : 20} />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <ChartTooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} />
                      <Bar dataKey="netPnl" fill="#4caf50" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">{t('analytics.timeEdge.holdingBuckets.avgHolding')}: {formatDuration(summary?.timeEdge?.averageHoldingSeconds)}</Typography>
                <Typography variant="body2">{t('analytics.timeEdge.holdingBuckets.medianHolding')}: {formatDuration(summary?.timeEdge?.medianHoldingSeconds)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>{t('analytics.timeEdge.hourHeatmap.title')}</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={chartHeights.small} />
                ) : heatmapData.length === 0 ? (
                  <EmptyState title={t('analytics.timeEdge.hourHeatmap.emptyTitle')} description={t('analytics.timeEdge.hourHeatmap.emptyBody')} />
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(24, minmax(32px, 1fr))', sm: 'repeat(24, minmax(40px, 1fr))' }, gap: 0.5 }}>
                      {heatmapData.map((bucket) => {
                        const intensity = heatmapMax === 0 ? 0 : Math.abs(bucket.netPnl) / heatmapMax
                        const color = bucket.netPnl >= 0
                          ? `rgba(76, 175, 80, ${0.2 + intensity * 0.6})`
                          : `rgba(244, 67, 54, ${0.2 + intensity * 0.6})`
                        return (
                          <Tooltip key={bucket.bucket} title={t('analytics.timeEdge.hourHeatmap.tooltip', { hour: bucket.bucket, trades: bucket.trades, winRate: formatPercent(bucket.winRate) })}>
                            <Box sx={{ p: { xs: 0.5, sm: 1 }, textAlign: 'center', borderRadius: 1, backgroundColor: color }}>
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
                <Typography variant="h6" gutterBottom>{t('analytics.symbols.topSymbols.title')}</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={chartHeights.medium} />
                ) : symbolBars.length === 0 ? (
                  <EmptyState title={t('analytics.symbols.topSymbols.emptyTitle')} description={t('analytics.symbols.topSymbols.emptyBody')} />
                ) : (
                  <ResponsiveContainer width="100%" height={chartHeights.medium}>
                    <BarChart data={symbolBars}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} minTickGap={isMobile ? 12 : 20} />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
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
                <Typography variant="body2">{t('analytics.symbols.topSymbols.top1PnlShare')}: {formatPercent(summary?.attribution?.concentration?.top1PnlShare ?? null)}</Typography>
                <Typography variant="body2">{t('analytics.symbols.topSymbols.top3PnlShare')}: {formatPercent(summary?.attribution?.concentration?.top3PnlShare ?? null)}</Typography>
                <Typography variant="body2">{t('analytics.symbols.topSymbols.top1TradeShare')}: {formatPercent(summary?.attribution?.concentration?.top1TradeShare ?? null)}</Typography>
                <Typography variant="body2">{t('analytics.symbols.topSymbols.top3TradeShare')}: {formatPercent(summary?.attribution?.concentration?.top3TradeShare ?? null)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>{t('analytics.symbols.strategyLeaderboard.title')}</Typography>
                {loading ? (
                  <Skeleton variant="rectangular" height={chartHeights.medium} />
                ) : (summary?.attribution?.strategies?.length ?? 0) === 0 ? (
                  <EmptyState title={t('analytics.symbols.strategyLeaderboard.emptyTitle')} description={t('analytics.symbols.strategyLeaderboard.emptyBody')} />
                ) : (
                  <Stack spacing={1}>
                    {summary?.attribution?.strategies?.slice(0, 6).map((row) => (
                      <Stack key={row.name} direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">{row.name}</Typography>
                          {row.lowSample && <Chip size="small" label={t('analytics.symbols.strategyLeaderboard.lowSample')} />}
                        </Stack>
                        <Typography variant="body2">{formatSignedCurrency(row.netPnl, baseCurrency)} • N={row.trades}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2">{t('analytics.symbols.strategyLeaderboard.stopDoing')}</Typography>
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
            <Typography variant="h6" gutterBottom>{t('analytics.risk.title')}</Typography>
            {summary?.risk?.available ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Stack spacing={1}>
                    <Typography variant="body2">{t('analytics.risk.averageR')}: {summary.risk.averageR?.toFixed(2) ?? t('common.na')}</Typography>
                    <Typography variant="body2">{t('analytics.risk.medianR')}: {summary.risk.medianR?.toFixed(2) ?? t('common.na')}</Typography>
                    <Typography variant="body2">{t('analytics.risk.expectancyR')}: {summary.risk.expectancyR?.toFixed(2) ?? t('common.na')}</Typography>
                    <Typography variant="body2">{t('analytics.risk.winRateR')}: {formatPercent(summary.risk.winRateR)}</Typography>
                    <Typography variant="body2">{t('analytics.risk.avgRiskAmount')}: {formatCurrency(summary.risk.averageRiskAmount, baseCurrency)}</Typography>
                    <Typography variant="body2">{t('analytics.risk.avgRiskPercent')}: {formatPercent(summary.risk.averageRiskPercent)}</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle2" gutterBottom>{t('analytics.risk.rDistribution.title')}</Typography>
                  {(summary?.risk?.rDistribution?.length ?? 0) === 0 ? (
                    <EmptyState title={t('analytics.risk.rDistribution.emptyTitle')} description={t('analytics.risk.rDistribution.emptyBody')} />
                  ) : (
                    <ResponsiveContainer width="100%" height={chartHeights.small}>
                      <BarChart data={summary.risk.rDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" hide />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <ChartTooltip />
                        <Bar dataKey="count" fill="#7b1fa2" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Grid>
              </Grid>
            ) : (
              <EmptyState
                title={t('analytics.risk.unavailableTitle')}
                description={t('analytics.risk.unavailableBody')}
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
                <Typography variant="h6" gutterBottom>{t('analytics.dataQuality.title')}</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">{t('analytics.dataQuality.missingClosedAt')}: {summary?.dataQuality?.missingClosedAtCount ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.dataQuality.inconsistentStatus')}: {summary?.dataQuality?.inconsistentStatusCount ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.dataQuality.missingStrategy')}: {summary?.dataQuality?.missingStrategyCount ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.dataQuality.missingSetup')}: {summary?.dataQuality?.missingSetupCount ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.dataQuality.missingCatalyst')}: {summary?.dataQuality?.missingCatalystCount ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.dataQuality.missingPnlPercent')}: {summary?.dataQuality?.missingPnlPercentCount ?? 0}</Typography>
                  <Typography variant="body2">{t('analytics.dataQuality.missingRisk')}: {summary?.dataQuality?.missingRiskCount ?? 0}</Typography>
                  <Typography variant="body2">{summary?.dataQuality?.timezoneNote}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>{t('analytics.dataQuality.outlierPolicy.title')}</Typography>
                <Typography variant="body2">{t('analytics.dataQuality.outlierPolicy.thresholds')}: {formatNumber(summary?.distribution?.outlierLower ?? null)} {t('analytics.dataQuality.outlierPolicy.to')} {formatNumber(summary?.distribution?.outlierUpper ?? null)}</Typography>
                <Typography variant="body2">{t('analytics.dataQuality.outlierPolicy.outliersDetected')}: {summary?.distribution?.outlierCount ?? 0}</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">{t('analytics.dataQuality.outlierPolicy.hint')}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('analytics.help.title')}</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('analytics.help.kpis.title')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('analytics.kpis.winRate')}</strong>: {t('analytics.help.kpis.winRate')}</Typography>
                <Typography variant="body2"><strong>{t('analytics.kpis.profitFactor')}</strong>: {t('analytics.help.kpis.profitFactor')}</Typography>
                <Typography variant="body2"><strong>{t('analytics.kpis.expectancy')}</strong>: {t('analytics.help.kpis.expectancy')}</Typography>
                <Typography variant="body2"><strong>{t('analytics.kpis.payoffRatio')}</strong>: {t('analytics.help.kpis.payoffRatio')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('analytics.help.timeConsistency.title')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('analytics.overview.drawdown.title')}</strong>: {t('analytics.help.timeConsistency.drawdown')}</Typography>
                <Typography variant="body2"><strong>{t('analytics.consistency.rollingMetrics.title')}</strong>: {t('analytics.help.timeConsistency.rollingMetrics')}</Typography>
                <Typography variant="body2"><strong>{t('analytics.timeEdge.hourHeatmap.title')}</strong>: {t('analytics.help.timeConsistency.heatmap')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Stack>
  )
}

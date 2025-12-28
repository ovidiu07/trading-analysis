import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { AnalyticsFilters, AnalyticsResponse, fetchAnalyticsSummary } from '../api/analytics'
import { ApiError } from '../api/client'
import { formatCurrency, formatPercent, formatSignedCurrency } from '../utils/format'

const COLORS = ['#4caf50', '#f44336', '#2196f3']
type KpiCard = { label: string; value: string | number }

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({})
  const [summary, setSummary] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState('')

  const loadAnalytics = async (activeFilters: AnalyticsFilters = {}) => {
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

  useEffect(() => {
    loadAnalytics()
  }, [])

  const applyFilters = () => {
    loadAnalytics(filters)
  }

  const resetFilters = () => {
    setFilters({})
    loadAnalytics()
  }

  const breakdownData = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.breakdown || {}).map(([name, value]) => ({ name, value }))
  }, [summary])

  const kpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    return [
      { label: 'Net P&L', value: formatSignedCurrency(summary.kpi.totalPnlNet) },
      { label: 'Win rate', value: formatPercent(summary.kpi.winRate) },
      { label: 'Profit factor', value: summary.kpi.profitFactor?.toFixed(2) ?? '—' },
      { label: 'Expectancy', value: formatSignedCurrency(summary.kpi.expectancy) },
      { label: 'Trades', value: summary.kpi.totalTrades ?? summary.kpi.winningTrades ?? 0 },
      { label: 'Open trades', value: summary.kpi.openTrades ?? 0 },
    ]
  }, [summary])

  const kpiCards = loading
    ? Array.from({ length: 6 }, (_, idx) => ({ label: `placeholder-${idx}`, value: '' }))
    : kpis

  const winLossData = useMemo(() => {
    if (!summary) return []
    const wins = summary.kpi.winningTrades ?? Math.round((summary.kpi.winRate / 100) * (summary.kpi.totalTrades ?? 100))
    const losses = summary.kpi.losingTrades ?? Math.round((summary.kpi.lossRate / 100) * (summary.kpi.totalTrades ?? 100))
    const remainder = Math.max((summary.kpi.totalTrades ?? wins + losses) - (wins + losses), 0)
    return [
      { name: 'Wins', value: wins },
      { name: 'Losses', value: losses },
      { name: 'Breakeven', value: remainder },
    ].filter((item) => item.value > 0)
  }, [summary])

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" gutterBottom>Analytics</Typography>
        <Typography variant="subtitle1" color="text.secondary">Deep dive into performance, distribution, and win/loss behaviour.</Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-end">
            <TextField
              label="From"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.from || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
            <TextField
              label="To"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={filters.to || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
            <TextField
              label="Symbol"
              value={filters.symbol || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))}
            />
            <TextField
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
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={applyFilters}>Apply</Button>
              <Button variant="text" onClick={resetFilters}>Reset</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {kpiCards.map((kpi, idx) => (
          <Grid item xs={12} sm={6} md={4} key={kpi.label || idx}>
            <Card>
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
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Equity curve</Typography>
              {loading ? (
                <Skeleton variant="rectangular" height={320} />
              ) : (summary?.equityCurve?.length ?? 0) === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>No equity data for this range.</Box>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={summary?.equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatCurrency(v as number)} />
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
              <Typography variant="h6" gutterBottom>Win vs Loss</Typography>
              {loading ? (
                <Skeleton variant="rectangular" height={320} />
              ) : winLossData.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>No trades available.</Box>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={winLossData} dataKey="value" nameKey="name" outerRadius={110} label>
                      {winLossData.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
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
              <Typography variant="h6" gutterBottom>P&L by strategy</Typography>
              {loading ? (
                <Skeleton variant="rectangular" height={320} />
              ) : breakdownData.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>No strategy breakdown for this range.</Box>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={breakdownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatCurrency(v as number)} />
                    <Bar dataKey="value" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Daily grouped P&L</Typography>
              {loading ? (
                <Skeleton variant="rectangular" height={320} />
              ) : (summary?.groupedPnl?.length ?? 0) === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>No grouped P&L for this range.</Box>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={summary?.groupedPnl}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatCurrency(v as number)} />
                    <Bar dataKey="value" fill="#1565c0" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Field explanations</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>KPIs</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Win rate</strong>: Percentage of trades that closed profitably.</Typography>
                <Typography variant="body2"><strong>Profit factor</strong>: Gross profit divided by gross loss.</Typography>
                <Typography variant="body2"><strong>Expectancy</strong>: Average net P&L per trade; positive values suggest an edge.</Typography>
                <Typography variant="body2"><strong>Trades/Open trades</strong>: Total trades in the range and those still open.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Charts</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Equity curve</strong>: Cumulative net P&L over the selected period.</Typography>
                <Typography variant="body2"><strong>Win vs Loss</strong>: Distribution of winning, losing, and flat trades.</Typography>
                <Typography variant="body2"><strong>P&L by strategy</strong>: Net P&L aggregated by strategy tag.</Typography>
                <Typography variant="body2"><strong>Daily grouped P&L</strong>: Net P&L summed by open date.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Stack>
  )
}

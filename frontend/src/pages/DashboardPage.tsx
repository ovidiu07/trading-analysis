import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  Divider,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchDashboardSummary, fetchRecentTrades } from '../api/dashboard'
import { AnalyticsResponse } from '../api/analytics'
import { TradeResponse } from '../api/trades'
import { ApiError } from '../api/client'
import { formatCurrency, formatDateTime, formatPercent, formatSignedCurrency } from '../utils/format'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'

type KpiCard = { label: string; value: string | number }

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsResponse | null>(null)
  const [recentTrades, setRecentTrades] = useState<TradeResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const baseCurrency = user?.baseCurrency || 'USD'
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isCompact = useMediaQuery('(max-width:560px)')
  const chartHeight = isCompact ? 180 : isMobile ? 240 : 320
  const compactGap = theme.spacing(1.5)
  const dashboardSx = isCompact
    ? {
      width: '100%',
      mx: 'auto',
      '& .MuiGrid-container': {
        width: '100%',
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        columnGap: compactGap,
        rowGap: compactGap
      },
      '& .MuiGrid-item': {
        paddingLeft: 0,
        paddingTop: 0
      }
    }
    : { width: '100%', mx: 'auto' }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [summaryResponse, trades] = await Promise.all([
          fetchDashboardSummary(),
          fetchRecentTrades(5),
        ])
        setSummary(summaryResponse)
        setRecentTrades(trades)
      } catch (err) {
        const apiErr = err as ApiError
        setError(apiErr.message || 'Unable to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const kpis = useMemo<KpiCard[]>(() => {
    if (!summary) return []
    return [
      { label: 'Net P&L', value: formatSignedCurrency(summary.kpi.totalPnlNet, baseCurrency) },
      { label: 'Gross P&L', value: formatSignedCurrency(summary.kpi.totalPnlGross, baseCurrency) },
      { label: 'Win rate', value: formatPercent(summary.kpi.winRate) },
      { label: 'Profit factor', value: summary.kpi.profitFactor?.toFixed(2) ?? '—' },
      { label: 'Expectancy', value: formatSignedCurrency(summary.kpi.expectancy, baseCurrency) },
      { label: 'Max drawdown', value: formatSignedCurrency(-Math.abs(summary.drawdown?.maxDrawdown || 0), baseCurrency) },
    ]
  }, [baseCurrency, summary])

  const kpiCards = loading
    ? Array.from({ length: 6 }, (_, idx) => ({ label: `placeholder-${idx}`, value: '' }))
    : kpis

  const equityData = useMemo(() => summary?.equityCurve || [], [summary])
  const groupedPnl = useMemo(() => summary?.groupedPnl || [], [summary])

  return (
    <Stack spacing={isCompact ? 2 : 3} sx={dashboardSx}>
      {!isCompact && (
        <PageHeader
          title="Dashboard"
          subtitle="Live view of your trading performance, equity growth, and most recent executions."
        />
      )}

      {error && <ErrorBanner message={error} />}

      <Grid container spacing={isCompact ? 0 : 2}>
        {kpiCards.map((kpi, idx) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={kpi.label || idx}>
            <Card>
              <CardContent sx={{ p: isCompact ? 1.25 : { xs: 1.5, sm: 2.5 } }}>
                {loading ? (
                  <>
                    <Skeleton width="50%" />
                    <Skeleton width="70%" height={32} />
                  </>
                ) : (
                  <>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      title={kpi.label}
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' }, whiteSpace: 'normal' }}
                    >
                      {kpi.label}
                    </Typography>
                    <Typography
                      variant="h5"
                      fontWeight={700}
                      sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                    >
                      {kpi.value}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={isCompact ? 0 : 2}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: isCompact ? 1.5 : { xs: 2, sm: 2.5 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" mb={isCompact ? 1.5 : 2} spacing={0.5}>
                <Typography variant="h6">Equity curve</Typography>
                <Typography variant="body2" color="text.secondary">Cumulative P&L over time</Typography>
              </Stack>
              {loading ? (
                <Skeleton variant="rectangular" height={chartHeight} />
              ) : equityData.length === 0 ? (
                <EmptyState
                  title="No equity curve yet"
                  description="Capture a few trades to see cumulative performance over time."
                />
              ) : (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart data={equityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: isCompact ? 9 : isMobile ? 10 : 12 }} minTickGap={isCompact ? 6 : isMobile ? 8 : 20} />
                    <YAxis tickFormatter={(v) => formatCurrency(v as number, baseCurrency)} tick={{ fontSize: isCompact ? 9 : isMobile ? 10 : 12 }} width={isCompact ? 48 : undefined} />
                    <Tooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} labelFormatter={(label) => label as string} />
                    <Area type="monotone" dataKey="value" stroke="#1976d2" fill="#bbdefb" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: isCompact ? 1.5 : { xs: 2, sm: 2.5 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" mb={isCompact ? 1.5 : 2} spacing={0.5}>
                <Typography variant="h6">Daily P&L</Typography>
                <Typography variant="body2" color="text.secondary">Grouped by day</Typography>
              </Stack>
              {loading ? (
                <Skeleton variant="rectangular" height={chartHeight} />
              ) : groupedPnl.length === 0 ? (
                <EmptyState
                  title="No grouped P&L data"
                  description="Daily P&L will appear once trades are closed."
                />
              ) : (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={groupedPnl}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: isCompact ? 9 : isMobile ? 10 : 12 }} minTickGap={isCompact ? 6 : isMobile ? 8 : 20} />
                    <YAxis tickFormatter={(v) => formatCurrency(v as number, baseCurrency)} tick={{ fontSize: isCompact ? 9 : isMobile ? 10 : 12 }} width={isCompact ? 48 : undefined} />
                    <Tooltip formatter={(v: number) => formatCurrency(v as number, baseCurrency)} labelFormatter={(label) => label as string} />
                    <Bar dataKey="value" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: isCompact ? 1.5 : { xs: 2, sm: 2.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" mb={1} spacing={0.5}>
            <Typography variant="h6">Recent trades</Typography>
            <Typography variant="body2" color="text.secondary">Newest first</Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {loading ? (
            <Skeleton variant="rectangular" height={210} />
          ) : recentTrades.length === 0 ? (
            <Typography color="text.secondary">No trades have been recorded yet.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size={isMobile ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>Symbol</TableCell>
                  <TableCell sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>Direction</TableCell>
                  <TableCell sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>Status</TableCell>
                  <TableCell sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>Opened</TableCell>
                  <TableCell align="right" sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>PnL (net)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentTrades.map((trade) => (
                  <TableRow key={trade.id} hover>
                    <TableCell sx={{ fontWeight: 600, py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>{trade.symbol}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={trade.direction}
                        color={trade.direction === 'LONG' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>{trade.status}</TableCell>
                    <TableCell sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5 }}>{formatDateTime(trade.openedAt)}</TableCell>
                    <TableCell align="right" sx={{ py: isCompact ? 0.5 : isMobile ? 0.75 : 1.5, color: (trade.pnlNet || 0) >= 0 ? 'success.main' : 'error.main' }}>
                      {formatSignedCurrency(trade.pnlNet ?? 0, baseCurrency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Field explanations</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Key performance indicators</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Net/Gross P&L</strong>: Total profit or loss after (net) or before (gross) costs.</Typography>
                <Typography variant="body2"><strong>Win rate</strong>: Percentage of trades with positive net P&L.</Typography>
                <Typography variant="body2"><strong>Profit factor</strong>: Gross profit divided by gross loss (values above 1 indicate profitability).</Typography>
                <Typography variant="body2"><strong>Expectancy</strong>: Average net P&L per trade.</Typography>
                <Typography variant="body2"><strong>Max drawdown</strong>: Largest decline from an equity peak.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Charts</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Equity curve</strong>: Running total of net P&L over time.</Typography>
                <Typography variant="body2"><strong>Daily P&L</strong>: Sum of net P&L grouped by trade open date.</Typography>
                <Typography variant="body2"><strong>Recent trades</strong>: Latest executions ordered by open time.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Stack>
  )
}

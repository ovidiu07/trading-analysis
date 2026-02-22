import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import {
  type DiagnosticsStrategyDetailResponse,
  type DiagnosticsStrategiesResponse,
  getDiagnosticsStrategyDetail,
  listDiagnosticsStrategies
} from '../api/diagnostics'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import EmptyState from '../components/ui/EmptyState'

const formatSigned = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return '0.0000'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(4)}R`
}

const formatPct = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return '0%'
  return `${value.toFixed(2)}%`
}

export default function DiagnosticsPage() {
  const { t } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [strategies, setStrategies] = useState<DiagnosticsStrategiesResponse['strategies']>([])
  const [strategyId, setStrategyId] = useState('')
  const [mode, setMode] = useState<'LIVE' | 'BACKTEST' | 'BOTH'>('BOTH')
  const [backtestSource, setBacktestSource] = useState<'' | 'CSV' | 'OANDA' | 'DEMO'>('')
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DETAILS' | 'RUNS'>('OVERVIEW')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [symbol, setSymbol] = useState('')
  const [sessionWindow, setSessionWindow] = useState('')

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<DiagnosticsStrategyDetailResponse | null>(null)

  useEffect(() => {
    let mounted = true
    setInitialLoading(true)
    listDiagnosticsStrategies()
      .then((response) => {
        if (!mounted) return
        const next = response.strategies || []
        setStrategies(next)
        setStrategyId((prev) => prev || next[0]?.strategyId || '')
      })
      .catch((err) => {
        if (!mounted) return
        const apiErr = err as ApiError
        setError(translateApiError(apiErr, t, 'diagnostics.errors.loadStrategies'))
      })
      .finally(() => {
        if (mounted) {
          setInitialLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [t])

  useEffect(() => {
    if (!strategyId) {
      setDetail(null)
      return
    }

    let mounted = true
    setLoading(true)
    setError('')

    getDiagnosticsStrategyDetail(strategyId, {
      mode,
      backtestSource: backtestSource || undefined,
      from: from || undefined,
      to: to || undefined,
      symbol: symbol || undefined,
      sessionWindow: sessionWindow || undefined
    })
      .then((response) => {
        if (!mounted) return
        setDetail(response)
      })
      .catch((err) => {
        if (!mounted) return
        const apiErr = err as ApiError
        setError(translateApiError(apiErr, t, 'diagnostics.errors.loadDetail'))
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [strategyId, mode, backtestSource, from, to, symbol, sessionWindow, t])

  const kpiItems = useMemo(() => {
    if (!detail) return []
    const core = detail.coreMetrics
    return [
      { label: t('diagnostics.kpis.expectancy'), value: formatSigned(core.expectancyR) },
      { label: t('diagnostics.kpis.winRate'), value: formatPct(core.winRate) },
      { label: t('diagnostics.kpis.profitFactor'), value: core.profitFactor?.toFixed(2) || '0.00' },
      { label: t('diagnostics.kpis.sampleSize'), value: String(core.sampleSize) },
      { label: t('diagnostics.kpis.avgMae'), value: formatSigned(core.avgMaeR) },
      { label: t('diagnostics.kpis.avgMfe'), value: formatSigned(core.avgMfeR) }
    ]
  }, [detail, t])

  if (initialLoading) {
    return <Skeleton variant="rounded" height={220} />
  }

  if (!strategies.length) {
    return (
      <EmptyState
        title={t('diagnostics.empty.title')}
        description={t('diagnostics.empty.body')}
      />
    )
  }

  return (
    <Stack spacing={2.25} sx={{ minWidth: 0 }}>
      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" fontWeight={700}>{t('diagnostics.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('diagnostics.subtitle')}</Typography>
            <Typography variant="caption" color="text.secondary">{t('diagnostics.hints.filters')}</Typography>
            <Grid container spacing={1.25}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="diag-strategy-label">{t('diagnostics.filters.strategy')}</InputLabel>
                  <Select
                    labelId="diag-strategy-label"
                    label={t('diagnostics.filters.strategy')}
                    value={strategyId}
                    onChange={(event) => setStrategyId(event.target.value)}
                  >
                    {strategies.map((item) => (
                      <MenuItem key={item.strategyId} value={item.strategyId}>{item.strategyName}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="diag-mode-label">{t('diagnostics.filters.mode')}</InputLabel>
                  <Select
                    labelId="diag-mode-label"
                    label={t('diagnostics.filters.mode')}
                    value={mode}
                    onChange={(event) => setMode(event.target.value as 'LIVE' | 'BACKTEST' | 'BOTH')}
                  >
                    <MenuItem value="BOTH">{t('diagnostics.filters.modeBoth')}</MenuItem>
                    <MenuItem value="LIVE">{t('diagnostics.filters.modeLive')}</MenuItem>
                    <MenuItem value="BACKTEST">{t('diagnostics.filters.modeBacktest')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small" disabled={mode === 'LIVE'}>
                  <InputLabel id="diag-source-label">{t('diagnostics.filters.source')}</InputLabel>
                  <Select
                    labelId="diag-source-label"
                    label={t('diagnostics.filters.source')}
                    value={backtestSource}
                    onChange={(event) => setBacktestSource(event.target.value as '' | 'CSV' | 'OANDA' | 'DEMO')}
                  >
                    <MenuItem value="">{t('diagnostics.filters.sourceAll')}</MenuItem>
                    <MenuItem value="CSV">{t('diagnostics.filters.sourceCsv')}</MenuItem>
                    <MenuItem value="OANDA">{t('diagnostics.filters.sourceOanda')}</MenuItem>
                    <MenuItem value="DEMO">{t('diagnostics.filters.sourceDemo')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={6} md={1}>
                <TextField
                  size="small"
                  fullWidth
                  type="date"
                  label={t('diagnostics.filters.from')}
                  InputLabelProps={{ shrink: true }}
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={1}>
                <TextField
                  size="small"
                  fullWidth
                  type="date"
                  label={t('diagnostics.filters.to')}
                  InputLabelProps={{ shrink: true }}
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={1}>
                <TextField
                  size="small"
                  fullWidth
                  label={t('diagnostics.filters.symbol')}
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={1}>
                <TextField
                  size="small"
                  fullWidth
                  label={t('diagnostics.filters.sessionWindow')}
                  value={sessionWindow}
                  onChange={(event) => setSessionWindow(event.target.value.toUpperCase())}
                />
              </Grid>
            </Grid>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value as 'OVERVIEW' | 'DETAILS' | 'RUNS')}
              variant={isMobile ? 'scrollable' : 'standard'}
              allowScrollButtonsMobile
              sx={{ minHeight: 40 }}
            >
              <Tab value="OVERVIEW" label={t('diagnostics.tabs.overview')} sx={{ minHeight: 40 }} />
              <Tab value="DETAILS" label={t('diagnostics.tabs.strategyDetails')} sx={{ minHeight: 40 }} />
              <Tab value="RUNS" label={t('diagnostics.tabs.backtestRuns')} sx={{ minHeight: 40 }} />
            </Tabs>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && <Skeleton variant="rounded" height={280} />}

      {!loading && detail && (
        <>
          {activeTab === 'OVERVIEW' && (
            <>
              <Grid container spacing={1.25}>
                {kpiItems.map((item) => (
                  <Grid key={item.label} item xs={6} md={4} lg={2}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        <Typography variant="h6" fontWeight={700}>{item.value}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Grid container spacing={1.25}>
                <Grid item xs={12} lg={7}>
                  <Card>
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1" fontWeight={700}>{t('diagnostics.panels.rDistribution')}</Typography>
                        <Typography variant="caption" color="text.secondary">{t('diagnostics.hints.rDistribution')}</Typography>
                        <Box sx={{ width: '100%', height: 280 }}>
                          <ResponsiveContainer>
                            <BarChart data={detail.rDistribution} margin={{ top: 8, right: 12, left: 4, bottom: 14 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="bucket" interval={0} tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} />
                              <ChartTooltip />
                              <Bar dataKey="count" fill={theme.palette.primary.main} radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} lg={5}>
                  <Card>
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1" fontWeight={700}>{t('diagnostics.panels.suggestions')}</Typography>
                        <Typography variant="caption" color="text.secondary">{t('diagnostics.hints.suggestions')}</Typography>
                        {detail.suggestions.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">{t('diagnostics.empty.noSuggestions')}</Typography>
                        ) : (
                          detail.suggestions.map((item) => (
                            <Box key={item.title} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Typography variant="subtitle2" fontWeight={700}>{item.title}</Typography>
                              <Typography variant="body2" color="text.secondary">{item.description}</Typography>
                            </Box>
                          ))
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </>
          )}

          {activeTab === 'DETAILS' && (
            <>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" fontWeight={700}>{t('diagnostics.panels.triggerImpact')}</Typography>
                    <Typography variant="caption" color="text.secondary">{t('diagnostics.hints.triggerImpact')}</Typography>
                    {isMobile ? (
                      <Stack spacing={1}>
                        {detail.triggerImpact.map((row) => (
                          <Box key={row.triggerKey} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                            <Typography variant="subtitle2" fontWeight={700}>{row.triggerKey}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('diagnostics.table.checkedExpectancy')}: {formatSigned(row.checkedExpectancy)}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">{t('diagnostics.table.uncheckedExpectancy')}: {formatSigned(row.uncheckedExpectancy)}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">{t('diagnostics.table.delta')}: {formatSigned(row.deltaExpectancy)}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">{t('diagnostics.table.samples')}: {row.checkedCount}/{row.uncheckedCount}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>{t('diagnostics.table.trigger')}</TableCell>
                              <TableCell align="right">{t('diagnostics.table.checkedExpectancy')}</TableCell>
                              <TableCell align="right">{t('diagnostics.table.uncheckedExpectancy')}</TableCell>
                              <TableCell align="right">{t('diagnostics.table.delta')}</TableCell>
                              <TableCell align="right">{t('diagnostics.table.samples')}</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {detail.triggerImpact.map((row) => (
                              <TableRow key={row.triggerKey}>
                                <TableCell>{row.triggerKey}</TableCell>
                                <TableCell align="right">{formatSigned(row.checkedExpectancy)}</TableCell>
                                <TableCell align="right">{formatSigned(row.uncheckedExpectancy)}</TableCell>
                                <TableCell align="right">{formatSigned(row.deltaExpectancy)}</TableCell>
                                <TableCell align="right">{row.checkedCount}/{row.uncheckedCount}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" fontWeight={700}>{t('diagnostics.panels.failureModes')}</Typography>
                    {detail.failureModes.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">{t('diagnostics.empty.noFailureModes')}</Typography>
                    ) : (
                      detail.failureModes.map((row) => (
                        <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography variant="body2">{row.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.count} | {formatSigned(row.avgR)}</Typography>
                        </Box>
                      ))
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === 'RUNS' && (
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>{t('diagnostics.panels.backtestRuns')}</Typography>
                  {detail.backtestRuns.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">{t('diagnostics.empty.noBacktestRuns')}</Typography>
                  ) : (
                    detail.backtestRuns.map((row) => (
                      <Box key={row.runId} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{row.symbol} · {row.timeframe}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{new Date(row.from).toLocaleDateString()} - {new Date(row.to).toLocaleDateString()}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{t('diagnostics.table.samples')}: {row.tradesCount}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{t('diagnostics.kpis.expectancy')}: {formatSigned(row.expectancyR)}</Typography>
                      </Box>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Stack>
  )
}

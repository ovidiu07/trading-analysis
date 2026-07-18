import { useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme
} from '@mui/material'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { ApiError } from '../api/client'
import { getLiveDiagnosticsSummary } from '../api/diagnostics'
import {
  fetchSignalAnalyticsSummary,
  fetchSignalBreakdownByRegime,
  fetchSignalBreakdownBySetup,
  fetchSignalRecommendations
} from '../api/signalIntel'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import { formatNumber } from '../utils/format'
import { useI18n } from '../i18n'

const sessionFilters = ['', 'ASIA', 'LONDON', 'NY_AM', 'NY_PM', 'NY']

const panelSx = {
  borderRadius: 4,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)'
}

function formatSignedR(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatNumber(value, 2)}R`
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${formatNumber(value, 2)}%`
}

export default function DiagnosticsPage() {
  const { t } = useI18n()
  const theme = useTheme()
  const chartPalette = theme.palette.chart || {
    grid: theme.palette.divider,
    axis: theme.palette.text.secondary,
    positive: theme.palette.success.main
  }
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [symbol, setSymbol] = useState('')
  const [sessionWindow, setSessionWindow] = useState('')

  const summaryQuery = useQuery({
    queryKey: ['liveDiagnosticsSummary', from, to, symbol, sessionWindow],
    queryFn: () => getLiveDiagnosticsSummary({
      from: from || undefined,
      to: to || undefined,
      symbol: symbol || undefined,
      sessionWindow: sessionWindow || undefined
    })
  })

  const signalSummaryQuery = useQuery({
    queryKey: ['signalAnalyticsSummary', from, to, symbol],
    queryFn: () => fetchSignalAnalyticsSummary({
      from: from || undefined,
      to: to || undefined,
      symbol: symbol || undefined
    })
  })

  const signalSetupQuery = useQuery({
    queryKey: ['signalBreakdownBySetup', from, to, symbol],
    queryFn: () => fetchSignalBreakdownBySetup({
      from: from || undefined,
      to: to || undefined,
      symbol: symbol || undefined
    })
  })

  const signalRegimeQuery = useQuery({
    queryKey: ['signalBreakdownByRegime', from, to, symbol],
    queryFn: () => fetchSignalBreakdownByRegime({
      from: from || undefined,
      to: to || undefined,
      symbol: symbol || undefined
    })
  })

  const signalRecommendationsQuery = useQuery({
    queryKey: ['signalRecommendations', symbol],
    queryFn: () => fetchSignalRecommendations({
      symbol: symbol || undefined
    })
  })

  if (summaryQuery.isLoading) {
    return <LoadingState rows={8} height={26} />
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    const apiError = summaryQuery.error as ApiError
    return <Alert severity="error">{apiError?.message || t('diagnostics.live.errors.load')}</Alert>
  }

  const summary = summaryQuery.data
  const hasSample = summary.coreMetrics.sampleSize > 0
  const signalSummary = signalSummaryQuery.data
  const signalSetupRows = signalSetupQuery.data?.rows || []
  const signalRegimeRows = signalRegimeQuery.data?.rows || []
  const signalRecommendations = signalRecommendationsQuery.data?.recommendations || []

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0, pb: 3 }}>
      <Card sx={{ ...panelSx, background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.12), rgba(245, 158, 11, 0.10))' }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <InsightsRoundedIcon color="primary" />
                  <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 800 }}>
                    {t('diagnostics.live.title')}
                  </Typography>
                </Stack>
                <Typography variant="body1" color="text.secondary">
                  {t('diagnostics.live.subtitle')}
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(120px, 1fr))' },
                  gap: 1.25,
                  minWidth: { md: 460 }
                }}
              >
                {[
                  { label: t('diagnostics.live.kpis.winRate'), value: formatPercent(summary.coreMetrics.winRate), icon: <BoltRoundedIcon color="primary" /> },
                  { label: t('diagnostics.live.kpis.averageR'), value: formatSignedR(summary.coreMetrics.expectancyR), icon: <CandlestickChartRoundedIcon color="primary" /> },
                  { label: t('diagnostics.live.kpis.profitFactor'), value: formatNumber(summary.coreMetrics.profitFactor, 2), icon: <ChecklistRoundedIcon color="primary" /> },
                  { label: t('diagnostics.live.kpis.sampleSize'), value: String(summary.coreMetrics.sampleSize), icon: <InsightsRoundedIcon color="primary" /> }
                ].map((item) => (
                  <Card key={item.label} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack spacing={0.5}>
                        {item.icon}
                        <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                        <Typography variant="h6" fontWeight={800}>{item.value}</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                gap: 1.25
              }}
            >
              <TextField
                label={t('diagnostics.live.filters.from')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                fullWidth
              />
              <TextField
                label={t('diagnostics.live.filters.to')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={(event) => setTo(event.target.value)}
                fullWidth
              />
              <TextField
                label={t('diagnostics.live.filters.symbol')}
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder={t('diagnostics.live.filters.symbolPlaceholder')}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="diag-live-session-label">{t('diagnostics.live.filters.session')}</InputLabel>
                <Select
                  labelId="diag-live-session-label"
                  label={t('diagnostics.live.filters.session')}
                  value={sessionWindow}
                  onChange={(event) => setSessionWindow(event.target.value)}
                >
                  {sessionFilters.map((value) => (
                    <MenuItem key={value || 'all'} value={value}>{value || t('diagnostics.live.filters.allSessions')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {!hasSample ? (
        <EmptyState
          title={t('diagnostics.live.empty.title')}
          description={t('diagnostics.live.empty.body')}
          icon={<InsightsRoundedIcon fontSize="inherit" />}
        />
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: '1.1fr 0.9fr' },
              gap: 2
            }}
          >
            <Card sx={panelSx}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6" fontWeight={700}>{t('diagnostics.live.sessionPerformance.title')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('diagnostics.live.sessionPerformance.body')}
                  </Typography>
                  <Box sx={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary.breakdownBySession}>
                        <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="key" stroke={chartPalette.axis} />
                        <YAxis stroke={chartPalette.axis} />
                        <ChartTooltip formatter={(value: number) => formatSignedR(value)} />
                        <Bar dataKey="expectancyR" fill={chartPalette.positive} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={panelSx}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6" fontWeight={700}>{t('diagnostics.live.failureModes.title')}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('diagnostics.live.failureModes.body')}
                  </Typography>
                  {summary.failureModes.length === 0 ? (
                    <Alert severity="success">{t('diagnostics.live.failureModes.none')}</Alert>
                  ) : (
                    <Stack spacing={1}>
                      {summary.failureModes.map((item) => (
                        <Box key={item.label} sx={{ p: 1.25, borderRadius: 3, backgroundColor: 'action.hover' }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography variant="body2" fontWeight={700}>{item.label}</Typography>
                            <Chip size="small" label={t('diagnostics.live.failureModes.tradeCount', { count: item.count })} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {t('diagnostics.live.failureModes.impact', { value: formatSignedR(item.avgR) })}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' },
              gap: 2
            }}
          >
            <Card sx={panelSx}>
              <CardContent>
                <Stack spacing={1.25}>
                  <Typography variant="h6" fontWeight={700}>{t('diagnostics.live.strategyPerformance')}</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('diagnostics.live.table.strategy')}</TableCell>
                          <TableCell align="right">{t('diagnostics.live.table.trades')}</TableCell>
                          <TableCell align="right">{t('diagnostics.live.table.winRate')}</TableCell>
                          <TableCell align="right">{t('diagnostics.live.table.expectancy')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summary.strategyPerformance.map((row) => (
                          <TableRow key={row.strategyId}>
                            <TableCell>{row.strategyName}</TableCell>
                            <TableCell align="right">{row.sampleSize}</TableCell>
                            <TableCell align="right">{formatPercent(row.winRate)}</TableCell>
                            <TableCell align="right">{formatSignedR(row.expectancyR)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={panelSx}>
              <CardContent>
                <Stack spacing={1.25}>
                  <Typography variant="h6" fontWeight={700}>{t('diagnostics.live.symbolBreakdown')}</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('diagnostics.live.table.symbol')}</TableCell>
                          <TableCell align="right">{t('diagnostics.live.table.trades')}</TableCell>
                          <TableCell align="right">{t('diagnostics.live.table.winRate')}</TableCell>
                          <TableCell align="right">{t('diagnostics.live.table.expectancy')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summary.breakdownBySymbol.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell>{row.key}</TableCell>
                            <TableCell align="right">{row.sampleSize}</TableCell>
                            <TableCell align="right">{formatPercent(row.winRate)}</TableCell>
                            <TableCell align="right">{formatSignedR(row.expectancyR)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={panelSx}>
              <CardContent>
                <Stack spacing={1.25}>
                  <Typography variant="h6" fontWeight={700}>{t('diagnostics.live.suggestions.title')}</Typography>
                  {summary.suggestions.length === 0 ? (
                    <Alert severity="info">{t('diagnostics.live.suggestions.moreData')}</Alert>
                  ) : (
                    <Stack spacing={1}>
                      {summary.suggestions.map((item) => (
                        <Box key={item.title} sx={{ p: 1.25, borderRadius: 3, backgroundColor: 'action.hover' }}>
                          <Typography variant="body2" fontWeight={700}>{item.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Card sx={{ ...panelSx, borderColor: 'rgba(14, 116, 144, 0.18)' }}>
            <CardContent>
              <Stack spacing={1.75}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack spacing={0.35}>
                    <Typography variant="h6" fontWeight={700}>{t('diagnostics.live.signals.title')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('diagnostics.live.signals.body')}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    color={signalSummary?.topRecommendation ? 'success' : 'default'}
                    label={signalSummary?.topRecommendation ? t('diagnostics.live.signals.ready') : t('diagnostics.live.signals.learning')}
                  />
                </Stack>

                {signalSummaryQuery.isLoading || signalSetupQuery.isLoading || signalRegimeQuery.isLoading || signalRecommendationsQuery.isLoading ? (
                  <LoadingState rows={4} height={20} />
                ) : signalSummaryQuery.isError || signalSetupQuery.isError || signalRegimeQuery.isError || signalRecommendationsQuery.isError ? (
                  <Alert severity="warning">
                    {t('diagnostics.live.signals.unavailable')}
                  </Alert>
                ) : !signalSummary || signalSummary.overview.totalSignals === 0 ? (
                  <EmptyState
                    title={t('diagnostics.live.signals.emptyTitle')}
                    description={t('diagnostics.live.signals.emptyBody')}
                    icon={<InsightsRoundedIcon fontSize="inherit" />}
                  />
                ) : (
                  <>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
                        gap: 1.25
                      }}
                    >
                      {[
                        { label: t('diagnostics.live.kpis.signals'), value: signalSummary.overview.totalSignals },
                        { label: t('diagnostics.live.kpis.closed'), value: signalSummary.overview.closedSignals },
                        { label: t('diagnostics.live.kpis.winRate'), value: formatPercent(signalSummary.overview.winRate) },
                        { label: t('diagnostics.live.kpis.expectancy'), value: formatSignedR(signalSummary.overview.expectancyR) },
                        { label: t('diagnostics.live.kpis.avgConfidence'), value: `${formatNumber(signalSummary.overview.avgConfidenceScore, 1)}/100` }
                      ].map((item) => (
                        <Box key={item.label} sx={{ p: 1.25, borderRadius: 3, backgroundColor: 'action.hover' }}>
                          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                          <Typography variant="h6" fontWeight={800}>{item.value}</Typography>
                        </Box>
                      ))}
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', xl: '1.2fr 0.8fr' },
                        gap: 2
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t('diagnostics.live.signals.trend')}</Typography>
                        <Box sx={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={signalSummary.confidenceTrend}>
                              <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                              <XAxis dataKey="label" stroke={chartPalette.axis} />
                              <YAxis yAxisId="confidence" stroke={chartPalette.axis} />
                              <YAxis yAxisId="expectancy" orientation="right" stroke={chartPalette.axis} />
                              <ChartTooltip formatter={(value: number, name: string) => (
                                name === 'avgConfidenceScore'
                                  ? `${formatNumber(value, 1)}/100`
                                  : formatSignedR(value)
                              )} />
                              <Line yAxisId="confidence" type="monotone" dataKey="avgConfidenceScore" stroke={theme.palette.info.main} strokeWidth={2} dot={false} />
                              <Line yAxisId="expectancy" type="monotone" dataKey="expectancyR" stroke={theme.palette.warning.main} strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>

                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t('diagnostics.live.signals.recommended')}</Typography>
                        {signalRecommendations.length === 0 ? (
                          <Alert severity="info">{t('diagnostics.live.signals.needsData')}</Alert>
                        ) : (
                          <Stack spacing={1.1}>
                            <Box sx={{ p: 1.25, borderRadius: 3, backgroundColor: 'rgba(15, 118, 110, 0.08)' }}>
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography variant="body2" fontWeight={800}>{signalRecommendations[0].profileId}</Typography>
                                <Chip size="small" color="success" label={t('diagnostics.live.signals.score', { value: formatNumber(signalRecommendations[0].recommendationScore, 1) })} />
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {signalRecommendations[0].symbolScope} · {signalRecommendations[0].timeframe} · {signalRecommendations[0].regimeScope}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {t('diagnostics.live.signals.expectancySample', { expectancy: formatSignedR(signalRecommendations[0].expectancyR), count: signalRecommendations[0].sampleSize })}
                              </Typography>
                            </Box>
                            {signalRecommendations[0].reasons.map((reason) => (
                              <Typography key={reason} variant="body2" color="text.secondary">
                                • {reason}
                              </Typography>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>

                    <Divider />

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' },
                        gap: 2
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t('diagnostics.live.signals.bySetup')}</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>{t('diagnostics.live.table.setup')}</TableCell>
                                <TableCell align="right">{t('diagnostics.live.table.trades')}</TableCell>
                                <TableCell align="right">{t('diagnostics.live.table.expectancy')}</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {signalSetupRows.slice(0, 6).map((row) => (
                                <TableRow key={row.key}>
                                  <TableCell>{row.key}</TableCell>
                                  <TableCell align="right">{row.sampleSize}</TableCell>
                                  <TableCell align="right">{formatSignedR(row.expectancyR)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t('diagnostics.live.signals.byRegime')}</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>{t('diagnostics.live.table.regime')}</TableCell>
                                <TableCell align="right">{t('diagnostics.live.table.trades')}</TableCell>
                                <TableCell align="right">{t('diagnostics.live.table.winRate')}</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {signalRegimeRows.slice(0, 6).map((row) => (
                                <TableRow key={row.key}>
                                  <TableCell>{row.key}</TableCell>
                                  <TableCell align="right">{row.sampleSize}</TableCell>
                                  <TableCell align="right">{formatPercent(row.winRate)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{t('diagnostics.live.signals.weak')}</Typography>
                        {signalSummary.weakConditions.length === 0 ? (
                          <Alert severity="success">{t('diagnostics.live.signals.noWeak')}</Alert>
                        ) : (
                          <Stack spacing={1}>
                            {signalSummary.weakConditions.map((condition) => (
                              <Box key={`${condition.symbol}-${condition.setupType}-${condition.regime}-${condition.direction}`} sx={{ p: 1.1, borderRadius: 3, backgroundColor: 'action.hover' }}>
                                <Typography variant="body2" fontWeight={700}>
                                  {condition.symbol} · {condition.setupType}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {condition.timeframe} · {condition.regime} · {condition.direction}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                  {t('diagnostics.live.signals.weakLine', { action: condition.action, expectancy: formatSignedR(condition.expectancyR), count: condition.sampleSize })}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  )
}

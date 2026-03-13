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
  Typography
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
    return <Alert severity="error">{apiError?.message || 'Could not load live diagnostics.'}</Alert>
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
                    Live diagnostics
                  </Typography>
                </Stack>
                <Typography variant="body1" color="text.secondary">
                  Backtest metrics are intentionally hidden here. This view only reflects live trades and live session behavior.
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
                  { label: 'Win rate', value: formatPercent(summary.coreMetrics.winRate), icon: <BoltRoundedIcon color="primary" /> },
                  { label: 'Average R', value: formatSignedR(summary.coreMetrics.expectancyR), icon: <CandlestickChartRoundedIcon color="primary" /> },
                  { label: 'Profit factor', value: formatNumber(summary.coreMetrics.profitFactor, 2), icon: <ChecklistRoundedIcon color="primary" /> },
                  { label: 'Sample size', value: String(summary.coreMetrics.sampleSize), icon: <InsightsRoundedIcon color="primary" /> }
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
                label="From"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                fullWidth
              />
              <TextField
                label="To"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={(event) => setTo(event.target.value)}
                fullWidth
              />
              <TextField
                label="Symbol"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder="EURUSD"
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="diag-live-session-label">Session</InputLabel>
                <Select
                  labelId="diag-live-session-label"
                  label="Session"
                  value={sessionWindow}
                  onChange={(event) => setSessionWindow(event.target.value)}
                >
                  {sessionFilters.map((value) => (
                    <MenuItem key={value || 'all'} value={value}>{value || 'All sessions'}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {!hasSample ? (
        <EmptyState
          title="No live trades matched these filters"
          description="Live diagnostics turns on after you log closed trades with session and strategy context."
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
                  <Typography variant="h6" fontWeight={800}>Live session performance</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Session breakdown highlights where expectancy is concentrated in actual live trading.
                  </Typography>
                  <Box sx={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary.breakdownBySession}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="key" />
                        <YAxis />
                        <ChartTooltip formatter={(value: number) => formatSignedR(value)} />
                        <Bar dataKey="expectancyR" fill="#0f766e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={panelSx}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6" fontWeight={800}>Failure modes</Typography>
                  <Typography variant="body2" color="text.secondary">
                    The biggest live leaks stay visible so you can correct them during the next session, not after a review cycle.
                  </Typography>
                  {summary.failureModes.length === 0 ? (
                    <Alert severity="success">No dominant live failure mode is standing out yet.</Alert>
                  ) : (
                    <Stack spacing={1}>
                      {summary.failureModes.map((item) => (
                        <Box key={item.label} sx={{ p: 1.25, borderRadius: 3, backgroundColor: 'action.hover' }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography variant="body2" fontWeight={700}>{item.label}</Typography>
                            <Chip size="small" label={`${item.count} trades`} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            Average impact {formatSignedR(item.avgR)}
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
                  <Typography variant="h6" fontWeight={800}>Strategy performance</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Strategy</TableCell>
                          <TableCell align="right">Trades</TableCell>
                          <TableCell align="right">Win rate</TableCell>
                          <TableCell align="right">Expectancy</TableCell>
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
                  <Typography variant="h6" fontWeight={800}>Symbol breakdown</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Symbol</TableCell>
                          <TableCell align="right">Trades</TableCell>
                          <TableCell align="right">Win rate</TableCell>
                          <TableCell align="right">Expectancy</TableCell>
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
                  <Typography variant="h6" fontWeight={800}>What to change</Typography>
                  {summary.suggestions.length === 0 ? (
                    <Alert severity="info">Keep logging live context. More sample will sharpen the recommendations.</Alert>
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
                    <Typography variant="h6" fontWeight={800}>Signal intelligence</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Structured TradingView signals, their recent quality trend, and the strongest profile recommendations are shown separately from manual trade journaling.
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    color={signalSummary?.topRecommendation ? 'success' : 'default'}
                    label={signalSummary?.topRecommendation ? 'Recommendation ready' : 'Learning'}
                  />
                </Stack>

                {signalSummaryQuery.isLoading || signalSetupQuery.isLoading || signalRegimeQuery.isLoading || signalRecommendationsQuery.isLoading ? (
                  <LoadingState rows={4} height={20} />
                ) : signalSummaryQuery.isError || signalSetupQuery.isError || signalRegimeQuery.isError || signalRecommendationsQuery.isError ? (
                  <Alert severity="warning">
                    Signal intelligence is available after TradingView webhooks are connected and signals start landing in TradeJAudit.
                  </Alert>
                ) : !signalSummary || signalSummary.overview.totalSignals === 0 ? (
                  <EmptyState
                    title="No signal events yet"
                    description="Generate a TradingView webhook secret in Settings, paste the alert JSON into Pine, and the signal engine will start populating this panel."
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
                        { label: 'Signals', value: signalSummary.overview.totalSignals },
                        { label: 'Closed', value: signalSummary.overview.closedSignals },
                        { label: 'Win rate', value: formatPercent(signalSummary.overview.winRate) },
                        { label: 'Expectancy', value: formatSignedR(signalSummary.overview.expectancyR) },
                        { label: 'Avg confidence', value: `${formatNumber(signalSummary.overview.avgConfidenceScore, 1)}/100` }
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
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Recent signal quality trend</Typography>
                        <Box sx={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={signalSummary.confidenceTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" />
                              <YAxis yAxisId="confidence" />
                              <YAxis yAxisId="expectancy" orientation="right" />
                              <ChartTooltip formatter={(value: number, name: string) => (
                                name === 'avgConfidenceScore'
                                  ? `${formatNumber(value, 1)}/100`
                                  : formatSignedR(value)
                              )} />
                              <Line yAxisId="confidence" type="monotone" dataKey="avgConfidenceScore" stroke="#0f766e" strokeWidth={2} dot={false} />
                              <Line yAxisId="expectancy" type="monotone" dataKey="expectancyR" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      </Box>

                      <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Recommended profile</Typography>
                        {signalRecommendations.length === 0 ? (
                          <Alert severity="info">TradeJAudit needs more closed signal outcomes before it will recommend a profile pack.</Alert>
                        ) : (
                          <Stack spacing={1.1}>
                            <Box sx={{ p: 1.25, borderRadius: 3, backgroundColor: 'rgba(15, 118, 110, 0.08)' }}>
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography variant="body2" fontWeight={800}>{signalRecommendations[0].profileId}</Typography>
                                <Chip size="small" color="success" label={`${formatNumber(signalRecommendations[0].recommendationScore, 1)} score`} />
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {signalRecommendations[0].symbolScope} · {signalRecommendations[0].timeframe} · {signalRecommendations[0].regimeScope}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {formatSignedR(signalRecommendations[0].expectancyR)} expectancy from {signalRecommendations[0].sampleSize} closed signals.
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
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>By setup type</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Setup</TableCell>
                                <TableCell align="right">Trades</TableCell>
                                <TableCell align="right">Expectancy</TableCell>
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
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>By regime</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Regime</TableCell>
                                <TableCell align="right">Trades</TableCell>
                                <TableCell align="right">Win rate</TableCell>
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
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Weak conditions</Typography>
                        {signalSummary.weakConditions.length === 0 ? (
                          <Alert severity="success">No persistent weak signal bucket is standing out.</Alert>
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
                                  {condition.action} at {formatSignedR(condition.expectancyR)} across {condition.sampleSize} signals.
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

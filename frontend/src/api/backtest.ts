import { apiDelete, apiGet, apiPost, apiPostMultipart } from './client'

export type BacktestCandle = {
  timestamp?: string | number
  epochSec?: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type BacktestRunStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED'
export type BacktestDataSource = 'CSV' | 'OANDA' | 'DEMO'

export type BacktestRun = {
  id: string
  symbol: string
  timeframe: string
  from: string
  to: string
  sessionWindow?: string
  spread?: number
  slippage?: number
  provider: string
  dataSource?: BacktestDataSource
  sourceId?: string
  datasetId?: string
  status: BacktestRunStatus
  candleCount: number
  createdAt?: string
  updatedAt?: string
  candles: BacktestCandle[]
}

export type CsvColumnMapping = {
  timeColumn: string
  openColumn: string
  highColumn: string
  lowColumn: string
  closeColumn: string
  volumeColumn?: string
  timezone?: string
}

export type CsvUploadResponse = {
  fileId: string
  fileName: string
  headers: string[]
  mappingRequired: boolean
  suggestedMapping?: CsvColumnMapping
  detectedSymbol?: string
  detectedTimeframe?: string
  detectedTimeFormat?: string
  dataFrom?: string
  dataTo?: string
  warnings: string[]
}

export type BacktestDataset = {
  id: string
  provider: BacktestDataSource
  sourceId: string
  name: string
  symbolCanonical: string
  symbolDisplay: string
  timeframe: string
  dataFrom: string
  dataTo: string
  rowCount: number
  originalFileName?: string
  detectedMappingJson?: Record<string, unknown> | null
  createdAt?: string
  warnings: string[]
}

export type BacktestDatasetSummary = {
  datasetId: string
  provider: BacktestDataSource
  symbolDisplay: string
  symbolCanonical: string
  timeframe: string
  dataFromUtc?: string
  dataToUtc?: string
  candleCount?: number
  timezoneHint?: string
  defaultFromUtc?: string
  defaultToUtc?: string
  recommendedDefaultFromUtc?: string
  recommendedDefaultToUtc?: string
  defaultWindowDays?: number
  warnings?: string[]
}

export type CsvIngestResponse = {
  dataset: BacktestDataset
  warnings: string[]
}

export type BacktestCandlesResponse = {
  provider: BacktestDataSource
  sourceId?: string
  datasetId?: string
  symbol: string
  timeframe: string
  effectiveFromUtc?: string
  effectiveToUtc?: string
  count?: number
  from: string
  to: string
  candleCount: number
  message?: string | null
  candles: BacktestCandle[]
}

export type ProviderConnectionStatus = {
  provider: 'OANDA'
  connected: boolean
  accountId?: string
  lastTestedAt?: string
}

export type BacktestTrade = {
  id: string
  runId: string
  strategyId?: string
  strategyVersionId?: string
  contextSnapshotId?: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  orderType: 'MARKET' | 'LIMIT'
  entryPrice: number
  stopLossPrice: number
  takeProfitPrice?: number
  riskAmount?: number
  invalidationText?: string
  requestedAt: string
  entryTime?: string
  exitTime?: string
  filled: boolean
  exitReason?: 'SL' | 'TP' | 'MANUAL' | 'OPEN'
  win?: boolean
  breakEven: boolean
  rMultiple?: number
  maePrice?: number
  mfePrice?: number
  maeR?: number
  mfeR?: number
  durationMinutes?: number
  durationBars?: number
  timeToPlus1RMinutes?: number
  timeToPlus1RBars?: number
}

export type BacktestDatasetSet = {
  id: string
  instrument: string
  timezoneBasis: string
  createdAt: string
}

export type BacktestDatasetValidationIssue = {
  code: string
  message: string
  details?: string | null
}

export type BacktestDatasetFile = {
  datasetId: string
  timeframe: string
  originalFilename: string
  minTimeUtc: string
  maxTimeUtc: string
  candleCount: number
  columnsMapped: string
  status: 'READY' | 'WARN' | 'ERROR' | 'BUILDING' | 'PROCESSING'
  runnable: boolean
  minRequiredCandles: number
  errorMsg?: string | null
  warnings: BacktestDatasetValidationIssue[]
  fatalErrors: BacktestDatasetValidationIssue[]
}

export type BacktestSessionPreview = {
  sessionName: string
  sessionDate: string
  candleCount: number
  sessionHigh: number
  sessionLow: number
}

export type BacktestDatasetSetDatasets = {
  datasetSetId: string
  instrument: string
  timezoneBasis: string
  datasets: BacktestDatasetFile[]
  sessionPreview: BacktestSessionPreview[]
}

export type BacktestStrategyConfig = {
  id: string
  datasetSetId: string
  name: string
  configJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type BacktestLabRun = {
  runId: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'READY'
  symbol: string
  timeframe: string
  fromUtc: string
  toUtc: string
  createdAt: string
  completedAt?: string | null
  errorMsg?: string | null
  datasetMinUtc?: string | null
  datasetMaxUtc?: string | null
  requestedFromUtc?: string | null
  requestedToUtc?: string | null
  effectiveFromUtc?: string | null
  effectiveToUtc?: string | null
  candleCountInRange?: number | null
  minRequiredCandles?: number | null
  warnings?: string[]
}

export type BacktestLabSummary = {
  sampleSize: number
  winRate: number
  expectancyR: number
  avgR: number
  avgMaeR: number
  avgMfeR: number
  fillRate: number
  avgDurationSec: number
}

export type BacktestLabTimelineEvent = {
  stage: string
  timeUtc?: string | null
  details?: Record<string, unknown>
}

export type BacktestLabTradeResult = {
  tradeId: string
  setupId?: string | null
  sessionName?: string | null
  direction?: 'LONG' | 'SHORT'
  entryTime?: string | null
  entryPrice?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  exitTime?: string | null
  exitPrice?: number | null
  exitReason?: string | null
  fillStatus: 'FILLED' | 'NO_FILL'
  rMultiple?: number | null
  maeR?: number | null
  mfeR?: number | null
  durationSec?: number | null
  evidence?: Record<string, unknown>
  timeline: BacktestLabTimelineEvent[]
}

export type BacktestLabRunResults = {
  runId: string
  status: string
  strategyName: string
  createdAt: string
  completedAt?: string | null
  summary: BacktestLabSummary
  trades: BacktestLabTradeResult[]
}

export type BacktestRunReport = {
  reportId: string
  runId: string
  strategyId?: string | null
  strategyNameSnapshot: string
  strategyConfigSnapshotJson: Record<string, unknown>
  filtersSnapshotJson: Record<string, unknown>
  summarySnapshotJson: Record<string, unknown>
  tradesTimelineSnapshotJson: unknown[]
  recommendationsSnapshotJson: unknown[]
  reportMarkdown: string
  reportVersion: string
  createdAtUtc: string
}

export type BacktestOptimizerGrid = {
  mssMinConfirmCandles?: number[]
  displacementType?: string[]
  retraceRequired?: boolean[]
  retraceMinPct?: number[]
  sweepMinDepthPips?: number[]
  confirmationTf?: string[]
  entryTf?: string[]
}

export type BacktestOptimizerVariantResult = {
  rank: number
  params: Record<string, unknown>
  trades?: number | null
  sampleSize?: number | null
  winRate?: number | null
  profitFactor?: number | null
  expectancyR?: number | null
  avgR?: number | null
  maxDdR?: number | null
  fillRate?: number | null
  avgMaeR?: number | null
  avgMfeR?: number | null
  avgDurationSec?: number | null
  confidenceNote?: string | null
}

export type BacktestOptimizerRun = {
  optimizerRunId: string
  status: string
  variantCount: number
  maxVariants: number
  truncated: boolean
  createdAtUtc: string
  summary: Record<string, unknown>
  variants: BacktestOptimizerVariantResult[]
}

export async function createBacktestRun(payload: {
  symbol: string
  timeframe: string
  from?: string
  to?: string
  sessionWindow?: string
  spread?: number
  slippage?: number
  provider?: string
  dataSource?: BacktestDataSource
  sourceId?: string
  datasetId?: string
  refresh?: boolean
}) {
  return apiPost<BacktestRun>('/backtest/runs', payload)
}

export async function listBacktestRuns() {
  return apiGet<BacktestRun[]>('/backtest/runs')
}

export async function getBacktestRun(id: string) {
  return apiGet<BacktestRun>(`/backtest/runs/${id}`)
}

export async function listBacktestTrades(runId: string) {
  return apiGet<BacktestTrade[]>(`/backtest/runs/${runId}/trades`)
}

export async function simulateBacktestTrade(runId: string, payload: {
  direction: 'LONG' | 'SHORT'
  orderType?: 'MARKET' | 'LIMIT'
  entryPrice?: number
  stopLossPrice: number
  takeProfitPrice?: number
  riskAmount?: number
  invalidationText?: string
  replayCursorTime: string
  conservativeSameBar?: boolean
  strategyId?: string
  prereqsTemplateId?: string
  triggersTemplateId?: string
  selectedSweepLevelId?: string
  prereqsStatesJson?: unknown
  triggersStatesJson?: unknown
  levelsSnapshotJson?: unknown
  lockInSnapshotJson?: unknown
  qualityScoreInputsJson?: unknown
}) {
  return apiPost<BacktestTrade>(`/backtest/runs/${runId}/trades`, payload)
}

export async function uploadBacktestCsv(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostMultipart<CsvUploadResponse>('/backtest/csv/upload', formData)
}

export async function ingestBacktestCsv(fileId: string, payload: {
  mapping?: CsvColumnMapping
  symbol?: string
  timeframe?: string
  timezone?: string
  datasetName?: string
} = {}) {
  return apiPost<CsvIngestResponse>(`/backtest/csv/ingest?fileId=${encodeURIComponent(fileId)}`, payload)
}

export async function listBacktestDatasets() {
  return apiGet<BacktestDataset[]>('/backtest/datasets')
}

export async function getBacktestDataset(id: string) {
  return apiGet<BacktestDataset>(`/backtest/datasets/${encodeURIComponent(id)}`)
}

export async function getBacktestDatasetSummary(id: string) {
  return apiGet<BacktestDatasetSummary>(`/backtest/datasets/${encodeURIComponent(id)}/summary`)
}

export async function getBacktestCandles(params: {
  datasetId?: string
  provider?: BacktestDataSource
  dataSource?: BacktestDataSource
  sourceId?: string
  symbol?: string
  timeframe?: string
  fromUtc?: string
  toUtc?: string
  from?: string
  to?: string
  sessionWindow?: string
  limit?: number
  refresh?: boolean
}) {
  const query = new URLSearchParams()
  if (params.datasetId) query.set('datasetId', params.datasetId)
  if (params.provider) query.set('provider', params.provider)
  if (params.dataSource) query.set('dataSource', params.dataSource)
  if (params.sourceId) query.set('sourceId', params.sourceId)
  if (params.symbol) query.set('symbol', params.symbol)
  if (params.timeframe) query.set('timeframe', params.timeframe)
  if (params.fromUtc) query.set('fromUtc', params.fromUtc)
  if (params.toUtc) query.set('toUtc', params.toUtc)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.sessionWindow) query.set('sessionWindow', params.sessionWindow)
  if (typeof params.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0) {
    query.set('limit', String(Math.trunc(params.limit)))
  }
  if (params.refresh) query.set('refresh', 'true')
  const qs = query.toString()
  return apiGet<BacktestCandlesResponse>(`/backtest/candles${qs ? `?${qs}` : ''}`)
}

export async function deleteBacktestDataset(id: string) {
  return apiDelete(`/backtest/datasets/${id}`)
}

export async function loadDemoBacktestDatasets() {
  return apiPost<BacktestDataset[]>('/backtest/demo/load', {})
}

export async function resetDemoBacktestDatasets() {
  return apiPost<void>('/backtest/demo/reset', {})
}

export async function getOandaProviderStatus() {
  return apiGet<ProviderConnectionStatus>('/backtest/providers/oanda/status')
}

export async function testOandaProvider(token: string) {
  return apiPost<ProviderConnectionStatus>('/backtest/providers/oanda/test', { token })
}

export async function connectOandaProvider(token: string) {
  return apiPost<ProviderConnectionStatus>('/backtest/providers/oanda/connect', { token })
}

export async function disconnectOandaProvider() {
  return apiDelete('/backtest/providers/oanda')
}

export async function createBacktestDatasetSet(payload: {
  instrument?: string
  timezoneBasis?: string
} = {}) {
  return apiPost<BacktestDatasetSet>('/backtest/dataset-sets', payload)
}

export async function uploadBacktestDatasetCsv(datasetSetId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostMultipart<BacktestDatasetFile>(`/backtest/dataset-sets/${encodeURIComponent(datasetSetId)}/upload-csv`, formData)
}

export async function getBacktestDatasetSetDatasets(datasetSetId: string) {
  return apiGet<BacktestDatasetSetDatasets>(`/backtest/dataset-sets/${encodeURIComponent(datasetSetId)}/datasets`)
}

export async function saveBacktestStrategyConfig(datasetSetId: string, payload: {
  name?: string
  configJson?: Record<string, unknown>
}) {
  return apiPost<BacktestStrategyConfig>(`/backtest/dataset-sets/${encodeURIComponent(datasetSetId)}/strategy-configs`, payload)
}

export async function getBacktestStrategyConfigV2(id: string) {
  return apiGet<BacktestStrategyConfig>(`/backtest/strategy-configs/${encodeURIComponent(id)}`)
}

export async function runBacktestDatasetSet(datasetSetId: string, payload: {
  strategyConfigId?: string
  fromUtc?: string
  toUtc?: string
  sessionFilter?: string
  autoGenerateReport?: boolean
}) {
  return apiPost<BacktestLabRun>(`/backtest/dataset-sets/${encodeURIComponent(datasetSetId)}/runs`, payload)
}

export async function getBacktestRunResultsV2(runId: string) {
  return apiGet<BacktestLabRunResults>(`/backtest/runs/${encodeURIComponent(runId)}/results`)
}

export async function getBacktestRunReportV2(runId: string) {
  return apiGet<BacktestRunReport>(`/backtest/runs/${encodeURIComponent(runId)}/report`)
}

export async function runBacktestOptimizer(datasetSetId: string, payload: {
  strategyConfigId?: string
  fromUtc?: string
  toUtc?: string
  sessionFilter?: string
  maxVariants?: number
  grid?: BacktestOptimizerGrid
}) {
  return apiPost<BacktestOptimizerRun>(`/backtest/dataset-sets/${encodeURIComponent(datasetSetId)}/optimizer/runs`, payload)
}

export async function getBacktestOptimizerRun(optimizerRunId: string) {
  return apiGet<BacktestOptimizerRun>(`/backtest/optimizer/runs/${encodeURIComponent(optimizerRunId)}`)
}

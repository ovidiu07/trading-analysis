import { apiDelete, apiGet, apiPost, apiPostMultipart } from './client'

export type BacktestCandle = {
  timestamp: string
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
  warnings: string[]
}

export type CsvIngestResponse = {
  dataset: BacktestDataset
  warnings: string[]
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

export async function createBacktestRun(payload: {
  symbol: string
  timeframe: string
  from: string
  to: string
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

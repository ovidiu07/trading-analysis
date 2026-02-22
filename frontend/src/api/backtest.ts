import { apiGet, apiPost } from './client'

export type BacktestCandle = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type BacktestRunStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED'

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
  status: BacktestRunStatus
  candleCount: number
  createdAt?: string
  updatedAt?: string
  candles: BacktestCandle[]
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

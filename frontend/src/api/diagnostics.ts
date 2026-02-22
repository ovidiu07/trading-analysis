import { apiGet } from './client'

export type DiagnosticsStrategyHeadline = {
  strategyId: string
  strategyName: string
  sampleSize: number
  winRate: number
  expectancyR: number
  profitFactor: number
}

export type DiagnosticsStrategiesResponse = {
  strategies: DiagnosticsStrategyHeadline[]
}

export type DiagnosticsCoreMetrics = {
  sampleSize: number
  winRate: number
  expectancyR: number
  profitFactor: number
  avgMaeR: number
  avgMfeR: number
  avgDurationMinutes: number
}

export type DiagnosticsBreakdownRow = {
  key: string
  sampleSize: number
  winRate: number
  expectancyR: number
}

export type DiagnosticsTriggerImpactRow = {
  triggerKey: string
  checkedExpectancy: number
  uncheckedExpectancy: number
  deltaExpectancy: number
  checkedCount: number
  uncheckedCount: number
}

export type DiagnosticsFailureModeRow = {
  label: string
  count: number
  avgR: number
}

export type DiagnosticsHistogramBucket = {
  bucket: string
  count: number
}

export type DiagnosticsSuggestion = {
  title: string
  description: string
}

export type DiagnosticsBacktestRunRow = {
  runId: string
  symbol: string
  timeframe: string
  from: string
  to: string
  tradesCount: number
  expectancyR: number
}

export type DiagnosticsStrategyDetailResponse = {
  strategyId: string
  strategyName: string
  mode: 'LIVE' | 'BACKTEST' | 'BOTH'
  coreMetrics: DiagnosticsCoreMetrics
  breakdownBySession: DiagnosticsBreakdownRow[]
  breakdownBySymbol: DiagnosticsBreakdownRow[]
  breakdownByDayOfWeek: DiagnosticsBreakdownRow[]
  rDistribution: DiagnosticsHistogramBucket[]
  triggerImpact: DiagnosticsTriggerImpactRow[]
  failureModes: DiagnosticsFailureModeRow[]
  suggestions: DiagnosticsSuggestion[]
  backtestRuns: DiagnosticsBacktestRunRow[]
}

const toQuery = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      sp.set(key, value)
    }
  })
  const query = sp.toString()
  return query ? `?${query}` : ''
}

export async function listDiagnosticsStrategies() {
  return apiGet<DiagnosticsStrategiesResponse>('/diagnostics/strategies')
}

export async function getDiagnosticsStrategyDetail(strategyId: string, params: {
  mode?: 'LIVE' | 'BACKTEST' | 'BOTH'
  from?: string
  to?: string
  symbol?: string
  sessionWindow?: string
} = {}) {
  return apiGet<DiagnosticsStrategyDetailResponse>(`/diagnostics/strategy/${strategyId}${toQuery(params)}`)
}

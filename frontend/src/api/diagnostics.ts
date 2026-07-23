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

export type DiagnosticsReportRow = {
  reportId: string
  runId: string
  strategyId?: string | null
  strategyName: string
  instrument: string
  timeframe?: string | null
  sessionFilter?: string | null
  sampleSize: number
  winRate: number
  expectancyR: number
  createdAt: string
}

export type DiagnosticsReportsResponse = {
  reports: DiagnosticsReportRow[]
}

export type LiveDiagnosticsSummaryResponse = {
  coreMetrics: DiagnosticsCoreMetrics
  breakdownBySession: DiagnosticsBreakdownRow[]
  breakdownBySymbol: DiagnosticsBreakdownRow[]
  breakdownByDayOfWeek: DiagnosticsBreakdownRow[]
  strategyPerformance: DiagnosticsStrategyHeadline[]
  failureModes: DiagnosticsFailureModeRow[]
  suggestions: DiagnosticsSuggestion[]
  generatedAt: string
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

export async function listDiagnosticsStrategies(params: { accountIds?: string } = {}) {
  return apiGet<DiagnosticsStrategiesResponse>(`/diagnostics/strategies${toQuery(params)}`)
}

export async function getDiagnosticsStrategyDetail(strategyId: string, params: {
  mode?: 'LIVE' | 'BACKTEST' | 'BOTH'
  backtestSource?: 'CSV' | 'OANDA' | 'DEMO'
  from?: string
  to?: string
  symbol?: string
  sessionWindow?: string
  accountIds?: string
} = {}) {
  return apiGet<DiagnosticsStrategyDetailResponse>(`/diagnostics/strategy/${strategyId}${toQuery(params)}`)
}

export async function listDiagnosticsReports(params: {
  from?: string
  to?: string
  instrument?: string
  strategyName?: string
} = {}) {
  return apiGet<DiagnosticsReportsResponse>(`/diagnostics/reports${toQuery(params)}`)
}

export async function getLiveDiagnosticsSummary(params: {
  from?: string
  to?: string
  symbol?: string
  sessionWindow?: string
  accountIds?: string
} = {}) {
  return apiGet<LiveDiagnosticsSummaryResponse>(`/diagnostics/live-summary${toQuery(params)}`)
}

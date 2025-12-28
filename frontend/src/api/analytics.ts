import { apiGet } from './client'

export type TimeSeriesPoint = {
  date: string
  value: number
}

export type KpiSummary = {
  totalPnlGross: number
  totalPnlNet: number
  winRate: number
  lossRate: number
  averageWin: number
  averageLoss: number
  expectancy: number
  profitFactor: number
  maxDrawdown: number
  maxWinStreak: number
  maxLossStreak: number
  totalTrades?: number
  winningTrades?: number
  losingTrades?: number
  openTrades?: number
  closedTrades?: number
}

export type AnalyticsResponse = {
  kpi: KpiSummary
  equityCurve: TimeSeriesPoint[]
  groupedPnl: TimeSeriesPoint[]
  breakdown: Record<string, number>
}

export type AnalyticsFilters = {
  from?: string
  to?: string
  symbol?: string
  direction?: 'LONG' | 'SHORT'
  status?: 'OPEN' | 'CLOSED'
  strategy?: string
}

const toQuery = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      sp.set(key, String(value))
    }
  })
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchAnalyticsSummary(filters: AnalyticsFilters = {}) {
  return apiGet<AnalyticsResponse>(`/analytics/summary${toQuery(filters)}`)
}

import { apiGet } from './client'

export type TimeSeriesPoint = {
  date: string
  value: number
}

export type HistogramBucket = {
  label: string
  min: number
  max: number
  count: number
}

export type BreakdownRow = {
  name: string
  trades: number
  netPnl: number
  winRate: number
  averagePnl: number
  profitFactor: number | null
  lowSample: boolean
}

export type RollingMetricPoint = {
  date: string
  winRate: number
  profitFactor: number | null
  expectancy: number
  averagePnl: number
}

export type KpiSummary = {
  totalPnlGross: number
  totalPnlNet: number
  grossProfit: number
  grossLoss: number
  winRate: number
  lossRate: number
  averageWin: number
  averageLoss: number
  medianPnl: number
  payoffRatio: number | null
  expectancy: number
  profitFactor: number | null
  totalTrades?: number
  winningTrades?: number
  losingTrades?: number
  flatTrades?: number
  openTrades?: number
  closedTrades?: number
}

export type CostSummary = {
  totalFees: number
  totalCommission: number
  totalSlippage: number
  totalCosts: number
  avgFees: number
  avgCommission: number
  avgSlippage: number
  avgCosts: number
  netVsGrossDelta: number
}

export type DrawdownSummary = {
  maxDrawdown: number
  maxDrawdownPercent: number | null
  maxDrawdownDurationTrades: number
  maxDrawdownDurationDays: number
  recoveryFactor: number | null
  ulcerIndex: number | null
}

export type DistributionSummary = {
  standardDeviation: number | null
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  pnlHistogram: HistogramBucket[]
  outlierLower: number | null
  outlierUpper: number | null
  outlierCount: number
}

export type ConsistencySummary = {
  greenWeeks: number
  redWeeks: number
  bestDay: TimeSeriesPoint | null
  worstDay: TimeSeriesPoint | null
  bestWeek: TimeSeriesPoint | null
  worstWeek: TimeSeriesPoint | null
  streaks: {
    maxWinStreak: number
    maxLossStreak: number
    currentStreakType: string
    currentStreakCount: number
  }
}

export type BucketStats = {
  bucket: string
  trades: number
  netPnl: number
  winRate: number
}

export type TimeEdgeSummary = {
  averageHoldingSeconds: number | null
  medianHoldingSeconds: number | null
  holdingBuckets: BucketStats[]
  dayOfWeek: BucketStats[]
  hourOfDay: BucketStats[]
}

export type ConcentrationSummary = {
  top1PnlShare: number | null
  top3PnlShare: number | null
  top1TradeShare: number | null
  top3TradeShare: number | null
}

export type AttributionSummary = {
  symbols: BreakdownRow[]
  strategies: BreakdownRow[]
  setups: BreakdownRow[]
  catalysts: BreakdownRow[]
  bottomSymbols: BreakdownRow[]
  bottomTags: BreakdownRow[]
  concentration: ConcentrationSummary
}

export type RiskSummary = {
  available: boolean
  averageR: number | null
  medianR: number | null
  expectancyR: number | null
  winRateR: number
  averageRiskAmount: number | null
  averageRiskPercent: number | null
  rDistribution: HistogramBucket[]
  tradesWithRisk: number
}

export type DataQualitySummary = {
  missingClosedAtCount: number
  inconsistentStatusCount: number
  missingStrategyCount: number
  missingSetupCount: number
  missingCatalystCount: number
  missingPnlPercentCount: number
  missingRiskCount: number
  timezoneNote: string
}

export type TraderReadSummary = {
  insights: { text: string }[]
}

export type FilterOptions = {
  symbols: string[]
  markets: string[]
  strategies: string[]
  setups: string[]
  catalysts: string[]
}

export type AnalyticsResponse = {
  kpi: KpiSummary
  costs: CostSummary
  drawdown: DrawdownSummary
  distribution: DistributionSummary
  consistency: ConsistencySummary
  timeEdge: TimeEdgeSummary
  attribution: AttributionSummary
  risk: RiskSummary
  dataQuality: DataQualitySummary
  traderRead: TraderReadSummary
  filterOptions: FilterOptions
  equityCurve: TimeSeriesPoint[]
  groupedPnl: TimeSeriesPoint[]
  drawdownSeries: TimeSeriesPoint[]
  weeklyPnl: TimeSeriesPoint[]
  rolling20: RollingMetricPoint[]
  rolling50: RollingMetricPoint[]
  breakdown: Record<string, number>
}

export type AdviceSeverity = 'info' | 'warn' | 'critical'
export type AdviceConfidence = 'low' | 'medium' | 'high'
export type AdviceEvidence = {
  label: string
  value: number | null
  kind: 'currency' | 'percent' | 'number'
}

export type AdviceFilters = {
  symbol?: string
  market?: string
  direction?: string
  status?: string
  strategyTag?: string
  setup?: string
  catalystTag?: string
  dateMode?: 'OPEN' | 'CLOSE'
  hourBucket?: string
  holdingBucket?: string
}

export type AdviceCard = {
  id: string
  severity: AdviceSeverity
  confidence: AdviceConfidence
  title: string
  message: string[]
  evidence: AdviceEvidence[]
  recommendedActions: string[]
  filters?: AdviceFilters | null
}

export type CoachDataQuality = {
  totalTrades: number
  closedTrades: number
  missingClosedAtCount: number
  missingPnlNetCount: number
  missingEntryExitCount: number
  inconsistentPnlCount: number
}

export type CoachResponse = {
  dataQuality: CoachDataQuality
  advice: AdviceCard[]
}

export type AnalyticsFilters = {
  from?: string
  to?: string
  dateMode?: 'OPEN' | 'CLOSE'
  symbol?: string
  direction?: 'LONG' | 'SHORT'
  market?: string
  status?: 'OPEN' | 'CLOSED'
  strategy?: string[]
  setup?: string[]
  catalyst?: string[]
  holdingBucket?: string
  excludeOutliers?: boolean
}

const toQuery = (params: Record<string, string | string[] | number | boolean | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    if (Array.isArray(value)) {
      if (value.length === 0) return
      sp.set(key, value.join(','))
      return
    }
    sp.set(key, String(value))
  })
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchAnalyticsSummary(filters: AnalyticsFilters = {}) {
  return apiGet<AnalyticsResponse>(`/analytics/summary${toQuery(filters)}`)
}

export async function fetchAnalyticsCoach(filters: AnalyticsFilters = {}) {
  return apiGet<CoachResponse>(`/analytics/coach${toQuery(filters)}`)
}

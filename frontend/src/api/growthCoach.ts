import { apiDelete, apiGet, apiPost, apiPut } from './client'
import { announceAnalyticsDataChanged } from './dataEvents'
import type { AnalyticsResponse } from './analytics'

export type GrowthCoachMode = 'PORTFOLIO' | 'ACCOUNT'
export type GrowthAccountType =
  | 'PERSONAL'
  | 'PROP_CHALLENGE'
  | 'PROP_FUNDED'
  | 'FUTURES_EVALUATION'
  | 'FUTURES_FUNDED'
  | 'DEMO'
  | 'OTHER'

export type PortfolioAccount = {
  accountId: string
  accountName: string
  accountType: GrowthAccountType
  currency: string
  realisedBalance?: number | null
  currentEquity?: number | null
  currentMonthRealisedPnl?: number | null
  floatingPnl?: number | null
  openTradeCount?: number | null
  riskState: string
  confidenceLevel: string
}

export type GrowthProfile = {
  id: string
  accountType: GrowthAccountType
  initialCapital?: number | null
  capitalSource: string
  defaultRiskPerTradePct: number
  preferredMaxRiskPerTradePct: number
  maxConcurrentRiskPct: number
  maxDailyRiskPct?: number | null
  maxDailyLossAmount?: number | null
  maxTotalDrawdownPct?: number | null
  maxTotalDrawdownAmount?: number | null
  drawdownType: string
  monthlyTargetPct: number
  compoundsMonthly: boolean
  profitTargetPct?: number | null
  profitTargetAmount?: number | null
  minimumTradingDays?: number | null
  challengeDeadline?: string | null
  consistencyRuleType?: string | null
  consistencyRuleValue?: number | null
  trailingDrawdownEnabled: boolean
  trailingDrawdownType?: string | null
  trailingDrawdownAmount?: number | null
  trailingDrawdownHighWaterMark?: number | null
  contractLimit?: number | null
  scalingRestrictions?: string | null
  profitSplitPct?: number | null
  payoutThreshold?: number | null
  payoutFrequency?: string | null
  payoutEligibilityRules?: string | null
  resetDetails?: string | null
  updatedAt?: string | null
}

export type MonthlyGrowthPlan = {
  id: string
  monthKey: string
  timezone: string
  monthStartBalance?: number | null
  monthStartEquity?: number | null
  targetType: string
  targetBasis: string
  targetPct?: number | null
  targetAmount?: number | null
  targetR?: number | null
  plannedRiskPerTradePct?: number | null
  hardMaxRiskPerTradePct?: number | null
  plannedMaxTradesPerDay?: number | null
  plannedMaxTradesPerWeek?: number | null
  plannedMinimumRr?: number | null
  snapshotSource: string
  snapshotLockedAt?: string | null
  snapshotAdjustmentAmount?: number | null
  snapshotAdjustmentNote?: string | null
  targetChangedAt?: string | null
}

export type OpenTradeExposure = {
  tradeId: string
  symbol: string
  direction: string
  entryPrice?: number | null
  currentPrice?: number | null
  priceTimestamp?: string | null
  priceStale: boolean
  quantity?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
  floatingPnl?: number | null
  openRisk?: number | null
  plannedRr?: number | null
  currentR?: number | null
  notionalExposure?: number | null
  ageMinutes: number
  strategy?: string | null
  setup?: string | null
  warnings: string[]
}

export type GrowthCoachMessage = {
  key: string
  category: string
  severity: 'INFO' | 'POSITIVE' | 'CAUTION' | 'WARNING' | 'CRITICAL'
  priority: number
  titleKey: string
  messageKey: string
  actionKeys: string[]
  params: Record<string, string | number>
  evidence: Record<string, string | number>
  blocking: boolean
}

export type GrowthCoachDetail = {
  account: {
    id: string
    name: string
    broker?: string | null
    type: GrowthAccountType
    currency: string
    timezone: string
  }
  profile: GrowthProfile
  monthlyPlan: MonthlyGrowthPlan
  capital: {
    initialCapital?: number | null
    ledgerNet?: number | null
    lifetimeRealisedTradePnl?: number | null
    currentRealisedBalance?: number | null
    currentFloatingPnl?: number | null
    currentEquity?: number | null
    withdrawableProfit?: number | null
    profitAfterSplit?: number | null
    drawdownBuffer?: number | null
    dailyLossRemaining?: number | null
    totalLossRemaining?: number | null
    profitTargetRemaining?: number | null
    floatingPnlAvailable: boolean
    riskReference: string
  }
  target: {
    targetAmount: number
    realisedCurrentMonthPnl: number
    floatingPnl?: number | null
    realisedProgressPct: number
    equityAdjustedProgressPct?: number | null
    remainingTargetAmount: number
    equityAdjustedRemainingAmount?: number | null
    requiredR?: number | null
    tradingDaysRemaining: number
    targetReached: boolean
  }
  realisedPerformance: AnalyticsResponse
  openExposure: {
    openTradeCount: number
    totalFloatingPnl?: number | null
    floatingPnlAvailable: boolean
    grossLongExposure: number
    grossShortExposure: number
    netExposure: number
    totalOpenRisk?: number | null
    openRiskKnown: boolean
    openRiskPct?: number | null
    openReward?: number | null
    tradesWithoutStop: number
    tradesWithoutQuantity: number
    tradesWithoutEntryPrice: number
    tradesWithoutReliablePrice: number
    concentratedSymbol?: string | null
    concentrationPct?: number | null
    trades: OpenTradeExposure[]
  }
  riskPlan: {
    state: string
    recommendedRiskAmount?: number | null
    recommendedRiskPct?: number | null
    maximumPermittedRiskAmount?: number | null
    maximumPermittedRiskPct?: number | null
    capByDailyLimit?: number | null
    capByDrawdown?: number | null
    capByOpenExposure?: number | null
    reasons: string[]
    stopConditions: string[]
  }
  feasibility: {
    classification: string
    reasonKeys: string[]
    reasonParams: Record<string, string | number>
  }
  projection: {
    available: boolean
    dataset: string
    sampleSize: number
    simulationCount?: number | null
    expectancyR?: number | null
    expectancyMoney?: number | null
    expectedTradesLow?: number | null
    expectedTradesBase?: number | null
    expectedTradesHigh?: number | null
    expectedTradingDaysLow?: number | null
    expectedTradingDaysBase?: number | null
    expectedTradingDaysHigh?: number | null
    probabilityTargetBeforeMonthEnd?: number | null
    probabilityProfitableBelowTarget?: number | null
    probabilityFinishNegative?: number | null
    probabilityDrawdownFirst?: number | null
    probabilityRuleBreach?: number | null
    unavailableReasonKey?: string | null
  }
  confidence: {
    level: string
    score: number
    reasonKeys: string[]
    reasonParams: Record<string, string | number>
  }
  coachMessages: GrowthCoachMessage[]
  scenarios: Array<{
    key: string
    riskPct: number
    riskAmount: number
    estimatedDays?: number | null
    targetProbability?: number | null
    drawdownProbability?: number | null
    recommended: boolean
    available: boolean
    warningKey?: string | null
  }>
  performanceDrivers: {
    strongestStrategy?: Driver | null
    weakestStrategy?: Driver | null
    strongestSession?: Driver | null
    weakestSession?: Driver | null
    strongestSymbol?: Driver | null
    weakestSymbol?: Driver | null
    strongestRrBucket?: Driver | null
    costPctOfGrossProfit?: number | null
    costPerTrade?: number | null
  }
  dataQuality: {
    validClosedTrades: number
    missingCloseTime: number
    missingPnl: number
    inconsistentPnl: number
    missingRisk: number
    missingStop: number
    missingQuantity: number
    missingStrategy: number
    missingSetup: number
    reconstructedCapital: boolean
    affectedTradeIds: string[]
  }
  ledgerEvents: LedgerEvent[]
  progressSeries: Array<{
    date: string
    realisedBalance: number
    targetBalance: number
    plannedBalance: number
    drawdownBoundary?: number | null
  }>
  disclaimer: string
}

export type Driver = {
  name: string
  sampleSize: number
  expectancy: number
  expectancyR?: number | null
  confidence: string
}

export type LedgerEvent = {
  id: string
  eventType: string
  amount: number
  currency: string
  eventTime: string
  description?: string | null
  externalReference?: string | null
}

export type GrowthCoachResponse = {
  mode: GrowthCoachMode
  generatedAt: string
  requiresAccountSelection: boolean
  portfolioAccounts: PortfolioAccount[]
  detail?: GrowthCoachDetail | null
}

export type GrowthProfileRequest = Omit<GrowthProfile, 'id' | 'updatedAt'> & { currency: string }
export type MonthlyPlanRequest = {
  targetType: string
  targetBasis: string
  targetPct?: number | null
  targetAmount?: number | null
  targetR?: number | null
  plannedRiskPerTradePct?: number | null
  hardMaxRiskPerTradePct?: number | null
  plannedMaxTradesPerDay?: number | null
  plannedMaxTradesPerWeek?: number | null
  plannedMinimumRr?: number | null
  changeReason?: string
}
export type LedgerEventRequest = Omit<LedgerEvent, 'id'>

const query = (accountId?: string, month?: string) => {
  const params = new URLSearchParams()
  if (accountId) params.set('accountId', accountId)
  if (month) params.set('month', month)
  return params.toString() ? `?${params.toString()}` : ''
}

export const fetchGrowthCoach = (accountId?: string, month?: string) =>
  apiGet<GrowthCoachResponse>(`/growth-coach${query(accountId, month)}`)

export async function updateGrowthProfile(accountId: string, request: GrowthProfileRequest) {
  const result = await apiPut<GrowthProfile>(`/growth-coach/accounts/${accountId}/profile`, request)
  announceAnalyticsDataChanged()
  return result
}

export async function updateMonthlyPlan(accountId: string, month: string, request: MonthlyPlanRequest) {
  const result = await apiPut<MonthlyGrowthPlan>(`/growth-coach/accounts/${accountId}/plans/${month}`, request)
  announceAnalyticsDataChanged()
  return result
}

export async function createLedgerEvent(accountId: string, request: LedgerEventRequest) {
  const result = await apiPost<LedgerEvent>(`/growth-coach/accounts/${accountId}/ledger`, request)
  announceAnalyticsDataChanged()
  return result
}

export async function deleteLedgerEvent(accountId: string, eventId: string) {
  await apiDelete(`/growth-coach/accounts/${accountId}/ledger/${eventId}`)
  announceAnalyticsDataChanged()
}

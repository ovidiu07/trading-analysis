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
  operatingSystem?: GrowthOperatingSystem | null
  disclaimer: string
}

export type GrowthPeriodType = 'DAY' | 'WEEK' | 'MONTH'

export type GrowthPeriodPlan = {
  id: string
  periodType: GrowthPeriodType
  periodKey: string
  timezone: string
  targetType: string
  targetValue: number
  targetAmount?: number | null
  maxLossType: string
  maxLossValue?: number | null
  maxLossAmount?: number | null
  maxTrades?: number | null
  maxRiskBudget?: number | null
  maxConsecutiveLosses?: number | null
  maxLosingDays?: number | null
  defaultRiskPerTrade?: number | null
  minimumRr?: number | null
  stopAfterTarget: boolean
  reduceRiskAfterTarget: boolean
  riskReductionPct?: number | null
  stopAfterMaxLoss: boolean
  stopAfterConsecutiveLosses: boolean
  permittedSessions?: string | null
  focus?: string | null
  notes?: string | null
  allocationMode: 'MANUAL' | 'AUTOMATIC'
  active: boolean
  version: number
  effectiveFrom: string
  updatedAt?: string | null
}

export type GrowthPeriodSummary = {
  periodType: GrowthPeriodType
  periodStartBalance?: number | null
  realisedTradingPnl: number
  realisedPnlPct?: number | null
  realisedR: number
  netLedgerMovement: number
  netAccountChange: number
  currentRealisedBalance?: number | null
  currentEquity?: number | null
  floatingPnl?: number | null
  targetAmount: number
  targetProgressPct: number
  targetRemaining: number
  lossAllowanceRemaining?: number | null
  completedTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  averageTrade: number
  grossProfit: number
  grossLoss: number
  riskUsed: number
  riskRemaining?: number | null
  tradesRemaining?: number | null
  currentConsecutiveLosses: number
  maximumDrawdown: number
  openRisk?: number | null
}

export type GrowthOperatingSystem = {
  selectedPeriod: {
    periodType: GrowthPeriodType
    periodKey: string
    anchorDate: string
    startsAt: string
    endsAtExclusive: string
    timezone: string
  }
  plans: { day: GrowthPeriodPlan; week: GrowthPeriodPlan; month: GrowthPeriodPlan }
  selectedSummary: GrowthPeriodSummary
  todayActivity: {
    summary: GrowthPeriodSummary
    currentlyOpenTrades: number
    tradingPermission: string
    closedTrades: Array<{
      tradeId: string
      symbol: string
      direction: string
      openedAt: string
      closedAt: string
      pnl: number
      realisedR?: number | null
      initialRisk?: number | null
      strategy?: string | null
      setup?: string | null
      session?: string | null
    }>
  }
  tradingPermission: {
    state: string
    primaryReason: string
    secondaryReasons: string[]
    maximumPermittedRisk?: number | null
    maximumPermittedRiskPct?: number | null
    remainingTrades?: number | null
    applicableLimit: GrowthPeriodType
    recommendedAction: string
  }
  periodComparisons: Array<{
    periodType: GrowthPeriodType
    realisedPnl: number
    realisedPct?: number | null
    realisedR: number
    target: number
    targetProgress: number
    trades: number
    winRate: number
    averageTrade: number
    riskUsed: number
    riskRemaining?: number | null
    drawdown: number
    adherenceScore: number
    tradingStatus: string
  }>
  planAdherence: {
    score: number
    passedRules: number
    failedRules: number
    unavailableRules: number
    confidence: string
    passed: string[]
    failed: string[]
    unavailable: string[]
  }
  metricConfidence: Array<{
    metric: string
    status: string
    score: number
    reason: string
    missingDataCount: number
    affectedMetrics: string[]
    action: string
  }>
  chartSeries: Array<{
    date: string
    cumulativeTradingPnl: number
    dailyTradingPnl: number
    cumulativeR: number
    dailyR: number
    realisedBalance?: number | null
    equity?: number | null
    plannedProgress: number
    target: number
    maximumLoss?: number | null
    drawdownLimit?: number | null
    cumulativeRisk: number
  }>
  chartMarkers: Array<{
    id: string
    type: string
    timestamp: string
    amount?: number | null
    label?: string | null
    tradeId?: string | null
    ledgerEventId?: string | null
  }>
  planHistory: Array<{
    id: string
    periodType: GrowthPeriodType
    periodKey: string
    version: number
    reason: string
    changedAt: string
  }>
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
  eventStatus?: string | null
  planningBehavior?: string | null
  reversalEventId?: string | null
  createdAt?: string | null
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
export type LedgerEventRequest = Omit<LedgerEvent,
  'id' | 'eventStatus' | 'planningBehavior' | 'reversalEventId' | 'createdAt'>
export type PeriodPlanRequest = Omit<GrowthPeriodPlan,
  'id' | 'periodType' | 'periodKey' | 'timezone' | 'targetAmount' | 'maxLossAmount' |
  'version' | 'effectiveFrom' | 'updatedAt'> & { changeReason: string }
export type ReconcileBalanceRequest = {
  brokerReportedBalance: number
  effectiveDate: string
  effectiveTime: string
  timezone: string
  reason: string
  note?: string
  externalReference?: string
  planningBehavior: 'PRESERVE_BASELINE' | 'REBASE_FUTURE' | 'RESET_CURRENT'
  resetConfirmed: boolean
}

const query = (accountId?: string, month?: string, period?: GrowthPeriodType, date?: string) => {
  const params = new URLSearchParams()
  if (accountId) params.set('accountId', accountId)
  if (month) params.set('month', month)
  if (period) params.set('period', period)
  if (date) params.set('date', date)
  return params.toString() ? `?${params.toString()}` : ''
}

export const fetchGrowthCoach = (accountId?: string, month?: string, period?: GrowthPeriodType, date?: string) =>
  apiGet<GrowthCoachResponse>(`/growth-coach${query(accountId, month, period, date)}`)

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

export async function updatePeriodPlan(accountId: string, plan: GrowthPeriodPlan, request: PeriodPlanRequest) {
  const result = await apiPut<GrowthPeriodPlan>(
    `/growth-coach/accounts/${accountId}/period-plans/${plan.periodType}/${plan.periodKey}`,
    request
  )
  announceAnalyticsDataChanged()
  return result
}

export async function reconcileAccountBalance(accountId: string, request: ReconcileBalanceRequest) {
  const result = await apiPost<LedgerEvent>(`/growth-coach/accounts/${accountId}/reconcile`, request)
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

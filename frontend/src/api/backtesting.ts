import { apiDelete, apiGet, apiPatch, apiPost, apiPostMultipart } from './client'
import type { AssetItem } from './assets'

export type BacktestingScreenshotResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'MISSED' | 'INVALID' | 'GOOD_EXAMPLE' | 'BAD_EXAMPLE'
export type BacktestingTradeDirection = 'LONG' | 'SHORT'
export type BacktestingTradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN'
export type BacktestingTradeSource = 'MANUAL' | 'IMPORT' | 'SCREENSHOT' | 'LIVE'
export type BacktestingTradeScope = 'BACKTEST' | 'LIVE' | 'REPLAY'
export type BacktestingAutoImportMode = 'EXACT_MATCH' | 'STRATEGY_MATCH' | 'REVIEW_BEFORE_IMPORT' | 'DISABLED'
export type BacktestingSyncStatus = 'SYNCED' | 'NEEDS_REVIEW' | 'NOT_LINKED' | 'EXCLUDED' | 'PENDING' | 'ERROR'
export type BacktestingClassificationStatus = 'COMPLETE' | 'NEEDS_CLASSIFICATION' | 'PARTIAL'
export type BacktestingEvidenceStatus = 'INSUFFICIENT_DATA' | 'EXPLORATORY' | 'EARLY_SIGNAL' | 'DEVELOPING_EDGE' | 'VALIDATED_EVIDENCE' | 'NEEDS_REVIEW'
export type BacktestingEvidenceConfidence = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH'
export type BacktestingGapType = 'BULLISH' | 'BEARISH' | 'UNKNOWN'
export type BacktestingGapFillStatus = 'UNFILLED' | 'PARTIALLY_FILLED' | 'FILLED' | 'REJECTED_FROM_GAP' | 'RELIQUIDATED_GAP' | 'UNKNOWN'
export type BacktestingGapLiquidityRelation = 'AFTER_EXTERNAL_LIQUIDITY_SWEEP' | 'AFTER_INTERNAL_LIQUIDITY_SWEEP' | 'INTO_SESSION_POI' | 'AFTER_MSS' | 'CONTINUATION_DISPLACEMENT' | 'UNKNOWN'

export type BacktestingStrategySummary = {
  id: string
  name: string
  model?: string | null
  entryConditions?: string[]
  invalidationLogic?: string | null
  tpFramework?: string | null
  noTradeRules?: string | null
}

export type BacktestingWorkspace = {
  id: string
  symbol: string
  marketType?: string | null
  strategyId?: string | null
  strategyNameSnapshot?: string | null
  strategyName?: string | null
  title?: string | null
  primaryTimeframe?: string | null
  contextTimeframe?: string | null
  executionTimeframe?: string | null
  entryTimeframe?: string | null
  session?: string | null
  autoImportMode?: BacktestingAutoImportMode | null
  description?: string | null
  researchObjective?: string | null
  executionObservations?: string | null
  liveExecutionGap?: string | null
  nextTestingObjective?: string | null
  researchConclusion?: string | null
  numberOfTrades: number
  winningTrades: number
  losingTrades: number
  breakevenTrades: number
  averageR?: number | null
  totalR?: number | null
  expectancy?: number | null
  profitFactor?: number | null
  averageWinR?: number | null
  averageLossR?: number | null
  largestWinR?: number | null
  largestLossR?: number | null
  winRate: number
  lossRate: number
  breakevenRate: number
  categorizedTrades: number
  missingClassificationCount: number
  structuredTradeCount?: number
  manualTradeCount?: number
  importedTradeCount?: number
  liveTradeCount?: number
  inboxCount?: number
  statsSource?: 'STRUCTURED' | 'LEGACY_MANUAL'
  sampleQuality?: string | null
  evidenceStatus?: BacktestingEvidenceStatus | null
  evidenceConfidence?: BacktestingEvidenceConfidence | null
  bestEdgeLensName?: string | null
  screenshotCount: number
  notes?: string | null
  whatWorked?: string | null
  whatFailed?: string | null
  bestConditions?: string | null
  avoidConditions?: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt?: string | null
  updatedAt?: string | null
  strategy?: BacktestingStrategySummary | null
}

export type BacktestingWorkspacePayload = {
  symbol: string
  marketType?: string | null
  strategyId?: string | null
  strategyNameSnapshot?: string | null
  title?: string | null
  primaryTimeframe?: string | null
  contextTimeframe?: string | null
  executionTimeframe?: string | null
  entryTimeframe?: string | null
  session?: string | null
  autoImportMode?: BacktestingAutoImportMode | null
  description?: string | null
  researchObjective?: string | null
  executionObservations?: string | null
  liveExecutionGap?: string | null
  nextTestingObjective?: string | null
  researchConclusion?: string | null
  numberOfTrades?: number
  winningTrades?: number
  losingTrades?: number
  breakevenTrades?: number
  averageR?: number | null
  notes?: string | null
  whatWorked?: string | null
  whatFailed?: string | null
  bestConditions?: string | null
  avoidConditions?: string | null
}

export type BacktestingSummary = {
  totalBacktests: number
  totalScreenshots: number
  totalTradesTested: number
  manualTrades?: number
  importedTrades?: number
  liveTrades?: number
  averageWinRate: number
  averageExpectancy?: number
  strategiesNeedingReview?: number
  bestPerformer?: string | null
}

export type BacktestingListResponse = {
  summary: BacktestingSummary
  workspaces: BacktestingWorkspace[]
}

export type BacktestingScreenshot = {
  id: string
  workspaceId: string
  assetId: string
  originalFileName: string
  contentType?: string | null
  sizeBytes?: number | null
  url?: string | null
  viewUrl?: string | null
  downloadUrl?: string | null
  thumbnailUrl?: string | null
  backtestingTradeId?: string | null
  caption?: string | null
  tradeResult?: BacktestingScreenshotResult | null
  session?: string | null
  timeframe?: string | null
  tags: string[]
  sortOrder?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  asset?: AssetItem | null
}

export type BacktestingScreenshotPayload = {
  caption?: string | null
  tradeResult?: BacktestingScreenshotResult | null
  session?: string | null
  timeframe?: string | null
  tags?: string[]
  sortOrder?: number | null
  backtestingTradeId?: string | null
}

export type BacktestingTrade = {
  id: string
  workspaceId: string
  liveTradeId?: string | null
  date: string
  weekday?: string | null
  entryTime: string
  instrument: string
  direction: BacktestingTradeDirection
  session?: string | null
  setupName?: string | null
  strategyId?: string | null
  strategySource?: 'MY' | 'MENTOR' | null
  strategyNameSnapshot?: string | null
  gapPresent?: boolean
  gapType?: BacktestingGapType | null
  gapTimeframe?: string | null
  gapCreatedAt?: string | null
  gapMitigatedAt?: string | null
  gapHigh?: number | null
  gapLow?: number | null
  gapMidpoint?: number | null
  gapSizePoints?: number | null
  gapSizePercent?: number | null
  gapEntryPositionPercent?: number | null
  gapFillStatus?: BacktestingGapFillStatus | null
  gapRelationToLiquidity?: BacktestingGapLiquidityRelation | null
  gapConfluenceNotes?: string | null
  riskPercent?: number | null
  plannedRR?: number | null
  result: BacktestingTradeResult
  pnlR: number
  contextTimeframe?: string | null
  executionTimeframe?: string | null
  entryTimeframe?: string | null
  tags: string[]
  notes?: string | null
  source: BacktestingTradeSource
  tradeScope: BacktestingTradeScope
  syncStatus?: BacktestingSyncStatus | null
  classificationStatus?: BacktestingClassificationStatus | null
  includedInAnalytics?: boolean
  excludedReason?: string | null
  ruleBreakCount?: number
  screenshotCount?: number
  createdAt?: string | null
  updatedAt?: string | null
}

export type BacktestingTradePayload = Omit<BacktestingTrade, 'id' | 'workspaceId' | 'weekday' | 'screenshotCount' | 'createdAt' | 'updatedAt'>

export type BacktestingMetric = {
  trades: number
  wins: number
  losses: number
  breakevens: number
  winRate: number
  lossRate: number
  breakevenRate: number
  totalR: number
  averageR: number
  expectancy: number
  profitFactor?: number | null
  averageWinR: number
  averageLossR: number
  largestWinR: number
  largestLossR: number
  medianR?: number
  maximumDrawdownR?: number
  maximumLosingStreak?: number
  currentLosingStreak?: number
  sampleQuality: string
}

export type BacktestingBreakdownRow = {
  dimension: string
  label: string
  filters: Record<string, unknown>
  metrics: BacktestingMetric
  expectancyDelta: number
  totalRDelta: number
  verdict: string
  warning?: string | null
}

export type BacktestingAnalytics = {
  baseline: BacktestingMetric
  breakdowns: Record<string, BacktestingBreakdownRow[]>
  impactRows: BacktestingBreakdownRow[]
  sourceMetrics?: Partial<Record<BacktestingTradeSource, BacktestingMetric>>
  liveExpectancyGap?: number | null
  regressionStatus?: 'STABLE' | 'IMPROVING' | 'WATCH' | 'DETERIORATING' | 'INSUFFICIENT_LIVE_DATA'
  recentLiveSampleSize?: number
}

export type BacktestingEvidence = {
  id: string
  workspaceId?: string | null
  workspaceName?: string | null
  liveTradeId: string
  sourceType: 'LIVE'
  syncStatus: BacktestingSyncStatus
  classificationStatus: BacktestingClassificationStatus
  includedInAnalytics: boolean
  excludedReason?: string | null
  researchClassification: Record<string, unknown>
  tradeDate?: string | null
  openedAt?: string | null
  closedAt?: string | null
  instrument?: string | null
  direction?: string | null
  session?: string | null
  timeframe?: string | null
  strategyId?: string | null
  strategyName?: string | null
  setupName?: string | null
  setupGrade?: string | null
  result?: string | null
  realizedR?: number | null
  netPnl?: number | null
  riskPercent?: number | null
  ruleBreakCount: number
  screenshotCount: number
  notes?: string | null
  lastSyncedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type BacktestingResearchInbox = {
  total: number
  needsWorkspace: number
  needsClassification: number
  ambiguousMatch: number
  syncErrors: number
  excluded: number
  items: BacktestingEvidence[]
}

export type BacktestingEvidenceUpdatePayload = {
  workspaceId?: string | null
  classificationStatus?: BacktestingClassificationStatus
  includedInAnalytics?: boolean
  excludedReason?: string | null
  researchClassification?: Record<string, unknown>
}

export type BacktestingEdgeLens = {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  filterDefinition: Record<string, unknown>
  metrics: BacktestingMetric
  recalculatedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type BacktestingEdgeLensPayload = {
  name: string
  description?: string | null
  filterDefinition: Record<string, unknown>
}

export type BacktestingImportResponse = {
  imported: number
  invalid: number
  errors: string[]
  trades: BacktestingTrade[]
}

export async function listBacktestingWorkspaces(includeArchived = false) {
  return apiGet<BacktestingListResponse>(`/backtesting/workspaces?includeArchived=${includeArchived}`)
}

export async function createBacktestingWorkspace(payload: BacktestingWorkspacePayload) {
  return apiPost<BacktestingWorkspace>('/backtesting/workspaces', payload)
}

export async function getBacktestingWorkspace(id: string) {
  return apiGet<BacktestingWorkspace>(`/backtesting/workspaces/${encodeURIComponent(id)}`)
}

export async function updateBacktestingWorkspace(id: string, payload: BacktestingWorkspacePayload) {
  return apiPatch<BacktestingWorkspace>(`/backtesting/workspaces/${encodeURIComponent(id)}`, payload)
}

export async function archiveBacktestingWorkspace(id: string) {
  return apiPost<void>(`/backtesting/workspaces/${encodeURIComponent(id)}/archive`, {})
}

export async function restoreBacktestingWorkspace(id: string) {
  return apiPost<BacktestingWorkspace>(`/backtesting/workspaces/${encodeURIComponent(id)}/restore`, {})
}

export async function getBacktestingResearchInbox() {
  return apiGet<BacktestingResearchInbox>('/backtesting/research-inbox')
}

export async function updateBacktestingEvidence(id: string, payload: BacktestingEvidenceUpdatePayload) {
  return apiPatch<BacktestingEvidence>(`/backtesting/evidence/${encodeURIComponent(id)}`, payload)
}

export async function retryBacktestingEvidence(id: string) {
  return apiPost<BacktestingEvidence>(`/backtesting/evidence/${encodeURIComponent(id)}/retry`, {})
}

export async function listBacktestingScreenshots(workspaceId: string) {
  return apiGet<BacktestingScreenshot[]>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/screenshots`)
}

export async function listBacktestingTrades(workspaceId: string) {
  return apiGet<BacktestingTrade[]>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/trades`)
}

export async function createBacktestingTrade(workspaceId: string, payload: BacktestingTradePayload) {
  return apiPost<BacktestingTrade>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/trades`, payload)
}

export async function updateBacktestingTrade(id: string, payload: BacktestingTradePayload) {
  return apiPatch<BacktestingTrade>(`/backtesting/trades/${encodeURIComponent(id)}`, payload)
}

export async function deleteBacktestingTrade(id: string) {
  return apiDelete(`/backtesting/trades/${encodeURIComponent(id)}`)
}

export async function importBacktestingTrades(workspaceId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostMultipart<BacktestingImportResponse>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/trades/import`, formData)
}

export async function getBacktestingAnalytics(workspaceId: string) {
  return apiGet<BacktestingAnalytics>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/analytics`)
}

export async function listBacktestingEdgeLenses(workspaceId: string) {
  return apiGet<BacktestingEdgeLens[]>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/edge-lenses`)
}

export async function createBacktestingEdgeLens(workspaceId: string, payload: BacktestingEdgeLensPayload) {
  return apiPost<BacktestingEdgeLens>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/edge-lenses`, payload)
}

export async function updateBacktestingEdgeLens(id: string, payload: BacktestingEdgeLensPayload) {
  return apiPatch<BacktestingEdgeLens>(`/backtesting/edge-lenses/${encodeURIComponent(id)}`, payload)
}

export async function recalculateBacktestingEdgeLens(id: string) {
  return apiPost<BacktestingEdgeLens>(`/backtesting/edge-lenses/${encodeURIComponent(id)}/recalculate`, {})
}

export async function deleteBacktestingEdgeLens(id: string) {
  return apiDelete(`/backtesting/edge-lenses/${encodeURIComponent(id)}`)
}

export async function uploadBacktestingScreenshots(workspaceId: string, files: File[]) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  return apiPostMultipart<BacktestingScreenshot[]>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/screenshots`, formData)
}

export async function updateBacktestingScreenshot(id: string, payload: BacktestingScreenshotPayload) {
  return apiPatch<BacktestingScreenshot>(`/backtesting/screenshots/${encodeURIComponent(id)}`, payload)
}

export async function deleteBacktestingScreenshot(id: string) {
  return apiDelete(`/backtesting/screenshots/${encodeURIComponent(id)}`)
}

export async function detachBacktestingScreenshotTrade(id: string) {
  return apiPost<BacktestingScreenshot>(`/backtesting/screenshots/${encodeURIComponent(id)}/detach-trade`, {})
}

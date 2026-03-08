import { apiGet, apiPost, apiPut } from './client'

export type ReadinessState = 'READY' | 'INCOMPLETE' | 'BLOCKED'
export type SetupStatus =
  | 'DRAFT'
  | 'WATCHING'
  | 'READY'
  | 'TRIGGERED'
  | 'EXECUTED'
  | 'INVALIDATED'
  | 'SKIPPED'
  | 'ARCHIVED'
  | 'CLOSED'

export type WorkspaceReadinessStep = {
  key: string
  label: string
  state: ReadinessState
  summary: string
  missingItems: string[]
}

export type WorkspaceReadiness = {
  score: number
  state: ReadinessState
  summary: string
  missingItems: string[]
  blockers: string[]
  steps: WorkspaceReadinessStep[]
}

export type SetupLevel = {
  label?: string | null
  price?: number | null
  source?: string | null
  notes?: string | null
}

export type SetupContext = {
  narrative?: string | null
  liquidityNotes?: string | null
  invalidationIdea?: string | null
  newsSafety?: string | null
  notes?: string | null
}

export type SetupTrigger = {
  sweepIdentified?: boolean | null
  displacementConfirmed?: boolean | null
  structureConfirmed?: boolean | null
  confirmationModel?: string | null
  sweepType?: string | null
  liquiditySource?: string | null
  confirmationTimeframe?: string | null
  displacementRule?: string | null
  structureRule?: string | null
  fvgRequirement?: string | null
  entryModel?: string | null
  entryZone?: string | null
  rrEstimate?: number | null
  rrMinimum?: number | null
  confluenceRequirement?: string | null
  newsRestriction?: string | null
  sessionRestriction?: string | null
  invalidationThreshold?: string | null
  notes?: string | null
}

export type SetupExecution = {
  activeExecutionId?: string | null
  entryPrice?: number | null
  stopLossPrice?: number | null
  takeProfitPrice?: number | null
  riskAmount?: number | null
  quantity?: number | null
  invalidation?: string | null
  whyWrong?: string | null
  initialNotes?: string | null
  tickets?: ExecutionTicket[]
}

export type ExecutionTicketStatus =
  | 'DRAFT'
  | 'WATCHING'
  | 'READY'
  | 'ACTIVE'
  | 'PARTIAL'
  | 'CLOSED'
  | 'INVALIDATED'
  | 'SKIPPED'

export type ExecutionTicket = {
  id: string
  label: string
  status: ExecutionTicketStatus
  entryPrice?: number | null
  stopLossPrice?: number | null
  takeProfitPrice?: number | null
  riskAmount?: number | null
  quantity?: number | null
  invalidation?: string | null
  whyWrong?: string | null
  initialNotes?: string | null
  notes?: string | null
  linkedTradeId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  startedAt?: string | null
  closedAt?: string | null
}

export type SetupExecutionWorkspace = {
  activeExecutionId?: string | null
  tickets: ExecutionTicket[]
}

export type SetupStrategySnapshot = {
  strategyId?: string | null
  source?: 'MY' | 'MENTOR' | string | null
  name?: string | null
  model?: string | null
  entryConditionsRich?: string | null
  entryConditions?: string[]
  invalidationLogic?: string | null
  tpFramework?: string | null
  noTradeRules?: string | null
  sessionSuitability?: string[]
  tags?: string[]
  snapshotAssetId?: string | null
  importedAt?: string | null
  localEditsApplied?: boolean | null
}

export type ReviewTimelineEntry = {
  id: string
  type?: string | null
  title?: string | null
  body?: string | null
  executionId?: string | null
  tradeId?: string | null
  occurredAt?: string | null
}

export type SetupReview = {
  liveNotes?: string | null
  mistakes?: string | null
  lessons?: string | null
  outcomeSummary?: string | null
  tags?: string[]
  timeline?: ReviewTimelineEntry[]
}

export type MentorReference = {
  planTitle?: string | null
  symbol?: string | null
  bias?: string | null
  preferredScenario?: string | null
  invalidation?: string | null
  noTradeWarning?: string | null
  keyLevels?: string[]
}

export type SetupItem = {
  id: string
  symbol: string
  direction: 'LONG' | 'SHORT'
  market?: 'STOCK' | 'CFD' | 'FOREX' | 'CRYPTO' | 'FUTURES' | 'OPTIONS' | 'OTHER' | null
  tradeSession?: 'ASIA' | 'LONDON' | 'NY' | 'CUSTOM' | 'NY_AM' | 'NY_PM' | null
  strategyId?: string | null
  strategyLabel?: string | null
  setupTitle: string
  biasAlignment?: string | null
  status: SetupStatus
  linkedTradeId?: string | null
  readiness: WorkspaceReadiness
  context: SetupContext
  strategySnapshot?: SetupStrategySnapshot | null
  trigger: SetupTrigger
  execution: SetupExecution
  executions: SetupExecutionWorkspace
  review?: SetupReview | null
  levels: SetupLevel[]
  mentorReference?: MentorReference | null
  sortOrder?: number | null
  executedAt?: string | null
  invalidatedAt?: string | null
  skippedAt?: string | null
  archivedAt?: string | null
  closedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SessionQuickStats = {
  maxLoss?: number | null
  riskUsed?: number | null
  tradesTaken: number
  activeSetupCount: number
  realizedPnl?: number | null
}

export type SessionSummary = {
  id: string
  tradingDate: string
  sessionName?: string | null
  objective?: string | null
  bias?: string | null
  biasReason?: string | null
  narrative?: string | null
  dailyMaxLoss?: number | null
  maxTrades?: number | null
  liveModeOnly: boolean
  lockedInAt?: string | null
  status: 'ACTIVE' | 'COMPLETED'
  quickStats: SessionQuickStats
  readiness: WorkspaceReadiness
  warnings: string[]
}

export type ActivityTrade = {
  tradeId: string
  setupId?: string | null
  setupTitle?: string | null
  symbol: string
  direction: 'LONG' | 'SHORT'
  tradeSession?: 'ASIA' | 'LONDON' | 'NY' | 'CUSTOM' | 'NY_AM' | 'NY_PM' | null
  status: string
  entryPrice?: number | null
  exitPrice?: number | null
  riskAmount?: number | null
  rMultiple?: number | null
  pnlNet?: number | null
  openedAt?: string | null
  closedAt?: string | null
}

export type LiveWorkspaceResponse = {
  session: SessionSummary
  activeSetupId?: string | null
  setups: SetupItem[]
  activity: ActivityTrade[]
}

export type SessionWorkspaceRequest = {
  sessionName?: string | null
  objective?: string | null
  bias?: string | null
  biasReason?: string | null
  narrative?: string | null
  dailyMaxLoss?: number | null
  maxTrades?: number | null
  lockSession?: boolean | null
}

export type SetupDraftRequest = {
  symbol?: string | null
  direction?: 'LONG' | 'SHORT' | null
  market?: SetupItem['market']
  tradeSession?: SetupItem['tradeSession']
  strategyId?: string | null
  strategyLabel?: string | null
  setupTitle?: string | null
  biasAlignment?: string | null
  context?: SetupContext
  strategySnapshot?: SetupStrategySnapshot | null
  trigger?: SetupTrigger
  execution?: SetupExecution
  executions?: SetupExecutionWorkspace
  review?: SetupReview | null
  levels?: SetupLevel[]
  mentorReference?: MentorReference | null
}

export async function getSessionWorkspace() {
  return apiGet<LiveWorkspaceResponse>('/today/session/workspace')
}

export async function updateSessionWorkspace(sessionId: string, payload: SessionWorkspaceRequest) {
  return apiPut<LiveWorkspaceResponse>(`/today/session/${encodeURIComponent(sessionId)}`, payload)
}

export async function createSetupCandidate(sessionId: string, payload: SetupDraftRequest) {
  return apiPost<LiveWorkspaceResponse>(`/today/session/${encodeURIComponent(sessionId)}/setups`, payload)
}

export async function updateSetupCandidate(sessionId: string, setupId: string, payload: SetupDraftRequest) {
  return apiPut<LiveWorkspaceResponse>(
    `/today/session/${encodeURIComponent(sessionId)}/setups/${encodeURIComponent(setupId)}`,
    payload
  )
}

export async function duplicateSetupCandidate(sessionId: string, setupId: string) {
  return apiPost<LiveWorkspaceResponse>(
    `/today/session/${encodeURIComponent(sessionId)}/setups/${encodeURIComponent(setupId)}/duplicate`,
    {}
  )
}

export async function reorderSetupCandidates(sessionId: string, setupIds: string[]) {
  return apiPost<LiveWorkspaceResponse>(`/today/session/${encodeURIComponent(sessionId)}/setups/reorder`, { setupIds })
}

export async function updateSetupCandidateStatus(sessionId: string, setupId: string, status: SetupStatus) {
  return apiPost<LiveWorkspaceResponse>(
    `/today/session/${encodeURIComponent(sessionId)}/setups/${encodeURIComponent(setupId)}/status`,
    { status }
  )
}

export async function selectActiveSetupCandidate(sessionId: string, setupId: string | null) {
  return apiPost<LiveWorkspaceResponse>(`/today/session/${encodeURIComponent(sessionId)}/active-setup`, { setupId })
}

export async function startTradeFromSetupCandidate(sessionId: string, setupId: string, executionId?: string | null) {
  return apiPost<LiveWorkspaceResponse>(
    `/today/session/${encodeURIComponent(sessionId)}/setups/${encodeURIComponent(setupId)}/start-trade`,
    { executionId: executionId || null }
  )
}

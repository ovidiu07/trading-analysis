import { getCurrentLanguage } from '../i18n'
import { ApiError, apiDelete, apiGet, apiPost, apiPut, clearAuthToken } from './client'
import type { PlanScope } from './plans'

const API_URL = import.meta.env.VITE_API_URL || '/api'

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

export type SetupDirection = 'LONG' | 'SHORT' | 'UNDECIDED'

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

export type ConfluenceItem = {
  id: string
  label: string
  checked: boolean
  required: boolean
  source: 'DEFAULT' | 'STRATEGY' | 'CUSTOM' | string
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
  direction: SetupDirection
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
  confluences: ConfluenceItem[]
  manualSetupMode?: boolean | null
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
  profitTarget?: number | null
  riskUsed?: number | null
  realizedPnl?: number | null
  remainingRisk?: number | null
  tradesTaken: number
  remainingTrades?: number | null
  activeSetupCount: number
  riskConfigured?: boolean | null
  tradingAllowed?: boolean | null
  maxLossReached?: boolean | null
  profitTargetReached?: boolean | null
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
  profitTarget?: number | null
  riskPerTrade?: number | null
  maxTrades?: number | null
  maxConsecutiveLosses?: number | null
  stopAfterTargetReached?: boolean | null
  stopAfterMaxLossReached?: boolean | null
  liveModeOnly: boolean
  lockedInAt?: string | null
  status: 'ACTIVE' | 'COMPLETED'
  quickStats: SessionQuickStats
  readiness: WorkspaceReadiness
  warnings: string[]
}

export type PeriodPlan = {
  id?: string | null
  scope: PlanScope
  title: string
  bias?: string | null
  focusSymbols: string[]
  objectives?: string | null
  target?: number | null
  maxLoss?: number | null
  notes?: string | null
  reviewIntentions?: string | null
  periodStart: string
  periodEnd: string
  activeFrom?: string | null
  activeTo?: string | null
  exists: boolean
  images?: PlanImage[]
  imageCount?: number | null
  thumbnailUrl?: string | null
}

export type PlanImage = {
  id: string
  assetId: string
  planId?: string | null
  todaySessionId?: string | null
  planScope: PlanScope
  originalFileName: string
  contentType?: string | null
  sizeBytes?: number | null
  url?: string | null
  downloadUrl?: string | null
  viewUrl?: string | null
  thumbnailUrl?: string | null
  caption?: string | null
  sortOrder?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  metadata?: Record<string, unknown>
}

export type PlanningContext = {
  monthly: PeriodPlan
  weekly: PeriodPlan
  today: PeriodPlan
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
  planningContext?: PlanningContext | null
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
  profitTarget?: number | null
  riskPerTrade?: number | null
  maxTrades?: number | null
  maxConsecutiveLosses?: number | null
  stopAfterTargetReached?: boolean | null
  stopAfterMaxLossReached?: boolean | null
  lockSession?: boolean | null
}

export type SessionPeriodPlanRequest = {
  title?: string | null
  bias?: string | null
  focusSymbols?: string[]
  objectives?: string | null
  target?: number | null
  maxLoss?: number | null
  notes?: string | null
  reviewIntentions?: string | null
}

export type SetupDraftRequest = {
  symbol?: string | null
  direction?: SetupDirection | null
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
  confluences?: ConfluenceItem[]
  manualSetupMode?: boolean | null
}

export async function getSessionWorkspace() {
  return apiGet<LiveWorkspaceResponse>('/today/session/workspace')
}

export async function updateSessionWorkspace(sessionId: string, payload: SessionWorkspaceRequest) {
  return apiPut<LiveWorkspaceResponse>(`/today/session/${encodeURIComponent(sessionId)}`, payload)
}

export async function upsertSessionPeriodPlan(scope: 'WEEKLY' | 'MONTHLY', payload: SessionPeriodPlanRequest) {
  return apiPost<LiveWorkspaceResponse>(`/today/session/plans/${encodeURIComponent(scope)}`, payload)
}

export async function listSessionPlanImages(scope: PlanScope) {
  return apiGet<PlanImage[]>(`/today/session/plans/${encodeURIComponent(scope)}/images`)
}

export async function deleteSessionPlanImage(scope: PlanScope, imageId: string) {
  return apiDelete(`/today/session/plans/${encodeURIComponent(scope)}/images/${encodeURIComponent(imageId)}`)
}

const canReadXhrResponseText = (xhr: XMLHttpRequest) => xhr.responseType === '' || xhr.responseType === 'text'

const readXhrResponseText = (xhr: XMLHttpRequest) => (canReadXhrResponseText(xhr) ? xhr.responseText || '' : '')

const parseXhrJsonPayload = <T>(xhr: XMLHttpRequest): T | null => {
  const response = xhr.response
  if (response && typeof response === 'object') {
    return response as T
  }
  if (typeof response === 'string' && response.trim()) {
    try {
      return JSON.parse(response) as T
    } catch {
      return null
    }
  }
  const rawText = readXhrResponseText(xhr)
  if (!rawText.trim()) return null
  try {
    return JSON.parse(rawText) as T
  } catch {
    return null
  }
}

const buildUploadError = (xhr: XMLHttpRequest) => {
  const parsed = parseXhrJsonPayload<{ message?: string; error?: string; details?: unknown }>(xhr)
  const statusLabel = xhr.status ? `${xhr.status} ${xhr.statusText}`.trim() : ''
  const message = parsed?.message || parsed?.error || readXhrResponseText(xhr) || statusLabel || 'Upload failed'
  const error = new ApiError(message)
  error.status = xhr.status
  error.code = parsed?.error
  error.details = parsed?.details
  error.rawMessage = message
  return error
}

export function uploadSessionPlanImages(
  scope: PlanScope,
  files: File[],
  onProgress?: (progress: number) => void
): Promise<PlanImage[]> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/today/session/plans/${encodeURIComponent(scope)}/images`)
    xhr.withCredentials = true
    xhr.responseType = 'json'

    const token = localStorage.getItem('token')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    xhr.setRequestHeader('Accept-Language', getCurrentLanguage())

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return
      const progress = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)))
      onProgress(progress)
    }

    xhr.onerror = () => {
      const error = new ApiError('Network request failed')
      error.code = 'NETWORK_ERROR'
      reject(error)
    }

    xhr.onabort = () => {
      const error = new ApiError('Upload cancelled')
      error.code = 'ABORTED'
      reject(error)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const payload = parseXhrJsonPayload<PlanImage[]>(xhr)
        if (!payload) {
          const error = new ApiError('Upload completed but the response was invalid')
          error.status = xhr.status
          error.code = 'INVALID_RESPONSE'
          reject(error)
          return
        }
        onProgress?.(100)
        resolve(payload)
        return
      }
      if (xhr.status === 401 || xhr.status === 403) {
        clearAuthToken()
      }
      reject(buildUploadError(xhr))
    }

    xhr.send(formData)
  })
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

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'
import { TradeRequest, TradeResponse } from './trades'

export type TodaySessionStatus = 'ACTIVE' | 'COMPLETED'

export type ChecklistTemplateType = 'PREREQS' | 'TRIGGERS'
export type ChecklistValueType = 'TEXT' | 'NUMBER' | 'TIME'

export type SessionChecklistItem = {
  id: string
  text: string
  order?: number | null
  required: boolean
  hasNote: boolean
  notePlaceholder?: string | null
  note?: string | null
  hasValue: boolean
  valueLabel?: string | null
  valueType: ChecklistValueType
  value?: string | null
  defaultChecked: boolean
  completed: boolean
}

export type ChecklistTemplateItem = {
  id?: string | null
  text: string
  order?: number | null
  required: boolean
  hasNote: boolean
  notePlaceholder?: string | null
  hasValue: boolean
  valueLabel?: string | null
  valueType: ChecklistValueType
  defaultChecked: boolean
}

export type SessionLevelCategory = 'LIQUIDITY' | 'TARGET' | 'INVALIDATION' | 'OTHER'

export type SessionLevel = {
  id: string
  label: string
  price?: number | null
  category: SessionLevelCategory
  notes?: string | null
  sweptAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type TodaySessionResponse = {
  id: string
  sessionDate: string
  profitTarget: number
  lossLimit: number
  maxTrades: number
  status: TodaySessionStatus
  realizedPnl: number
  closedTradesCount: number
  remainingTrades: number
  plannedTickers: string[]
  checklistItems: SessionChecklistItem[]
  checklistTemplateId?: string | null
  prereqsChecklistItems: SessionChecklistItem[]
  triggerChecklistItems: SessionChecklistItem[]
  prereqsTemplateId?: string | null
  triggerTemplateId?: string | null
  lockInSession?: string | null
  lockInObjective?: string | null
  lockInBias?: string | null
  lockInBiasReason?: string | null
  lockInAt?: string | null
  activeSweepLevelId?: string | null
  levels: SessionLevel[]
  activeTrade?: TradeResponse | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type ChecklistTemplateResponse = {
  id: string
  name: string
  type: ChecklistTemplateType
  isDefault: boolean
  items: ChecklistTemplateItem[]
  createdAt?: string | null
  updatedAt?: string | null
}

export type StartSessionTradeRequest = {
  symbol: string
  market?: TradeRequest['market']
  direction: TradeRequest['direction']
  quantity: number
  entryPrice: number
  takeProfitPrice?: number | null
  stopLossPrice?: number | null
  riskAmount?: number | null
  tradeCurrency?: string | null
  fxRateTradeToProfile?: number | null
  fxRateSource?: string | null
  session: TradeRequest['session']
  feeling?: string | null
  setupGrade: NonNullable<TradeRequest['setupGrade']>
  strategyId?: string | null
  strategyTag?: string | null
  linkedPlanId?: string | null
  initialNotes?: string | null
  notes?: string | null
  entryJournalText?: string | null
  entryInvalidation?: string | null
  entryScreenshotAssetIds?: string[]
}

export type TradeEntryJournalRequest = {
  entryJournalText?: string | null
  entryInvalidation?: string | null
  feeling?: string | null
  entryScreenshotAssetIds?: string[]
}

export type CloseSessionTradeRequest = {
  exitPrice: number
  ruleBreaks?: string[]
  postTradeNotes?: string | null
}

export type SessionLevelRequest = {
  label: string
  price?: number | null
  category?: SessionLevelCategory
  notes?: string | null
  swept?: boolean
}

export async function getTodaySession() {
  return apiGet<TodaySessionResponse | null>('/sessions/today')
}

export async function saveTodaySessionConfig(payload: {
  profitTarget: number
  lossLimit: number
  maxTrades: number
}) {
  return apiPost<TodaySessionResponse>('/sessions/today', payload)
}

export async function updateTodaySessionPlannedTickers(tickers: string[]) {
  return apiPatch<TodaySessionResponse>('/sessions/today/plannedTickers', { tickers })
}

export async function updateTodaySessionChecklist(payload: {
  type: ChecklistTemplateType
  templateId?: string
  items?: SessionChecklistItem[]
  activeSweepLevelId?: string
}) {
  return apiPatch<TodaySessionResponse>('/sessions/today/checklist', payload)
}

export async function updateTodaySessionLockIn(payload: {
  session?: string | null
  objective?: string | null
  bias?: string | null
  biasReason?: string | null
}) {
  return apiPatch<TodaySessionResponse>('/sessions/today/lockIn', payload)
}

export async function listSessionLevels() {
  return apiGet<SessionLevel[]>('/sessions/today/levels')
}

export async function createSessionLevel(payload: SessionLevelRequest) {
  return apiPost<TodaySessionResponse>('/sessions/today/levels', payload)
}

export async function updateSessionLevel(id: string, payload: Partial<SessionLevelRequest>) {
  return apiPut<TodaySessionResponse>(`/sessions/today/levels/${id}`, payload)
}

export async function deleteSessionLevel(id: string) {
  return apiDelete(`/sessions/today/levels/${id}`)
}

export async function setActiveSweepLevel(levelId?: string | null) {
  return apiPatch<TodaySessionResponse>('/sessions/today/activeSweepLevel', { levelId: levelId ?? null })
}

export async function listChecklistTemplates(type?: ChecklistTemplateType) {
  const query = type ? `?type=${encodeURIComponent(type)}` : ''
  return apiGet<ChecklistTemplateResponse[]>(`/checklistTemplates${query}`)
}

export async function createChecklistTemplate(payload: {
  name: string
  type: ChecklistTemplateType
  isDefault?: boolean
  items: ChecklistTemplateItem[]
}) {
  return apiPost<ChecklistTemplateResponse>('/checklistTemplates', payload)
}

export async function updateChecklistTemplate(id: string, payload: {
  name: string
  type: ChecklistTemplateType
  isDefault?: boolean
  items: ChecklistTemplateItem[]
}) {
  return apiPut<ChecklistTemplateResponse>(`/checklistTemplates/${id}`, payload)
}

export async function deleteChecklistTemplate(id: string) {
  return apiDelete(`/checklistTemplates/${id}`)
}

export async function startTradeFromSession(payload: StartSessionTradeRequest) {
  return apiPost<TradeResponse>('/trades/startFromSession', payload)
}

export async function closeTradeFromSession(tradeId: string, payload: CloseSessionTradeRequest) {
  return apiPost<TradeResponse>(`/trades/${tradeId}/closeFromSession`, payload)
}

export async function saveTradeEntryJournal(tradeId: string, payload: TradeEntryJournalRequest) {
  return apiPost<TradeResponse>(`/trades/${tradeId}/entry-journal`, payload)
}

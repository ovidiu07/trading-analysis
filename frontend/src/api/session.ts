import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'
import { TradeRequest, TradeResponse } from './trades'

export type TodaySessionStatus = 'ACTIVE' | 'COMPLETED'

export type ChecklistTemplateType = 'PREREQS' | 'TRIGGERS'
export type ChecklistValueType = 'TEXT' | 'NUMBER' | 'TIME'
export type LevelType =
  | 'PDH'
  | 'PDL'
  | 'ASIA_H'
  | 'ASIA_L'
  | 'LONDON_H'
  | 'LONDON_L'
  | 'NY_H'
  | 'NY_L'
  | 'SESSION_H'
  | 'SESSION_L'
  | 'EQH'
  | 'EQL'
  | 'HTF_SWING_HIGH'
  | 'HTF_SWING_LOW'
  | 'OB_HIGH'
  | 'OB_LOW'
  | 'FVG_MID'
  | 'OTHER'
export type LevelTimeframe = 'W1' | 'D1' | 'H4' | 'H1' | 'M15' | 'M5' | 'M1'
export type LevelStatus = 'FRESH' | 'TAPPED' | 'SWEPT' | 'RECLAIMED' | 'INVALID'
export type LevelCreatedBy = 'MENTOR' | 'USER'
export type NarrativeHtfDraw = 'PDH' | 'PDL' | 'WEEKLY_H' | 'WEEKLY_L' | 'DAILY_SWING_HIGH' | 'DAILY_SWING_LOW' | 'OTHER'
export type NarrativeManipulation = 'RAID_UP' | 'RAID_DOWN' | 'NONE'
export type NarrativeDeliveryModel = 'ASIA_RAID_LONDON_REVERSAL' | 'ASIA_RAID_LONDON_CONTINUATION' | 'LONDON_RAID_NY_REVERSAL' | 'TREND_DAY' | 'OTHER'
export type NarrativeConfirmationModel = 'DISPLACEMENT_M5_MSS_M5' | 'DISPLACEMENT_M1_MSS_M1' | 'DISPLACEMENT_M15_MSS_M5' | 'OTHER'

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
  symbol?: string | null
  type?: LevelType
  timeframe?: LevelTimeframe
  zoneLow?: number | null
  zoneHigh?: number | null
  originRule?: string | null
  strengthScore?: number
  status?: LevelStatus
  touchedCount?: number
  lastTouchedAtUtc?: string | null
  createdBy?: LevelCreatedBy
  expectation?: string | null
  sweepRole?: boolean
  entryRole?: boolean
  slRole?: boolean
  tpRole?: boolean
  category: SessionLevelCategory
  notes?: string | null
  sweptAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SessionPool = {
  id: string
  symbol: string
  poolName: string
  type: LevelType
  timeframe: LevelTimeframe
  zoneLow: number
  zoneHigh: number
  cleanlinessScore: number
  status: LevelStatus
  sweepRole: boolean
  levelIds: string[]
  createdAtUtc?: string | null
  updatedAtUtc?: string | null
}

export type SessionNarrative = {
  sessionId: string
  htfDraw?: NarrativeHtfDraw | null
  expectedManipulation?: NarrativeManipulation | null
  deliveryModel?: NarrativeDeliveryModel | null
  confirmationModel?: NarrativeConfirmationModel | null
  notes?: string | null
  createdAtUtc?: string | null
  updatedAtUtc?: string | null
}

export type SessionLevelSuggestion = {
  type: LevelType
  timeframe: LevelTimeframe
  price?: number | null
  zoneLow?: number | null
  zoneHigh?: number | null
  reason: string
  confidence: number
  untouchedSinceUtc?: string | null
  confluences?: string[]
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
  activeEntryLevelId?: string | null
  activeSlLevelId?: string | null
  activeTpLevelId?: string | null
  activeSweepPoolId?: string | null
  levels: SessionLevel[]
  pools?: SessionPool[]
  narrative?: SessionNarrative | null
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
  sweepLevelId?: string | null
  sweepPoolId?: string | null
  entryLevelId?: string | null
  slLevelId?: string | null
  tpLevelId?: string | null
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
  symbol?: string | null
  type?: LevelType
  timeframe?: LevelTimeframe
  zoneLow?: number | null
  zoneHigh?: number | null
  originRule?: string | null
  strengthScore?: number | null
  status?: LevelStatus
  expectation?: string | null
  sweepRole?: boolean
  entryRole?: boolean
  slRole?: boolean
  tpRole?: boolean
  category?: SessionLevelCategory
  notes?: string | null
  swept?: boolean
}

export type SessionPoolRequest = {
  symbol: string
  poolName: string
  type?: LevelType
  timeframe?: LevelTimeframe
  zoneLow: number
  zoneHigh: number
  cleanlinessScore?: number | null
  status?: LevelStatus
  sweepRole?: boolean
  levelIds?: string[]
}

export type SessionNarrativeRequest = {
  htfDraw?: NarrativeHtfDraw | null
  expectedManipulation?: NarrativeManipulation | null
  deliveryModel?: NarrativeDeliveryModel | null
  confirmationModel?: NarrativeConfirmationModel | null
  notes?: string | null
}

export type SessionRolesRequest = {
  symbol?: string
  sweepLevelId?: string | null
  sweepPoolId?: string | null
  entryLevelId?: string | null
  slLevelId?: string | null
  tpLevelId?: string | null
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

export async function listSessionLevelsBySession(sessionId: string, symbol?: string) {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''
  return apiGet<SessionLevel[]>(`/session/${sessionId}/levels${query}`)
}

export async function createSessionLevelBySession(sessionId: string, payload: SessionLevelRequest) {
  return apiPost<TodaySessionResponse>(`/session/${sessionId}/levels`, payload)
}

export async function updateSessionLevelBySession(sessionId: string, id: string, payload: Partial<SessionLevelRequest>) {
  return apiPut<TodaySessionResponse>(`/session/${sessionId}/levels/${id}`, payload)
}

export async function deleteSessionLevelBySession(sessionId: string, id: string) {
  return apiDelete(`/session/${sessionId}/levels/${id}`)
}

export async function suggestSessionLevels(sessionId: string, symbol?: string) {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''
  return apiPost<SessionLevelSuggestion[]>(`/session/${sessionId}/levels/suggest${query}`, {})
}

export async function setActiveSweepLevel(levelId?: string | null) {
  return apiPatch<TodaySessionResponse>('/sessions/today/activeSweepLevel', { levelId: levelId ?? null })
}

export async function setSessionRoles(sessionId: string, payload: SessionRolesRequest) {
  return apiPut<TodaySessionResponse>(`/session/${sessionId}/roles`, payload)
}

export async function listSessionPools(sessionId: string, symbol?: string) {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''
  return apiGet<SessionPool[]>(`/session/${sessionId}/pools${query}`)
}

export async function createSessionPool(sessionId: string, payload: SessionPoolRequest) {
  return apiPost<SessionPool>(`/session/${sessionId}/pools`, payload)
}

export async function updateSessionPool(sessionId: string, poolId: string, payload: Partial<SessionPoolRequest>) {
  return apiPut<SessionPool>(`/session/${sessionId}/pools/${poolId}`, payload)
}

export async function deleteSessionPool(sessionId: string, poolId: string) {
  return apiDelete(`/session/${sessionId}/pools/${poolId}`)
}

export async function getSessionNarrative(sessionId: string) {
  return apiGet<SessionNarrative | null>(`/session/${sessionId}/narrative`)
}

export async function updateSessionNarrative(sessionId: string, payload: SessionNarrativeRequest) {
  return apiPut<SessionNarrative>(`/session/${sessionId}/narrative`, payload)
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

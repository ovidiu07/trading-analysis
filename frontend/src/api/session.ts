import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client'
import { TradeRequest, TradeResponse } from './trades'

export type TodaySessionStatus = 'ACTIVE' | 'COMPLETED'

export type SessionChecklistItem = {
  id: string
  text: string
  completed: boolean
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
  activeTrade?: TradeResponse | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type ChecklistTemplateResponse = {
  id: string
  name: string
  items: string[]
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
  session: TradeRequest['session']
  feeling?: string | null
  setupGrade: NonNullable<TradeRequest['setupGrade']>
  strategyId?: string | null
  strategyTag?: string | null
  linkedPlanId?: string | null
  initialNotes?: string | null
  notes?: string | null
}

export type CloseSessionTradeRequest = {
  exitPrice: number
  ruleBreaks?: string[]
  postTradeNotes?: string | null
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
  templateId?: string
  items?: SessionChecklistItem[]
}) {
  return apiPatch<TodaySessionResponse>('/sessions/today/checklist', payload)
}

export async function listChecklistTemplates() {
  return apiGet<ChecklistTemplateResponse[]>('/checklistTemplates')
}

export async function createChecklistTemplate(payload: { name: string; items: string[] }) {
  return apiPost<ChecklistTemplateResponse>('/checklistTemplates', payload)
}

export async function updateChecklistTemplate(id: string, payload: { name: string; items: string[] }) {
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

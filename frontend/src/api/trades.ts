import { apiDelete, apiGet, apiPost, apiPostMultipart, apiPut } from './client'

export type TradeRequest = {
  symbol: string
  market: 'STOCK' | 'CFD' | 'FOREX' | 'CRYPTO' | 'FUTURES' | 'OPTIONS' | 'OTHER'
  direction: 'LONG' | 'SHORT'
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt?: string | null
  timeframe?: string
  quantity: number
  entryPrice: number
  exitPrice?: number | null
  stopLossPrice?: number | null
  takeProfitPrice?: number | null
  fees?: number
  commission?: number
  slippage?: number
  riskAmount?: number
  capitalUsed?: number
  setup?: string
  strategyTag?: string
  catalystTag?: string
  notes?: string
  accountId?: string
  tagIds?: string[]
}

export type TradeResponse = {
  id: string
  symbol: string
  market: TradeRequest['market']
  direction: TradeRequest['direction']
  status: TradeRequest['status']
  openedAt: string
  closedAt?: string | null
  quantity?: number | null
  entryPrice?: number | null
  exitPrice?: number | null
  stopLossPrice?: number | null
  takeProfitPrice?: number | null
  fees?: number | null
  commission?: number | null
  slippage?: number | null
  pnlGross?: number | null
  pnlNet?: number | null
  pnlPercent?: number | null
  riskAmount?: number | null
  riskPercent?: number | null
  rMultiple?: number | null
  capitalUsed?: number | null
  timeframe?: string | null
  setup?: string | null
  strategyTag?: string | null
  catalystTag?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  accountId?: string | null
  tags?: string[]
}

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type TradeSearchParams = {
  page?: number
  size?: number
}

export type TradeSearchFilters = {
  page?: number
  size?: number
  openedAtFrom?: string
  openedAtTo?: string
  closedAtFrom?: string
  closedAtTo?: string
  closedDate?: string
  tz?: string
  symbol?: string
  direction?: TradeRequest['direction']
  status?: TradeRequest['status']
}

export type DailyPnlResponse = {
  date: string
  netPnl: number
  tradeCount: number
  wins: number
  losses: number
}

export type TradeCsvImportGroupResult = {
  isin: string
  status: 'CREATED' | 'UPDATED' | 'SKIPPED'
  reason?: string | null
}

export type TradeCsvImportSummary = {
  totalRows: number
  isinGroups: number
  tradesCreated: number
  tradesUpdated: number
  groupsSkipped: number
  groupResults: TradeCsvImportGroupResult[]
}

function toQuery(params: Record<string, string | number | undefined | null> = {}) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, String(value))
    }
  })
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function listTrades(params: TradeSearchParams = {}) {
  return apiGet<PageResponse<TradeResponse>>(`/trades${toQuery(params)}`)
}

export async function searchTrades(filters: TradeSearchFilters = {}) {
  return apiGet<PageResponse<TradeResponse>>(`/trades/search${toQuery(filters)}`)
}

export async function fetchDailyPnl(params: { from: string; to: string; tz?: string; basis?: 'open' | 'close' }) {
  return apiGet<DailyPnlResponse[]>(`/trades/daily-pnl${toQuery(params)}`)
}

export async function listClosedTradesForDate(date: string, tz?: string) {
  return apiGet<TradeResponse[]>(`/trades/closed-day${toQuery({ date, tz })}`)
}

export async function getTradeById(id: string) {
  return apiGet<TradeResponse>(`/trades/${id}`)
}

export async function createTrade(request: TradeRequest) {
  return apiPost('/trades', request)
}

export async function updateTrade(id: string, request: TradeRequest) {
  return apiPut<TradeResponse>(`/trades/${id}`, request)
}

export async function deleteTrade(id: string) {
  return apiDelete(`/trades/${id}`)
}

export async function importTradesCsv(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostMultipart<TradeCsvImportSummary>('/trades/import/csv', formData)
}

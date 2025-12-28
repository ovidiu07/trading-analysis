import { apiGet, apiPost } from './client'

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
  pnlGross?: number | null
  pnlNet?: number | null
  pnlPercent?: number | null
  riskAmount?: number
  riskPercent?: number
  rMultiple?: number | null
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
  symbol?: string
  direction?: TradeRequest['direction']
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


export async function createTrade(request: TradeRequest) {
  return apiPost('/trades', request)
}

import { apiGet, apiPost } from './client'

export type TradeRequest = {
  symbol: string
  market: 'STOCK' | 'CFD' | 'FOREX' | 'CRYPTO' | 'FUTURES' | 'OPTIONS' | 'OTHER'
  direction: 'LONG' | 'SHORT'
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt?: string | null
  quantity: number
  entryPrice: number
  exitPrice?: number | null
  stopLossPrice?: number | null
  takeProfitPrice?: number | null
  fees?: number
  commission?: number
  slippage?: number
  riskAmount?: number
  riskPercent?: number
  capitalUsed?: number
  timeframe?: string
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
  pnlGross?: number | null
  pnlNet?: number | null
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
  from?: string
  to?: string
  symbol?: string
  strategy?: string
}

function toQuery(params: TradeSearchParams = {}) {
  const sp = new URLSearchParams()
  if (params.page !== undefined) sp.set('page', String(params.page))
  if (params.size !== undefined) sp.set('size', String(params.size))
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  if (params.symbol) sp.set('symbol', params.symbol)
  if (params.strategy) sp.set('strategy', params.strategy)
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function searchTrades(params: TradeSearchParams = {}) {
  return apiGet<PageResponse<TradeResponse>>(`/trades${toQuery(params)}`)
}


export async function createTrade(request: TradeRequest) {
  return apiPost('/trades', request)
}

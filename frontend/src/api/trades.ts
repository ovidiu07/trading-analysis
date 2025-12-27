import { apiPost } from './client'

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

export async function createTrade(request: TradeRequest) {
  return apiPost('/trades', request)
}

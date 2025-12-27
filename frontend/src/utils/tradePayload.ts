import { TradeRequest } from '../api/trades'

type TradeFormValues = {
  symbol: string
  market: TradeRequest['market']
  direction: TradeRequest['direction']
  status: TradeRequest['status']
  openedAt: string
  closedAt?: string
  quantity: number
  entryPrice: number
  exitPrice?: number
  notes?: string
}

export function buildTradePayload(values: TradeFormValues): TradeRequest {
  return {
    symbol: values.symbol,
    market: values.market,
    direction: values.direction,
    status: values.status,
    openedAt: new Date(values.openedAt).toISOString(),
    closedAt: values.closedAt ? new Date(values.closedAt).toISOString() : null,
    quantity: Number(values.quantity),
    entryPrice: Number(values.entryPrice),
    exitPrice: values.exitPrice !== undefined ? Number(values.exitPrice) : null,
    notes: values.notes
  }
}

export type { TradeFormValues }

import { TradeRequest } from '../api/trades'

type TradeFormValues = {
  symbol: string
  market: TradeRequest['market']
  direction: TradeRequest['direction']
  status: TradeRequest['status']
  openedAt: string
  closedAt?: string
  timeframe?: string
  quantity: number
  entryPrice: number
  exitPrice?: number
  stopLossPrice?: number
  takeProfitPrice?: number
  fees?: number
  commission?: number
  slippage?: number
  pnlGross?: number
  pnlNet?: number
  pnlPercent?: number
  riskAmount?: number
  riskPercent?: number
  rMultiple?: number
  capitalUsed?: number
  setup?: string
  strategyTag?: string
  catalystTag?: string
  notes?: string
  accountId?: string
}

export function buildTradePayload(values: TradeFormValues): TradeRequest {
  const toNullableNumber = (value?: number) =>
    value !== undefined && !Number.isNaN(value) ? Number(value) : null

  return {
    symbol: values.symbol,
    market: values.market,
    direction: values.direction,
    status: values.status,
    openedAt: new Date(values.openedAt).toISOString(),
    closedAt: values.closedAt ? new Date(values.closedAt).toISOString() : null,
    quantity: Number(values.quantity),
    entryPrice: Number(values.entryPrice),
    exitPrice: toNullableNumber(values.exitPrice),
    stopLossPrice: toNullableNumber(values.stopLossPrice),
    takeProfitPrice: toNullableNumber(values.takeProfitPrice),
    fees: toNullableNumber(values.fees) ?? undefined,
    commission: toNullableNumber(values.commission) ?? undefined,
    slippage: toNullableNumber(values.slippage) ?? undefined,
    pnlGross: toNullableNumber(values.pnlGross),
    pnlNet: toNullableNumber(values.pnlNet),
    pnlPercent: toNullableNumber(values.pnlPercent),
    riskAmount: toNullableNumber(values.riskAmount) ?? undefined,
    riskPercent: toNullableNumber(values.riskPercent) ?? undefined,
    rMultiple: toNullableNumber(values.rMultiple),
    capitalUsed: toNullableNumber(values.capitalUsed) ?? undefined,
    timeframe: values.timeframe || undefined,
    setup: values.setup || undefined,
    strategyTag: values.strategyTag || undefined,
    catalystTag: values.catalystTag || undefined,
    notes: values.notes,
    accountId: values.accountId || undefined,
  }
}

export type { TradeFormValues }

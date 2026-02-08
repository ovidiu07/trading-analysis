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
  riskAmount?: number
  capitalUsed?: number
  setup?: string
  strategyTag?: string
  catalystTag?: string
  notes?: string
  accountId?: string
}

const LOCAL_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/
const TIMEZONE_RE = /(Z|[+-]\d{2}:\d{2})$/i

function toIsoDateTime(value: string): string {
  if (LOCAL_DATE_TIME_RE.test(value) && !TIMEZONE_RE.test(value)) {
    const withSeconds = value.length === 16 ? `${value}:00` : value
    return new Date(`${withSeconds}Z`).toISOString()
  }
  return new Date(value).toISOString()
}

export function buildTradePayload(values: TradeFormValues): TradeRequest {
  const toNullableNumber = (value?: number) =>
    value !== undefined && !Number.isNaN(value) ? Number(value) : null

  return {
    symbol: values.symbol,
    market: values.market,
    direction: values.direction,
    status: values.status,
    openedAt: toIsoDateTime(values.openedAt),
    closedAt: values.closedAt ? toIsoDateTime(values.closedAt) : null,
    quantity: Number(values.quantity),
    entryPrice: Number(values.entryPrice),
    exitPrice: toNullableNumber(values.exitPrice),
    stopLossPrice: toNullableNumber(values.stopLossPrice),
    takeProfitPrice: toNullableNumber(values.takeProfitPrice),
    fees: toNullableNumber(values.fees) ?? undefined,
    commission: toNullableNumber(values.commission) ?? undefined,
    slippage: toNullableNumber(values.slippage) ?? undefined,
    riskAmount: toNullableNumber(values.riskAmount) ?? undefined,
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

import { TradeRequest } from '../api/trades'
import { tradeDateTimeToUtcIso } from './tradeDateTime'

type TradeFormValues = {
  symbol: string
  market: TradeRequest['market']
  direction: TradeRequest['direction']
  status: TradeRequest['status']
  openedAt: string
  closedAt?: string
  timeframe?: string
  quantity: number
  entryPrice: number | ''
  exitPrice?: number
  stopLossPrice?: number
  takeProfitPrice?: number
  fees?: number
  feesProfileCurrency?: number
  commission?: number
  slippage?: number
  tradeCurrency?: string
  profileCurrency?: string
  fxRateTradeToProfile?: number
  fxRateSource?: string
  pnlProfileCurrency?: number
  riskAmount?: number
  capitalUsed?: number
  setup?: string
  strategyTag?: string
  catalystTag?: string
  strategyId?: string
  setupGrade?: TradeRequest['setupGrade']
  ruleBreaks?: string[]
  session?: TradeRequest['session']
  sessionId?: string
  feeling?: string
  linkedContentIds?: string[]
  linkedPlanIds?: string[]
  notes?: string
  accountRefId?: string
  contractMultiplier?: number
}

export function buildTradePayload(values: TradeFormValues, timeZone: string): TradeRequest {
  const toNullableNumber = (value?: number) =>
    value !== undefined && !Number.isNaN(value) ? Number(value) : null
  const toStringArray = (values?: string[]) =>
    (values || []).map((value) => value.trim()).filter(Boolean)

  return {
    symbol: values.symbol,
    market: values.market,
    direction: values.direction,
    status: values.status,
    openedAt: tradeDateTimeToUtcIso(values.openedAt, timeZone),
    closedAt: values.closedAt ? tradeDateTimeToUtcIso(values.closedAt, timeZone) : null,
    quantity: Number(values.quantity),
    entryPrice: Number(values.entryPrice),
    exitPrice: toNullableNumber(values.exitPrice),
    stopLossPrice: toNullableNumber(values.stopLossPrice),
    takeProfitPrice: toNullableNumber(values.takeProfitPrice),
    fees: toNullableNumber(values.fees) ?? undefined,
    feesProfileCurrency: toNullableNumber(values.feesProfileCurrency) ?? undefined,
    commission: toNullableNumber(values.commission) ?? undefined,
    slippage: toNullableNumber(values.slippage) ?? undefined,
    tradeCurrency: values.tradeCurrency || undefined,
    profileCurrency: values.profileCurrency || undefined,
    fxRateTradeToProfile: toNullableNumber(values.fxRateTradeToProfile) ?? undefined,
    fxRateSource: values.fxRateSource || undefined,
    pnlProfileCurrency: toNullableNumber(values.pnlProfileCurrency) ?? undefined,
    riskAmount: toNullableNumber(values.riskAmount) ?? undefined,
    capitalUsed: toNullableNumber(values.capitalUsed) ?? undefined,
    timeframe: values.timeframe || undefined,
    setup: values.setup || undefined,
    strategyTag: values.strategyTag || undefined,
    catalystTag: values.catalystTag || undefined,
    strategyId: values.strategyId || undefined,
    setupGrade: values.setupGrade || undefined,
    ruleBreaks: toStringArray(values.ruleBreaks),
    session: values.session || undefined,
    sessionId: values.sessionId || undefined,
    feeling: values.feeling || undefined,
    linkedContentIds: toStringArray(values.linkedContentIds),
    linkedPlanIds: toStringArray(values.linkedPlanIds),
    notes: values.notes,
    accountRefId: values.accountRefId || null,
    contractMultiplier: toNullableNumber(values.contractMultiplier) ?? undefined,
  }
}

export type { TradeFormValues }

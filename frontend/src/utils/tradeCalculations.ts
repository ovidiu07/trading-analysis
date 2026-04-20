import { TradeRequest } from '../api/trades'

type NullableNumber = number | null | undefined

type TradeCalculationInput = {
  direction?: TradeRequest['direction'] | null
  entryPrice?: NullableNumber
  exitPrice?: NullableNumber
  quantity?: NullableNumber
  contractMultiplier?: NullableNumber
  stopLossPrice?: NullableNumber
  fees?: NullableNumber
  commission?: NullableNumber
  slippage?: NullableNumber
  riskAmount?: NullableNumber
  capitalUsed?: NullableNumber
}

const asFiniteNumber = (value: NullableNumber): number | null => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return null
  return value
}

export const calculateGrossPnl = (input: Pick<TradeCalculationInput, 'direction' | 'entryPrice' | 'exitPrice' | 'quantity' | 'contractMultiplier'>): number | null => {
  const entryPrice = asFiniteNumber(input.entryPrice)
  const exitPrice = asFiniteNumber(input.exitPrice)
  const quantity = asFiniteNumber(input.quantity)
  const contractMultiplier = asFiniteNumber(input.contractMultiplier) ?? 1
  if (!input.direction || entryPrice === null || exitPrice === null || quantity === null) {
    return null
  }

  if (input.direction === 'LONG') {
    return (exitPrice - entryPrice) * quantity * contractMultiplier
  }

  return (entryPrice - exitPrice) * quantity * contractMultiplier
}

export const calculateCosts = (input: Pick<TradeCalculationInput, 'fees' | 'commission' | 'slippage'>): number => {
  const fees = asFiniteNumber(input.fees) ?? 0
  const commission = asFiniteNumber(input.commission) ?? 0
  const slippage = asFiniteNumber(input.slippage) ?? 0
  return fees + commission + slippage
}

export const calculateNetPnl = (grossPnl: number | null, costs: number): number | null => {
  if (grossPnl === null || Number.isNaN(costs) || !Number.isFinite(costs)) {
    return null
  }
  return grossPnl - costs
}

export const calculateRiskFromPrices = (input: Pick<TradeCalculationInput, 'direction' | 'entryPrice' | 'stopLossPrice' | 'quantity' | 'contractMultiplier'>): number | null => {
  const entryPrice = asFiniteNumber(input.entryPrice)
  const stopLossPrice = asFiniteNumber(input.stopLossPrice)
  const quantity = asFiniteNumber(input.quantity)
  const contractMultiplier = asFiniteNumber(input.contractMultiplier) ?? 1
  if (!input.direction || entryPrice === null || stopLossPrice === null || quantity === null) {
    return null
  }

  if (input.direction === 'LONG') {
    return (entryPrice - stopLossPrice) * quantity * contractMultiplier
  }

  return (stopLossPrice - entryPrice) * quantity * contractMultiplier
}

export const calculatePnlPercent = (
  netPnl: number | null,
  capitalUsed?: NullableNumber
): number | null => {
  if (netPnl === null) return null
  const capital = asFiniteNumber(capitalUsed)
  if (capital === null || capital === 0) return null
  return (netPnl / capital) * 100
}

export const calculateRMultiple = (netPnl: number | null, riskAmount: number | null): number | null => {
  if (netPnl === null || riskAmount === null || riskAmount === 0) {
    return null
  }
  return netPnl / riskAmount
}

export type TradeLiveMetrics = {
  grossPnl: number | null
  costs: number
  netPnl: number | null
  riskFromPrices: number | null
  riskValue: number | null
  pnlPercent: number | null
  rMultiple: number | null
}

export const calculateTradeLiveMetrics = (input: TradeCalculationInput): TradeLiveMetrics => {
  const grossPnl = calculateGrossPnl(input)
  const costs = calculateCosts(input)
  const netPnl = calculateNetPnl(grossPnl, costs)
  const riskFromPrices = calculateRiskFromPrices(input)
  const providedRisk = asFiniteNumber(input.riskAmount)
  const riskValue = providedRisk ?? riskFromPrices
  const pnlPercent = calculatePnlPercent(netPnl, input.capitalUsed)
  const rMultiple = calculateRMultiple(netPnl, providedRisk)

  return {
    grossPnl,
    costs,
    netPnl,
    riskFromPrices,
    riskValue,
    pnlPercent,
    rMultiple
  }
}

export type { TradeCalculationInput }

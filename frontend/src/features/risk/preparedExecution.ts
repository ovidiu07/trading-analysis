import type { SetupDirection, SetupItem } from '../../api/liveWorkspace'
import { resolveFuturesContractMetadata, type FuturesContractMetadata } from '../../utils/futuresContractMetadata'

export type CalculationState = 'valid' | 'incomplete' | 'invalid' | 'unavailable'

export type CalculationResult<T> =
  | { state: 'valid'; value: T }
  | { state: Exclude<CalculationState, 'valid'>; reason: string; fields?: string[] }

export type PreparedInstrumentBasis = {
  market: NonNullable<SetupItem['market']>
  symbol: string
  contractMultiplier: number
  tickSize: number
  tickValue: number
  quantityStep: number
  tradeCurrency: string
  source: string
}

export type PreparedExecutionDraft = {
  version: 1
  draftId: string
  accountRefId: string
  accountCurrency: string
  symbol: string
  market: NonNullable<SetupItem['market']>
  direction: SetupDirection
  entryPrice: number | null
  stopLossPrice: number | null
  takeProfitPrice: number | null
  intendedRiskAmount: number | null
  intendedRiskCurrency: string
  quantity: number | null
  contractMultiplier: number | null
  contractMetadataSource: string | null
  tradeCurrency: string | null
  profileCurrency: string
  fxRateTradeToProfile: number | null
  fxSource: string | null
  invalidation: string
  plannedRr: number | null
  estimatedPriceRisk: number | null
  costsIncluded: false
  calculationStatus: CalculationState
  invalidReasons: Record<string, string>
  unavailableReasons: string[]
}

export type PreparedRiskInput = {
  direction: SetupDirection
  entryPrice?: number | null
  stopLossPrice?: number | null
  takeProfitPrice?: number | null
  intendedRiskAmount?: number | null
  manualQuantity?: number | null
  instrumentBasis?: PreparedInstrumentBasis | null
  accountCurrency?: string | null
  fxRateTradeToAccount?: number | null
  maximumPermittedRisk?: number | null
}

export type PreparedRiskCalculation = {
  plannedRr: CalculationResult<number>
  automaticQuantity: CalculationResult<number>
  quantity: number | null
  estimatedPriceRisk: CalculationResult<number>
  capComparison: CalculationResult<'below' | 'equal' | 'above'>
  costsIncluded: false
}

const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)
const positive = (value: number | null | undefined): value is number => finite(value) && value > 0

export function calculatePlannedRr(input: Pick<PreparedRiskInput, 'direction' | 'entryPrice' | 'stopLossPrice' | 'takeProfitPrice'>): CalculationResult<number> {
  if (input.direction === 'UNDECIDED') return { state: 'incomplete', reason: 'risk.reasons.directionRequired', fields: ['direction'] }
  if (input.entryPrice == null || input.stopLossPrice == null || input.takeProfitPrice == null) {
    return { state: 'incomplete', reason: 'risk.reasons.pricesRequired', fields: ['entryPrice', 'stopLossPrice', 'takeProfitPrice'] }
  }
  if (![input.entryPrice, input.stopLossPrice, input.takeProfitPrice].every(positive)) {
    return { state: 'invalid', reason: 'risk.reasons.pricesPositive', fields: ['entryPrice', 'stopLossPrice', 'takeProfitPrice'] }
  }
  const riskDistance = input.direction === 'LONG' ? input.entryPrice - input.stopLossPrice : input.stopLossPrice - input.entryPrice
  const rewardDistance = input.direction === 'LONG' ? input.takeProfitPrice - input.entryPrice : input.entryPrice - input.takeProfitPrice
  if (riskDistance <= 0) {
    return { state: 'invalid', reason: input.direction === 'LONG' ? 'risk.reasons.longStopBelow' : 'risk.reasons.shortStopAbove', fields: ['stopLossPrice'] }
  }
  if (rewardDistance <= 0) {
    return { state: 'invalid', reason: input.direction === 'LONG' ? 'risk.reasons.longTargetAbove' : 'risk.reasons.shortTargetBelow', fields: ['takeProfitPrice'] }
  }
  const value = rewardDistance / riskDistance
  return finite(value) && value > 0
    ? { state: 'valid', value }
    : { state: 'invalid', reason: 'risk.reasons.calculationInvalid' }
}

export function resolvePreparedInstrumentBasis(market: SetupItem['market'], symbol: string): CalculationResult<PreparedInstrumentBasis> {
  if (!market || !symbol.trim()) return { state: 'incomplete', reason: 'risk.reasons.instrumentRequired', fields: ['market', 'symbol'] }
  if (market !== 'FUTURES') return { state: 'unavailable', reason: 'risk.reasons.unsupportedUnitModel' }
  const metadata: FuturesContractMetadata | null = resolveFuturesContractMetadata(symbol)
  if (!metadata) return { state: 'unavailable', reason: 'risk.reasons.unsupportedFuture' }
  return {
    state: 'valid',
    value: {
      market,
      symbol: metadata.root,
      contractMultiplier: metadata.contractMultiplier,
      tickSize: metadata.tickSize,
      tickValue: metadata.tickValue,
      quantityStep: metadata.quantityStep,
      tradeCurrency: metadata.tradeCurrency,
      source: metadata.source
    }
  }
}

export function calculatePreparedRisk(input: PreparedRiskInput): PreparedRiskCalculation {
  const plannedRr = calculatePlannedRr(input)
  const riskDistance = plannedRr.state === 'valid' && positive(input.entryPrice) && positive(input.stopLossPrice)
    ? Math.abs(input.entryPrice - input.stopLossPrice)
    : null
  let automaticQuantity: CalculationResult<number>
  if (!positive(input.intendedRiskAmount)) {
    automaticQuantity = input.intendedRiskAmount == null
      ? { state: 'incomplete', reason: 'risk.reasons.intendedRiskRequired', fields: ['intendedRiskAmount'] }
      : { state: 'invalid', reason: 'risk.reasons.intendedRiskPositive', fields: ['intendedRiskAmount'] }
  } else if (plannedRr.state !== 'valid' || riskDistance == null) {
    automaticQuantity = { state: plannedRr.state === 'invalid' ? 'invalid' : 'incomplete', reason: plannedRr.state === 'valid' ? 'risk.reasons.pricesRequired' : plannedRr.reason }
  } else if (!input.instrumentBasis) {
    automaticQuantity = { state: 'unavailable', reason: 'risk.reasons.unsupportedUnitModel' }
  } else {
    const sameCurrency = input.instrumentBasis.tradeCurrency.toUpperCase() === (input.accountCurrency || '').toUpperCase()
    const fxRate = sameCurrency ? 1 : input.fxRateTradeToAccount
    if (!positive(fxRate)) {
      automaticQuantity = { state: 'unavailable', reason: 'risk.reasons.fxUnavailable' }
    } else {
      const lossPerUnit = riskDistance * input.instrumentBasis.contractMultiplier * fxRate
      const rawQuantity = input.intendedRiskAmount / lossPerUnit
      const rounded = Math.floor((rawQuantity + Number.EPSILON) / input.instrumentBasis.quantityStep) * input.instrumentBasis.quantityStep
      automaticQuantity = positive(rounded)
        ? { state: 'valid', value: rounded }
        : { state: 'invalid', reason: 'risk.reasons.riskTooSmallForStep', fields: ['intendedRiskAmount'] }
    }
  }

  const quantity = positive(input.manualQuantity)
    ? input.manualQuantity
    : automaticQuantity.state === 'valid' ? automaticQuantity.value : null

  let estimatedPriceRisk: CalculationResult<number>
  if (!positive(quantity)) {
    if (input.manualQuantity != null) {
      estimatedPriceRisk = { state: 'invalid', reason: 'risk.reasons.quantityPositive', fields: ['quantity'] }
    } else if (automaticQuantity.state === 'valid') {
      estimatedPriceRisk = { state: 'incomplete', reason: 'risk.reasons.quantityRequired' }
    } else {
      estimatedPriceRisk = { state: automaticQuantity.state, reason: automaticQuantity.reason }
    }
  } else if (riskDistance == null || plannedRr.state !== 'valid') {
    estimatedPriceRisk = { state: plannedRr.state === 'invalid' ? 'invalid' : 'incomplete', reason: plannedRr.state === 'valid' ? 'risk.reasons.pricesRequired' : plannedRr.reason }
  } else if (!input.instrumentBasis) {
    estimatedPriceRisk = { state: 'unavailable', reason: 'risk.reasons.unsupportedUnitModel' }
  } else {
    const sameCurrency = input.instrumentBasis.tradeCurrency.toUpperCase() === (input.accountCurrency || '').toUpperCase()
    const fxRate = sameCurrency ? 1 : input.fxRateTradeToAccount
    estimatedPriceRisk = positive(fxRate)
      ? { state: 'valid', value: riskDistance * input.instrumentBasis.contractMultiplier * quantity * fxRate }
      : { state: 'unavailable', reason: 'risk.reasons.fxUnavailable' }
  }

  let capComparison: PreparedRiskCalculation['capComparison']
  if (input.maximumPermittedRisk == null) {
    capComparison = { state: 'unavailable', reason: 'risk.reasons.capUnavailable' }
  } else if (!finite(input.maximumPermittedRisk) || input.maximumPermittedRisk < 0) {
    capComparison = { state: 'invalid', reason: 'risk.reasons.capInvalid' }
  } else if (!positive(input.intendedRiskAmount)) {
    capComparison = { state: 'incomplete', reason: 'risk.reasons.intendedRiskRequired', fields: ['intendedRiskAmount'] }
  } else {
    const delta = input.intendedRiskAmount - input.maximumPermittedRisk
    capComparison = { state: 'valid', value: Math.abs(delta) < 1e-9 ? 'equal' : delta < 0 ? 'below' : 'above' }
  }

  return { plannedRr, automaticQuantity, quantity, estimatedPriceRisk, capComparison, costsIncluded: false }
}

export function buildPreparedExecutionDraft(input: {
  draftId: string
  accountRefId: string
  accountCurrency: string
  symbol: string
  market: NonNullable<SetupItem['market']>
  direction: SetupDirection
  entryPrice: number | null
  stopLossPrice: number | null
  takeProfitPrice: number | null
  intendedRiskAmount: number | null
  manualQuantity: number | null
  invalidation: string
  basis: CalculationResult<PreparedInstrumentBasis>
  fxRate: number | null
  fxSource: string | null
  calculation: PreparedRiskCalculation
}): PreparedExecutionDraft {
  const invalidReasons: Record<string, string> = {}
  const unavailableReasons: string[] = []
  ;[input.calculation.plannedRr, input.calculation.automaticQuantity, input.calculation.estimatedPriceRisk, input.calculation.capComparison].forEach((result) => {
    if (result.state === 'invalid') (result.fields || ['calculation']).forEach((field) => { invalidReasons[field] = result.reason })
    if (result.state === 'unavailable' && !unavailableReasons.includes(result.reason)) unavailableReasons.push(result.reason)
  })
  const basis = input.basis.state === 'valid' ? input.basis.value : null
  const states = [input.calculation.plannedRr.state, input.calculation.estimatedPriceRisk.state, input.calculation.capComparison.state]
  const calculationStatus: CalculationState = states.includes('invalid') ? 'invalid' : states.includes('incomplete') ? 'incomplete' : states.includes('unavailable') ? 'unavailable' : 'valid'
  return {
    version: 1,
    draftId: input.draftId,
    accountRefId: input.accountRefId,
    accountCurrency: input.accountCurrency,
    symbol: input.symbol,
    market: input.market,
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLossPrice: input.stopLossPrice,
    takeProfitPrice: input.takeProfitPrice,
    intendedRiskAmount: input.intendedRiskAmount,
    intendedRiskCurrency: input.accountCurrency,
    quantity: input.calculation.quantity,
    contractMultiplier: basis?.contractMultiplier ?? null,
    contractMetadataSource: basis?.source ?? null,
    tradeCurrency: basis?.tradeCurrency ?? null,
    profileCurrency: input.accountCurrency,
    fxRateTradeToProfile: input.fxRate,
    fxSource: input.fxSource,
    invalidation: input.invalidation,
    plannedRr: input.calculation.plannedRr.state === 'valid' ? input.calculation.plannedRr.value : null,
    estimatedPriceRisk: input.calculation.estimatedPriceRisk.state === 'valid' ? input.calculation.estimatedPriceRisk.value : null,
    costsIncluded: false,
    calculationStatus,
    invalidReasons,
    unavailableReasons
  }
}

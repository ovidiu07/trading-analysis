import { describe, expect, it } from 'vitest'
import { calculatePlannedRr, calculatePreparedRisk, resolvePreparedInstrumentBasis } from './preparedExecution'

describe('calculatePlannedRr', () => {
  it('calculates a direction-aware LONG ratio', () => expect(calculatePlannedRr({ direction: 'LONG', entryPrice: 100, stopLossPrice: 95, takeProfitPrice: 112.5 })).toEqual({ state: 'valid', value: 2.5 }))
  it('calculates a direction-aware SHORT ratio', () => expect(calculatePlannedRr({ direction: 'SHORT', entryPrice: 100, stopLossPrice: 105, takeProfitPrice: 90 })).toEqual({ state: 'valid', value: 2 }))
  it.each([
    ['LONG', 100, 101, 110, 'risk.reasons.longStopBelow'],
    ['LONG', 100, 95, 99, 'risk.reasons.longTargetAbove'],
    ['SHORT', 100, 99, 90, 'risk.reasons.shortStopAbove'],
    ['SHORT', 100, 105, 101, 'risk.reasons.shortTargetBelow'],
    ['LONG', 100, 100, 110, 'risk.reasons.longStopBelow'],
    ['SHORT', 100, 105, 100, 'risk.reasons.shortTargetBelow']
  ] as const)('rejects invalid %s price relationships', (direction, entryPrice, stopLossPrice, takeProfitPrice, reason) => {
    expect(calculatePlannedRr({ direction, entryPrice, stopLossPrice, takeProfitPrice })).toMatchObject({ state: 'invalid', reason })
  })
  it('distinguishes missing values from invalid values', () => expect(calculatePlannedRr({ direction: 'LONG', entryPrice: null, stopLossPrice: 1, takeProfitPrice: 2 }).state).toBe('incomplete'))
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects non-positive or non-finite prices', (entryPrice) => expect(calculatePlannedRr({ direction: 'LONG', entryPrice, stopLossPrice: 1, takeProfitPrice: 2 }).state).toBe('invalid'))
  it('retains decimal precision without display rounding', () => expect(calculatePlannedRr({ direction: 'LONG', entryPrice: 1.23456, stopLossPrice: 1.23321, takeProfitPrice: 1.23891 })).toEqual({ state: 'valid', value: (1.23891 - 1.23456) / (1.23456 - 1.23321) }))
})

describe('prepared monetary risk and sizing', () => {
  const basisResult = resolvePreparedInstrumentBasis('FUTURES', 'MESZ26')
  const basis = basisResult.state === 'valid' ? basisResult.value : null
  const base = { direction: 'LONG' as const, entryPrice: 6000, stopLossPrice: 5995, takeProfitPrice: 6010, intendedRiskAmount: 130, instrumentBasis: basis, accountCurrency: 'USD', fxRateTradeToAccount: 1 }

  it('resolves supported root and expiry-suffixed futures', () => {
    expect(resolvePreparedInstrumentBasis('FUTURES', 'ES')).toMatchObject({ state: 'valid', value: { contractMultiplier: 50 } })
    expect(basisResult).toMatchObject({ state: 'valid', value: { symbol: 'MES', contractMultiplier: 5, quantityStep: 1 } })
  })
  it('keeps unsupported futures and non-futures unavailable', () => {
    expect(resolvePreparedInstrumentBasis('FUTURES', 'ABCZ26').state).toBe('unavailable')
    expect(resolvePreparedInstrumentBasis('CFD', 'GER40').state).toBe('unavailable')
    expect(resolvePreparedInstrumentBasis('FOREX', 'EURUSD').state).toBe('unavailable')
  })
  it('rounds quantity down and reports actual price risk', () => {
    const result = calculatePreparedRisk(base)
    expect(result.automaticQuantity).toEqual({ state: 'valid', value: 5 })
    expect(result.estimatedPriceRisk).toEqual({ state: 'valid', value: 125 })
  })
  it('uses a valid manual quantity', () => expect(calculatePreparedRisk({ ...base, manualQuantity: 3 }).estimatedPriceRisk).toEqual({ state: 'valid', value: 75 }))
  it('uses identity currency and a supplied FX conversion', () => {
    expect(calculatePreparedRisk(base).estimatedPriceRisk).toEqual({ state: 'valid', value: 125 })
    expect(calculatePreparedRisk({ ...base, accountCurrency: 'EUR', fxRateTradeToAccount: 0.8, manualQuantity: 4 }).estimatedPriceRisk).toEqual({ state: 'valid', value: 80 })
  })
  it.each([null, 0, -1, Number.NaN])('reports missing or invalid FX as unavailable', (fxRateTradeToAccount) => expect(calculatePreparedRisk({ ...base, accountCurrency: 'EUR', fxRateTradeToAccount }).estimatedPriceRisk.state).toBe('unavailable'))
  it.each([[100, 'above'], [130, 'equal'], [150, 'below']] as const)('compares intended account-currency risk with the cap', (maximumPermittedRisk, expected) => expect(calculatePreparedRisk({ ...base, maximumPermittedRisk }).capComparison).toEqual({ state: 'valid', value: expected }))
  it('treats a zero cap as a real exceeded state', () => expect(calculatePreparedRisk({ ...base, maximumPermittedRisk: 0 }).capComparison).toEqual({ state: 'valid', value: 'above' }))
  it('keeps an unavailable cap distinct from zero', () => expect(calculatePreparedRisk({ ...base, maximumPermittedRisk: null }).capComparison.state).toBe('unavailable'))
  it('never turns a missing amount into zero and discloses excluded costs', () => {
    const result = calculatePreparedRisk({ ...base, intendedRiskAmount: null })
    expect(result.automaticQuantity.state).toBe('incomplete')
    expect(result.quantity).toBeNull()
    expect(result.costsIncluded).toBe(false)
  })
})

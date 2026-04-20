import { describe, expect, it } from 'vitest'
import {
  calculateCosts,
  calculateGrossPnl,
  calculateNetPnl,
  calculateRMultiple,
  calculateRiskFromPrices,
  calculateTradeLiveMetrics
} from './tradeCalculations'

describe('tradeCalculations', () => {
  it('computes gross pnl for long trades', () => {
    expect(
      calculateGrossPnl({
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 108,
        quantity: 2
      })
    ).toBe(16)
  })

  it('computes gross pnl for short trades', () => {
    expect(
      calculateGrossPnl({
        direction: 'SHORT',
        entryPrice: 108,
        exitPrice: 100,
        quantity: 2
      })
    ).toBe(16)
  })

  it('includes contract multiplier in gross pnl', () => {
    expect(
      calculateGrossPnl({
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 108,
        quantity: 2,
        contractMultiplier: 5
      })
    ).toBe(80)
  })

  it('matches the canonical MNQM6 futures calculation', () => {
    expect(
      calculateGrossPnl({
        direction: 'LONG',
        entryPrice: 26711.5,
        exitPrice: 26788,
        quantity: 2,
        contractMultiplier: 2
      })
    ).toBe(306)
  })

  it('returns null gross pnl when required values are missing', () => {
    expect(calculateGrossPnl({ direction: 'LONG', entryPrice: 100, quantity: 2 })).toBeNull()
  })

  it('calculates net pnl and costs', () => {
    const costs = calculateCosts({ fees: 1.2, commission: 0.8, slippage: 1 })
    expect(costs).toBe(3)
    expect(calculateNetPnl(20, costs)).toBe(17)
  })

  it('calculates risk from prices based on direction', () => {
    expect(
      calculateRiskFromPrices({
        direction: 'LONG',
        entryPrice: 100,
        stopLossPrice: 97,
        quantity: 5
      })
    ).toBe(15)

    expect(
      calculateRiskFromPrices({
        direction: 'SHORT',
        entryPrice: 100,
        stopLossPrice: 103,
        quantity: 5
      })
    ).toBe(15)
  })

  it('includes contract multiplier in calculated stop-loss risk', () => {
    expect(
      calculateRiskFromPrices({
        direction: 'LONG',
        entryPrice: 100,
        stopLossPrice: 97,
        quantity: 5,
        contractMultiplier: 10
      })
    ).toBe(150)
  })

  it('returns null r multiple when risk is 0', () => {
    expect(calculateRMultiple(20, 0)).toBeNull()
  })

  it('builds full live metrics with fallback risk', () => {
    const result = calculateTradeLiveMetrics({
      direction: 'LONG',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      stopLossPrice: 95,
      fees: 1,
      commission: 1,
      slippage: 1,
      riskAmount: 5,
      capitalUsed: 100
    })

    expect(result.grossPnl).toBe(10)
    expect(result.costs).toBe(3)
    expect(result.netPnl).toBe(7)
    expect(result.riskFromPrices).toBe(5)
    expect(result.riskValue).toBe(5)
    expect(result.pnlPercent).toBeCloseTo(7, 6)
    expect(result.rMultiple).toBe(1.4)
  })

  it('uses capital for pnl percent even when risk amount is provided', () => {
    const result = calculateTradeLiveMetrics({
      direction: 'LONG',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      riskAmount: 5,
      capitalUsed: 200
    })

    expect(result.pnlPercent).toBeCloseTo(5, 6)
    expect(result.rMultiple).toBe(2)
  })

  it('does not let risk amount change canonical net pnl', () => {
    const withRisk = calculateTradeLiveMetrics({
      direction: 'LONG',
      entryPrice: 26711.5,
      exitPrice: 26788,
      quantity: 2,
      contractMultiplier: 2,
      riskAmount: 75
    })
    const withoutRisk = calculateTradeLiveMetrics({
      direction: 'LONG',
      entryPrice: 26711.5,
      exitPrice: 26788,
      quantity: 2,
      contractMultiplier: 2
    })

    expect(withRisk.netPnl).toBe(306)
    expect(withoutRisk.netPnl).toBe(306)
    expect(withRisk.rMultiple).toBeCloseTo(4.08, 6)
    expect(withoutRisk.rMultiple).toBeNull()
  })

  it('does not derive pnl percent or r multiple from stop-loss risk when riskAmount is missing', () => {
    const result = calculateTradeLiveMetrics({
      direction: 'LONG',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      stopLossPrice: 95
    })

    expect(result.riskFromPrices).toBe(5)
    expect(result.pnlPercent).toBeNull()
    expect(result.rMultiple).toBeNull()
  })
})

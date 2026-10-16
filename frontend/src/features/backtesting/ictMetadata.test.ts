import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BacktestingTrade } from '../../api/backtesting'
import { copyTradeContext, directionVsHtf, ictFields, isIctOnlyEdit, metadataValues, previousContextTrade, validIctNumbers } from './ictMetadata'

describe('canonical ICT metadata', () => {
  it('uses the exact backend registry, with one field per concept and unique option values', () => {
    const canonical = JSON.parse(readFileSync('../backend/src/main/resources/backtesting/ict-fields.json', 'utf8'))
    expect(ictFields).toEqual(canonical)
    expect(new Set(ictFields.map(f => f.key)).size).toBe(25)
    for (const field of ictFields) expect(new Set(field.options.map(o => o.value)).size).toBe(field.options.length)
  })
  it.each([
    ['LONG', 'BULLISH', 'WITH_TREND'], ['SHORT', 'BEARISH', 'WITH_TREND'],
    ['LONG', 'BEARISH', 'AGAINST_TREND'], ['SHORT', 'BULLISH', 'AGAINST_TREND'],
    ['LONG', 'RANGING', 'NEUTRAL'], ['SHORT', 'RANGING', 'NEUTRAL'],
    [null, 'RANGING', null], ['LONG', null, null], [null, null, null]
  ])('derives %s + %s as %s from the saved trade only', (direction, trend, expected) => expect(directionVsHtf(direction, trend)).toBe(expected))
  it('validates numeric measurements without turning blanks into zero or percent fractions', () => {
    expect(validIctNumbers({ gapSizePercent: 0.07, gapSizePoints: 12.5, fvgAge: 0 })).toBe(true)
    expect(validIctNumbers({ gapSizePercent: null })).toBe(true)
    for (const fvgAge of [-1, 1.5, NaN, Infinity, 2147483648]) expect(validIctNumbers({ fvgAge })).toBe(false)
    for (const gapSizePercent of [-0.01, NaN, Infinity, 0.0000001, 1e-22, 1000000]) expect(validIctNumbers({ gapSizePercent })).toBe(false)
    expect(metadataValues({ gapSizePercent: 0.07 }).gapSizePercent).toBe(0.07)
    expect(metadataValues({}).fvgAge).toBeNull()
  })
  it('routes annotation-only edits independently of execution and accounting validation', () => {
    const original = { date: '2026-10-15', entryTime: '11:30:00', instrument: 'GER40', direction: 'LONG', result: 'WIN', pnlR: null, source: 'IMPORT', tradeScope: 'REPLAY', tags: [] } as BacktestingTrade
    expect(isIctOnlyEdit(original, { ...original, setupType: 'REVERSAL', gapSizePercent: 0.07, notes: '' })).toBe(true)
    expect(isIctOnlyEdit(original, { ...original, pnlR: 2 })).toBe(false)
    expect(isIctOnlyEdit(original, { ...original, notes: 'new note' })).toBe(false)
  })
  it('copies only five context fields and finds the previous chronological trade', () => {
    const previous = { id: 'prev', date: '2026-10-15', entryTime: '11:30', session: 'London', contextTimeframe: '1h', htfTrend: 'BEARISH', marketStructure: 'LH_LL', marketCondition: 'TRENDING', gapSizePercent: 0.07, fvgAge: 2, sweepLevel: 'PDL', entryConfirmation: 'MSS_FVG' } as BacktestingTrade
    expect(copyTradeContext(previous)).toEqual({ session: 'London', contextTimeframe: '1h', htfTrend: 'BEARISH', marketStructure: 'LH_LL', marketCondition: 'TRENDING' })
    expect(previousContextTrade([previous, { ...previous, id: 'future', date: '2026-10-17' }], { date: '2026-10-16', entryTime: '12:00' })?.id).toBe('prev')
  })
})

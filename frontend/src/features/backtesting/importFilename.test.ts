import { describe, expect, it } from 'vitest'
import { replayInstrumentFromFilename } from './importFilename'

describe('TradingView import filename inference', () => {
  it.each([
    ['Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv', 'PEPPERSTONE:GER40F'],
    ['Another_strategy_OANDA_EURUSD_2025-01-01.csv', 'OANDA:EURUSD'],
    ['Strategy_CME_MINI_MNQ1!_2026-10-14_hash.csv', 'CME_MINI:MNQ1!'],
    ['Replay_Trading_CME_MINI_MNQ1!_2026-10-14_hash.csv', 'CME_MINI:MNQ1!'],
    ['Replay_Trading_PEPPERSTONE_GER40F_2025-10-06_to_2025-10-30_combined.csv', 'PEPPERSTONE:GER40F'],
    ['trades.csv', ''], ['renamed.csv', '']
  ])('infers only a dated exchange/symbol suffix: %s', (filename, expected) => {
    expect(replayInstrumentFromFilename(filename)).toBe(expected)
  })
})

import { describe, expect, it } from 'vitest'
import { canonicalMarketInstrument } from './marketData'

describe('native instrument identity', () => {
  it('maps only explicit watchlist chart identities', () => {
    expect(canonicalMarketInstrument('OANDA:DE30EUR', '')).toBe('GER40')
    expect(canonicalMarketInstrument('OANDA:NAS100USD', '')).toBe('NAS100')
    expect(canonicalMarketInstrument('CME_MINI:ES1!', '')).toBe('ES')
    expect(canonicalMarketInstrument('TVC:DXY', '')).toBe('DXY')
  })
  it('never substitutes a cash index, ETF, stock or different futures contract', () => {
    for (const symbol of ['NASDAQ:NDX', 'NASDAQ:AAPL', 'NASDAQ:QQQ', 'XETR:DAX', 'CME_MINI:MES1!', 'CME_MINI:ESZ2026', 'ICEUS:DX1!'])
      expect(canonicalMarketInstrument(symbol, 'NAS100')).toBe('UNSET')
  })
})

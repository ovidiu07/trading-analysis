import { describe, expect, it } from 'vitest'
import { convertedNetResult, formatNetResult, netResult } from './tradeMoney'
import type { TradeResponse } from '../api/trades'
const trade = (data: Partial<TradeResponse>) => data as TradeResponse
describe('source-aware monetary display', () => {
  it.each(['TRADING212_CSV', 'MT5_HTML', 'TRADOVATE'] as const)('uses account currency for %s', source => {
    expect(netResult(trade({ source, pnlNet: 12, tradeCurrency: 'USD', accountCurrency: 'EUR' }))).toEqual({ value: 12, currency: 'EUR' })
  })
  it('keeps manual price-derived P&L in instrument currency', () => expect(netResult(trade({ source: 'MANUAL', pnlNet: 12, tradeCurrency: 'USD', accountCurrency: 'EUR' })).currency).toBe('USD'))
  it('does not relabel an unconverted amount', () => expect(convertedNetResult(trade({ pnlNet: 12, tradeCurrency: 'EUR', profileCurrency: 'USD' }))).toBeNull())
  it('requires an actual positive FX rate for the second amount', () => expect(convertedNetResult(trade({ pnlNet: 12, pnlProfileCurrency: 13, tradeCurrency: 'EUR', profileCurrency: 'USD', fxRateTradeToProfile: 1.0833 }))).toBeTruthy())
  it('renders unknown money as unavailable', () => expect(formatNetResult(trade({ pnlNet: null, tradeCurrency: 'EUR' }))).toBe('—'))
})

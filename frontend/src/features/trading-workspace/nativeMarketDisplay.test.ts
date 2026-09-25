import { describe, expect, it } from 'vitest'
import { nativeQuoteDisplay, scopedNativeAnalysis } from './nativeMarketDisplay'
import type { InstrumentQuote } from '../../api/marketData'
const now = Date.parse('2026-09-25T12:00:00Z')
const quote: InstrumentQuote = { canonicalInstrument: 'GER40', provider: 'OANDA', providerSymbol: 'DE30_EUR', instrumentType: 'CFD',
 priceBasis: 'MID', mid: 18001, unit: 'EUR', observedAt: new Date(now).toISOString(), retrievedAt: new Date(now).toISOString(), freshness: 'LIVE', provenance: 'USER_CONNECTED' }
describe('native display boundary', () => {
 it('requires a fresh exact native identity and never uses a chart value', () => {
   expect(nativeQuoteDisplay(quote, now).value).toBe(18001)
   for (const patch of [{ provider: 'TradingView' }, { provenance: 'DISPLAY_ONLY' }, { providerSymbol: 'DAX' }, { canonicalInstrument: 'ES' },
     { instrumentType: 'INDEX' }, { mid: NaN }, { mid: 0 }, { observedAt: null }, { observedAt: new Date(now + 6000).toISOString() }] )
     expect(nativeQuoteDisplay({ ...quote, ...patch }, now).value).toBeNull()
 })
 it('hides stale, denied and non-tradeable numbers while retaining a reason', () => {
   expect(nativeQuoteDisplay(quote, now + 15001)).toEqual({ value: null, freshness: 'STALE', reason: 'STALE_QUOTE' })
   expect(nativeQuoteDisplay({ ...quote, availabilityReason: 'LICENSE_REQUIRED' }, now).reason).toBe('LICENSE_REQUIRED')
   for (const reason of ['NO_PROVIDER', 'DISPLAY_NOT_AUTHORIZED', 'NO_CREDENTIALS'] as const) {
     const display = nativeQuoteDisplay({ ...quote, providerSymbol: null, availabilityReason: reason }, now)
     expect(display.value).toBeNull()
     expect(display.reason).toBe(reason)
   }
   expect(nativeQuoteDisplay({ ...quote, priceBasis: 'CLOSEOUT_MID', tradeable: false }, now).value).toBeNull()
 })
 it('does not accept analysis from another exact symbol or display feed', () => {
   const analysis = { canonicalInstrument: 'GER40', provider: 'OANDA', providerSymbol: 'DE30_EUR', priceBasis: 'MID', freshness: 'CLOSE', provenance: 'USER_CONNECTED' } as const
   expect(scopedNativeAnalysis(analysis as never, 'GBPUSD')).toBeNull()
   expect(scopedNativeAnalysis({ ...analysis, providerSymbol: 'SPX500_USD' } as never, 'GER40')).toBeNull()
   expect(scopedNativeAnalysis({ ...analysis, provenance: 'DISPLAY_ONLY' } as never, 'GER40')).toBeNull()
   expect(scopedNativeAnalysis(analysis as never, 'GER40')).toBe(analysis)
 })
})

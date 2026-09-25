import type { AnalysisMetrics, InstrumentQuote, MarketAvailabilityReason, MarketFreshness } from '../../api/marketData'

// These identities narrow display only. The server must still verify the user's
// account capabilities and both authorization gates before returning any values.
const identities: Record<string, [string, string]> = {
  GBPUSD: ['GBP_USD', 'FX'], EURUSD: ['EUR_USD', 'FX'], GER40: ['DE30_EUR', 'CFD'],
  NAS100: ['NAS100_USD', 'CFD'], XAUUSD: ['XAU_USD', 'METAL'], USOIL: ['WTICO_USD', 'CFD']
}

export function nativeQuoteDisplay(quote?: InstrumentQuote, now = Date.now()): {
  value: number | null; freshness: MarketFreshness; reason?: MarketAvailabilityReason | null
} {
  const unavailable = (reason: MarketAvailabilityReason, freshness: MarketFreshness = 'UNAVAILABLE') => ({ value: null, freshness, reason })
  if (!quote) return unavailable('NO_PROVIDER')
  // A denied response may intentionally omit its provider identity. Preserve
  // that reason without ever accepting any accompanying numeric value.
  if (quote.availabilityReason) return unavailable(quote.availabilityReason, quote.freshness === 'STALE' ? 'STALE' : 'UNAVAILABLE')
  const identity = identities[quote.canonicalInstrument]
  if (!identity || quote.providerSymbol !== identity[0]) return unavailable('SYMBOL_NOT_SUPPORTED')
  if (quote.provider !== 'OANDA' || quote.provenance !== 'USER_CONNECTED' || quote.instrumentType !== identity[1]) return unavailable('DISPLAY_NOT_AUTHORIZED')
  if (quote.freshness === 'STALE') return unavailable('STALE_QUOTE', 'STALE')
  if (quote.tradeable === false || quote.priceBasis === 'CLOSEOUT_MID' || quote.freshness === 'CLOSE') return unavailable('MARKET_CLOSED', 'CLOSE')
  if (!['LIVE', 'INDICATIVE'].includes(quote.freshness) || quote.priceBasis !== 'MID') return unavailable('NO_QUOTE')
  const age = quote.observedAt ? now - Date.parse(quote.observedAt) : NaN
  if (!Number.isFinite(age) || age < -5_000) return unavailable('NO_QUOTE')
  if (age > 15_000) return unavailable('STALE_QUOTE', 'STALE')
  if (quote.mid == null || !Number.isFinite(quote.mid) || quote.mid <= 0) return unavailable('NO_QUOTE')
  return { value: quote.mid, freshness: quote.freshness, reason: null }
}

export function scopedNativeAnalysis(analysis: AnalysisMetrics | null | undefined, selected: string) {
  const identity = identities[selected]
  return identity && analysis?.canonicalInstrument === selected && analysis.provider === 'OANDA'
    && analysis.provenance === 'USER_CONNECTED' && analysis.providerSymbol === identity[0]
    && analysis.priceBasis === 'MID' && analysis.freshness === 'CLOSE'
    && (!analysis.availabilityReason || analysis.availabilityReason === 'NO_COMPLETED_REFERENCE') ? analysis : null
}

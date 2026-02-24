import { apiGet } from './client'

export type QuoteAvailabilityReason =
  | 'OK'
  | 'NO_PROVIDER'
  | 'NO_CREDENTIALS'
  | 'SYMBOL_NOT_SUPPORTED'
  | 'RATE_LIMIT'
  | 'UPSTREAM_ERROR'
  | 'UNAUTHORIZED'

export type LiveQuoteResponse = {
  symbol: string
  bid?: number | null
  ask?: number | null
  mid?: number | null
  spread?: number | null
  tsUtc?: string | null
  source?: string | null
  available: boolean
  reason?: QuoteAvailabilityReason | string | null
}

export async function fetchLiveQuote(symbol: string) {
  return apiGet<LiveQuoteResponse>(`/quotes?symbol=${encodeURIComponent(symbol)}`)
}

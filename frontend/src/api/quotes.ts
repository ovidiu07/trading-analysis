import { apiGet } from './client'

export type LiveQuoteResponse = {
  symbol: string
  bid?: number | null
  ask?: number | null
  mid?: number | null
  spread?: number | null
  tsUtc?: string | null
  source?: string | null
  available: boolean
  reason?: string | null
}

export async function fetchLiveQuote(symbol: string) {
  return apiGet<LiveQuoteResponse>(`/quotes?symbol=${encodeURIComponent(symbol)}`)
}

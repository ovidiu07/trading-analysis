import { apiGet } from './client'
import { TradeRequest } from './trades'

export type SymbolSearchResult = {
  symbol: string
  name?: string | null
  exchange?: string | null
  currency?: string | null
  market?: TradeRequest['market'] | null
}

const toQuery = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, value)
    }
  })
  const query = sp.toString()
  return query ? `?${query}` : ''
}

export async function searchSymbols(params: { q: string; market?: TradeRequest['market'] }) {
  return apiGet<SymbolSearchResult[]>(`/symbols/search${toQuery({ q: params.q, market: params.market })}`)
}

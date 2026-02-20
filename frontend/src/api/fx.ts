import { apiGet } from './client'

export type FxRateResponse = {
  baseCurrency: string
  quoteCurrency: string
  rate: number
  timestamp: string
  source: string
}

const toQuery = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) {
      sp.set(key, value.trim())
    }
  })
  const query = sp.toString()
  return query ? `?${query}` : ''
}

export async function fetchFxRate(baseCurrency: string, quoteCurrency: string) {
  return apiGet<FxRateResponse>(`/fx/rate${toQuery({ base: baseCurrency, quote: quoteCurrency })}`)
}

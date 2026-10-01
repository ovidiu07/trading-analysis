import { apiGet, apiPost } from './client'
import type { TradaysCoverage } from '../features/news/tradaysWarnings'

export type NewsFigure = { value: number | null; series: string; period: string; unit: string; adjustment: string }
export type NewsStory = { id: string; headline: string; publisher: string; url: string; publishedAt: string; sourceUpdatedAt?: string | null; excerpt?: string | null; category: string; aggregator?: string | null }
export type NewsEvent = { id: string; name: string; region: string; scheduledAt: string | null; scheduledDate: string; sourceTimezone: string; source: string; url: string; category: string; status: string; referencePeriod: string | null; actual: NewsFigure | null; forecast: NewsFigure | null; previous: NewsFigure | null; revisedPrevious: NewsFigure | null; publishedAt: string | null; sourceUpdatedAt: string | null }
export type NewsObservation = { id: string; name: string; region: string; source: string; url: string; actual: NewsFigure; previous: NewsFigure | null; sourceUpdatedAt: string | null; flag: string | null }
export type NewsCoverage = { source: string; feedId?: string | null; capability: 'NEWS' | 'CALENDAR' | 'OBSERVATIONS'; state: string; lastSuccessAt: string | null; lastAttemptAt: string | null; nextRefreshAt: string | null }
export type NewsContext = { instrument: string; topic: string; date: string; timezone: string; asOf: string; window: string; news: NewsStory[]; events: NewsEvent[]; observations: NewsObservation[]; coverage: NewsCoverage[]; lastSuccessAt: string | null; historical: boolean; calendar?: TradaysCoverage }
export type NewsContextRequest = { instrument: string; date: string; timezone: string; window: 'SESSION' | 'LAST_24_HOURS'; asOf?: string }
export function fetchNewsContext(request: NewsContextRequest, signal?: AbortSignal) {
  const params = new URLSearchParams(Object.entries(request).filter(([, value]) => value != null) as [string, string][])
  return apiGet<NewsContext>(`/market-context?${params}`, signal)
}
export function requestCompanyNews(instrument: string) {
  return apiPost<{ state: string }>(`/market-context/company-demand?${new URLSearchParams({ instrument })}`, {})
}
export function refreshNewsContext(instrument: string) {
  return apiPost<void>(`/market-context/refresh?${new URLSearchParams({ instrument })}`, {})
}
export function forecastDifference(actual: NewsFigure | null, forecast: NewsFigure | null) {
  if (!actual || !forecast || actual.value == null || forecast.value == null || !Number.isFinite(actual.value) || !Number.isFinite(forecast.value)) return null
  return actual.series === forecast.series && actual.period === forecast.period && actual.unit === forecast.unit && actual.adjustment === forecast.adjustment ? actual.value - forecast.value : null
}

export function newsInstrumentLabel(instrument: string) {
  const labels: Record<string, string> = { 'OANDA:DE30EUR': 'GER40 · DAX CFD', 'OANDA:NAS100USD': 'NAS100 · Nasdaq-100 CFD', 'TVC:USOIL': 'USOIL', 'OANDA:WTICOUSD': 'WTI CFD' }
  if (/^(NASDAQ|NYSE|AMEX|LSE|XETR|FWB|EURONEXT|EPA|AMS):/i.test(instrument)) return instrument
  return labels[instrument.toUpperCase()] ?? instrument.split(':').pop() ?? instrument
}

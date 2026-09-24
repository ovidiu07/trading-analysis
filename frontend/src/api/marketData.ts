import { apiGet } from './client'

export type MarketFreshness = 'LIVE' | 'INDICATIVE' | 'DELAYED' | 'CLOSE' | 'STALE' | 'MANUAL' | 'UNAVAILABLE'
export type MarketAvailabilityReason = 'NO_PROVIDER' | 'NO_CREDENTIALS' | 'DISPLAY_NOT_AUTHORIZED' | 'SYMBOL_NOT_SUPPORTED' | 'MARKET_CLOSED' | 'RATE_LIMIT' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_ERROR' | 'NO_COMPLETED_REFERENCE' | 'NO_PUBLISHED_EVENT_DATA' | 'LICENSE_REQUIRED'

export type InstrumentQuote = {
  canonicalInstrument: string
  provider: string
  providerSymbol?: string | null
  instrumentType: string
  priceBasis: 'MID' | 'BID' | 'ASK' | 'CLOSE'
  bid?: number | null
  ask?: number | null
  mid?: number | null
  spread?: number | null
  unit: string
  observedAt?: string | null
  retrievedAt: string
  freshness: MarketFreshness
  tradeable?: boolean | null
  provenance: string
  sourceUrl?: string | null
  delayDescription?: string | null
  availabilityReason?: MarketAvailabilityReason | null
}

export type MacroObservation = {
  canonicalInstrument: string
  provider: string
  providerSymbol: string
  instrumentType: string
  priceBasis: string
  value?: number | null
  previousValue?: number | null
  changeBasisPoints?: number | null
  unit: string
  observationDate?: string | null
  retrievedAt: string
  freshness: MarketFreshness
  provenance: string
  sourceUrl?: string | null
  availabilityReason?: MarketAvailabilityReason | null
}

export type MarketWorkspaceResponse = {
  retrievedAt: string
  selectedInstrument: string
  providerEnvironment?: 'PRACTICE' | 'LIVE' | null
  quotes: InstrumentQuote[]
  macroObservations: MacroObservation[]
  analysis?: AnalysisMetrics | null
}

export type AnalysisRange = {
  window: string
  observationDate: string
  startsAt: string
  endsAt: string
  high?: number | null
  low?: number | null
  completionState: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETE' | 'UNAVAILABLE'
  completedBarCount: number
}

export type AnalysisMetrics = {
  canonicalInstrument: string
  provider: string
  providerSymbol?: string | null
  sourceUrl?: string | null
  priceBasis?: string | null
  dailyAlignment: string
  dailyOpen?: number | null
  dailyOpenObservedAt?: string | null
  previousDailyClose?: number | null
  previousDailyCloseObservedAt?: string | null
  changePercent?: number | null
  previousDayHigh?: number | null
  previousDayLow?: number | null
  previousDayDate?: string | null
  asia?: AnalysisRange | null
  london?: AnalysisRange | null
  currentWindow?: string | null
  retrievedAt: string
  freshness: MarketFreshness
  provenance: string
  availabilityReason?: MarketAvailabilityReason | null
}

export function canonicalMarketInstrument(chartSymbol: string, fallback: string) {
  const chart = chartSymbol.toUpperCase()
  if (chart.includes('DE30') || chart.includes('DAX') || chart.includes('GER40')) return 'GER40'
  if (chart.includes('NAS100') || chart.includes('NASDAQ')) return 'NAS100'
  if (chart.includes('ES1!') || chart.includes('CME_MINI:ES')) return 'ES'
  if (chart.includes('XAUUSD')) return 'XAUUSD'
  if (chart.includes('USOIL') || chart.includes('WTICO')) return 'USOIL'
  if (chart.includes('DXY')) return 'DXY'
  if (chart.includes('GBPUSD')) return 'GBPUSD'
  if (chart.includes('EURUSD')) return 'EURUSD'
  return fallback.trim().toUpperCase() || 'UNSET'
}

export function fetchMarketWorkspace(accountId: string, selectedInstrument: string, date: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ accountId, selectedInstrument, date })
  return apiGet<MarketWorkspaceResponse>(`/market-workspace?${query}`, signal)
}

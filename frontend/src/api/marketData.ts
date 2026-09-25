import { apiGet } from './client'

export type MarketFreshness = 'LIVE' | 'INDICATIVE' | 'DELAYED' | 'CLOSE' | 'STALE' | 'MANUAL' | 'UNAVAILABLE'
export type MarketAvailabilityReason = 'NO_PROVIDER' | 'NO_CREDENTIALS' | 'PROVIDER_DISCONNECTED' | 'NO_QUOTE' | 'STALE_QUOTE' | 'CONNECTION_LOST' | 'DISPLAY_NOT_AUTHORIZED' | 'SYMBOL_NOT_SUPPORTED' | 'MARKET_CLOSED' | 'RATE_LIMIT' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_ERROR' | 'NO_COMPLETED_REFERENCE' | 'NO_PUBLISHED_EVENT_DATA' | 'LICENSE_REQUIRED'

export type InstrumentQuote = {
  canonicalInstrument: string
  provider: string
  providerSymbol?: string | null
  instrumentType: string
  priceBasis: 'MID' | 'BID' | 'ASK' | 'CLOSE' | 'CLOSEOUT_MID'
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
  // Cash indices and stocks must never silently select an OANDA CFD.
  const identities: Record<string, string> = {
    'OANDA:GBPUSD': 'GBPUSD', 'OANDA:EURUSD': 'EURUSD', 'OANDA:DE30EUR': 'GER40',
    'OANDA:NAS100USD': 'NAS100', 'OANDA:XAUUSD': 'XAUUSD', 'TVC:USOIL': 'USOIL',
    'OANDA:WTICOUSD': 'USOIL', 'TVC:DXY': 'DXY', 'CME_MINI:ES1!': 'ES'
  }
  const chart = chartSymbol.trim().toUpperCase()
  if (identities[chart]) return identities[chart]
  if (['GBPUSD', 'EURUSD', 'GER40', 'NAS100', 'XAUUSD', 'USOIL', 'DXY', 'ES'].includes(chart)) return chart
  return 'UNSET'
}

export function fetchMarketWorkspace(accountId: string, selectedInstrument: string, date: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ accountId, selectedInstrument, date })
  return apiGet<MarketWorkspaceResponse>(`/market-workspace?${query}`, signal)
}

export const providerConnectionChanged = 'tradejaudit:provider-connection-changed'
export function announceProviderConnectionChanged() {
  window.dispatchEvent(new Event(providerConnectionChanged))
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(providerConnectionChanged)
    channel.postMessage('changed')
    channel.close()
  }
}

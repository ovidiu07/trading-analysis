import { apiGet, apiPost, apiPut } from './client'

export type SignalAnalyticsOverview = {
  totalSignals: number
  closedSignals: number
  openSignals: number
  winRate: number
  expectancyR: number
  avgPnlR: number
  avgConfidenceScore: number
  avgHoldBars: number
  avgHoldMinutes: number
}

export type SignalRecentWindow = {
  windowSize: number
  sampleSize: number
  winRate: number
  expectancyR: number
  avgConfidenceScore: number
}

export type SignalTrendPoint = {
  label: string
  avgConfidenceScore: number
  expectancyR: number
  sampleSize: number
}

export type SignalWeakCondition = {
  symbol: string
  timeframe: string
  setupType: string
  regime: string
  direction: string
  sampleSize: number
  winRate: number
  expectancyR: number
  action: 'PAUSE' | 'REDUCE_CONFIDENCE' | string
}

export type SignalRecommendation = {
  symbolScope: string
  timeframe: string
  regimeScope: string
  profileId: string
  profileJson: Record<string, unknown>
  minSamples: number
  sampleSize: number
  recommendationScore: number
  winRate: number
  expectancyR: number
  reasons: string[]
  generatedAt: string
}

export type SignalAnalyticsSummaryResponse = {
  overview: SignalAnalyticsOverview
  recentWindows: SignalRecentWindow[]
  confidenceTrend: SignalTrendPoint[]
  weakConditions: SignalWeakCondition[]
  topRecommendation?: SignalRecommendation | null
}

export type SignalBreakdownRow = {
  key: string
  sampleSize: number
  winRate: number
  expectancyR: number
  avgPnlR: number
  avgConfidenceScore: number
  reducedConfidenceSuggested: boolean
}

export type SignalBreakdownResponse = {
  rows: SignalBreakdownRow[]
}

export type SignalSymbolTimeframeRow = {
  symbol: string
  timeframe: string
  sampleSize: number
  winRate: number
  expectancyR: number
  avgConfidenceScore: number
  recommendedProfileId?: string | null
  recommendationScore?: number | null
}

export type SignalSymbolTimeframeResponse = {
  rows: SignalSymbolTimeframeRow[]
}

export type TradingViewWebhookSettingsResponse = {
  enabled: boolean
  hasSecret: boolean
  secretHint?: string | null
  lastRotatedAt?: string | null
  openSignalWebhookUrl: string
  closeSignalWebhookUrl: string
  sampleOpenPayload: string
  sampleClosePayload: string
}

export type TradingViewWebhookSecretResetResponse = {
  secret: string
  secretHint: string
  generatedAt: string
  openSignalWebhookUrl: string
  closeSignalWebhookUrl: string
}

const toQuery = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      sp.set(key, value)
    }
  })
  const query = sp.toString()
  return query ? `?${query}` : ''
}

export async function fetchSignalAnalyticsSummary(params: {
  from?: string
  to?: string
  symbol?: string
  timeframe?: string
} = {}) {
  return apiGet<SignalAnalyticsSummaryResponse>(`/analytics/signals/summary${toQuery(params)}`)
}

export async function fetchSignalRecommendations(params: {
  symbol?: string
  timeframe?: string
  regime?: string
} = {}) {
  return apiGet<{ recommendations: SignalRecommendation[] }>(`/analytics/signals/recommendations${toQuery(params)}`)
}

export async function fetchSignalBreakdownBySetup(params: {
  from?: string
  to?: string
  symbol?: string
  timeframe?: string
} = {}) {
  return apiGet<SignalBreakdownResponse>(`/analytics/signals/by-setup${toQuery(params)}`)
}

export async function fetchSignalBreakdownByRegime(params: {
  from?: string
  to?: string
  symbol?: string
  timeframe?: string
} = {}) {
  return apiGet<SignalBreakdownResponse>(`/analytics/signals/by-regime${toQuery(params)}`)
}

export async function fetchSignalBySymbolTimeframe(params: {
  from?: string
  to?: string
} = {}) {
  return apiGet<SignalSymbolTimeframeResponse>(`/analytics/signals/by-symbol-timeframe${toQuery(params)}`)
}

export async function fetchTradingViewWebhookSettings() {
  return apiGet<TradingViewWebhookSettingsResponse>('/integrations/tradingview/settings')
}

export async function updateTradingViewWebhookSettings(enabled: boolean) {
  return apiPut<TradingViewWebhookSettingsResponse>('/integrations/tradingview/settings', { enabled })
}

export async function resetTradingViewWebhookSecret() {
  return apiPost<TradingViewWebhookSecretResetResponse>('/integrations/tradingview/settings/reset-secret', {})
}

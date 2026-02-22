import { apiDelete, apiGet, apiPost, apiPut } from './client'

export type ChartProfileScope = 'SESSION_MODE'

export type ChartEmbedConfig = {
  symbol?: string
  interval?: string
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM'
  allowSymbolChange?: boolean
  hideControls?: boolean
  timezone?: string
  chartHeightPref?: number
}

export type ChartProfilePrefs = {
  showLevels?: boolean
  defaultLevelsTemplateId?: string
  lastUsedWatchlistId?: string
  followPlanSymbol?: boolean
}

export type ChartProfile = {
  id: string
  name: string
  isDefault: boolean
  scope: ChartProfileScope
  embedConfigJson: ChartEmbedConfig
  tjaPrefsJson: ChartProfilePrefs
  createdAt?: string
  updatedAt?: string
}

export async function listChartProfiles(scope: ChartProfileScope = 'SESSION_MODE') {
  return apiGet<ChartProfile[]>(`/chart-profiles?scope=${encodeURIComponent(scope)}`)
}

export async function createChartProfile(payload: {
  name: string
  scope?: ChartProfileScope
  isDefault?: boolean
  embedConfigJson: ChartEmbedConfig
  tjaPrefsJson?: ChartProfilePrefs
}) {
  return apiPost<ChartProfile>('/chart-profiles', payload)
}

export async function updateChartProfile(id: string, payload: {
  name?: string
  scope?: ChartProfileScope
  isDefault?: boolean
  embedConfigJson?: ChartEmbedConfig
  tjaPrefsJson?: ChartProfilePrefs
}) {
  return apiPut<ChartProfile>(`/chart-profiles/${id}`, payload)
}

export async function deleteChartProfile(id: string) {
  return apiDelete(`/chart-profiles/${id}`)
}

export async function setDefaultChartProfile(id: string) {
  return apiPost<ChartProfile>(`/chart-profiles/${id}/set-default`, {})
}

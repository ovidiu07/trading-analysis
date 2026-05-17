import { apiGet, apiPut } from './client'

export type ChartSettingsResponse = {
  preloadedIndicators: string[]
}

export type ChartSettingsRequest = {
  preloadedIndicators: string[]
}

export function normalizeIndicatorLines(value: string) {
  const seen = new Set<string>()
  const indicators: string[] = []
  value.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((indicator) => {
      if (!seen.has(indicator)) {
        seen.add(indicator)
        indicators.push(indicator)
      }
    })
  return indicators
}

export async function fetchChartSettings() {
  return apiGet<ChartSettingsResponse>('/chart-settings')
}

export async function fetchAdminChartSettings() {
  return apiGet<ChartSettingsResponse>('/admin/chart-settings')
}

export async function updateAdminChartSettings(payload: ChartSettingsRequest) {
  return apiPut<ChartSettingsResponse>('/admin/chart-settings', payload)
}

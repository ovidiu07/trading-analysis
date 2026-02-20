import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { AssetItem } from './assets'

export type StrategySource = 'MY' | 'MENTOR'

export type StrategyResponse = {
  id: string
  source: StrategySource
  name: string
  model: string
  entryConditionsRich?: string | null
  entryConditions: string[]
  invalidationLogic: string
  tpFramework: string
  noTradeRules?: string | null
  sessionSuitability: string[]
  tags: string[]
  snapshotAssetId?: string | null
  snapshotAsset?: AssetItem | null
  assets?: AssetItem[]
  archived: boolean
  slug?: string | null
  updatedAt?: string | null
}

export type StrategyListResponse = {
  myStrategies: StrategyResponse[]
  mentorStrategies: StrategyResponse[]
}

export type StrategyRequest = {
  name: string
  model: string
  entryConditionsRich?: string | null
  entryConditions?: string[]
  invalidationLogic: string
  tpFramework: string
  noTradeRules?: string | null
  sessionSuitability: string[]
  tags: string[]
  snapshotAssetId?: string | null
  assetIds?: string[]
  archived?: boolean
}

const toQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      sp.set(key, String(value))
    }
  })
  const query = sp.toString()
  return query ? `?${query}` : ''
}

export async function listStrategies(params: { includeArchived?: boolean } = {}) {
  return apiGet<StrategyListResponse>(`/strategies${toQuery({ includeArchived: params.includeArchived })}`)
}

export async function createStrategy(payload: StrategyRequest) {
  return apiPost<StrategyResponse>('/strategies', payload)
}

export async function updateStrategy(id: string, payload: StrategyRequest) {
  return apiPut<StrategyResponse>(`/strategies/${id}`, payload)
}

export async function archiveStrategy(id: string) {
  return apiDelete(`/strategies/${id}`)
}

export async function attachStrategyAsset(strategyId: string, assetId: string) {
  return apiPost<StrategyResponse>(`/strategies/${strategyId}/assets/${assetId}`, {})
}

export async function removeStrategyAsset(strategyId: string, assetId: string) {
  return apiDelete(`/strategies/${strategyId}/assets/${assetId}`)
}

export async function setStrategySnapshot(strategyId: string, assetId: string) {
  return apiPut<StrategyResponse>(`/strategies/${strategyId}/snapshot/${assetId}`, {})
}

export async function clearStrategySnapshot(strategyId: string) {
  return apiDelete(`/strategies/${strategyId}/snapshot`)
}

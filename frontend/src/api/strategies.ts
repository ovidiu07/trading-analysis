import { apiDelete, apiGet, apiPost, apiPut } from './client'

export type StrategySource = 'MY' | 'MENTOR'

export type StrategyResponse = {
  id: string
  source: StrategySource
  name: string
  model: string
  entryConditions: string[]
  invalidationLogic: string
  tpFramework: string
  noTradeRules?: string | null
  sessionSuitability: string[]
  tags: string[]
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
  entryConditions: string[]
  invalidationLogic: string
  tpFramework: string
  noTradeRules?: string | null
  sessionSuitability: string[]
  tags: string[]
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

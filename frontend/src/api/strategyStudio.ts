import { apiGet, apiPost, apiPut } from './client'
import type { Studio, StudioWrite, Portable } from '../features/strategyStudio/model'
import type { BacktestingTrade } from './backtesting'
export type Version = {
  id: string
  versionNumber: number
  name?: string
  changeDescription?: string
  createdAt?: string
}
export type VersionDetail = { version: Version; snapshot: Record<string, unknown> }
export type Execution = {
  id: string
  versionId?: string
  template: import('../features/strategyStudio/model').Checklist
  answers: Record<string, boolean>
  createdAt: string
}
export type StrategyEvidence = {
  trades: BacktestingTrade[]
  workspaces: { id: string; title?: string; symbol?: string }[]
}
export const getStudio = (id: string) => apiGet<Studio>(`/strategies/${id}/studio`)
export const createStudio = (body: StudioWrite) => apiPost<Studio>('/strategies/studio', body)
export const saveStudio = (id: string, body: StudioWrite) => apiPut<Studio>(`/strategies/${id}/studio`, body)
export const duplicateStudio = (id: string) => apiPost<Studio>(`/strategies/${id}/duplicate`, {})
export const listVersions = (id: string) => apiGet<Version[]>(`/strategies/${id}/versions`)
export const getVersion = (id: string, version: string) =>
  apiGet<VersionDetail>(`/strategies/${id}/versions/${version}`)
export const createCheckpoint = (id: string, body: { expectedRevision: number; name: string; description: string }) =>
  apiPost<VersionDetail>(`/strategies/${id}/versions`, body)
export const restoreVersion = (id: string, version: string, expectedRevision: number) =>
  apiPost<Studio>(`/strategies/${id}/versions/${version}/restore`, { expectedRevision })
export const exportStudio = (id: string) => apiGet<Portable>(`/strategies/${id}/export`)
export const importStudio = (body: Portable) => apiPost<Studio>('/strategies/import', body)
export const listExecutions = (id: string) => apiGet<Execution[]>(`/strategies/${id}/checklist-executions`)
export const saveExecution = (
  id: string,
  body: { expectedRevision: number; checklistId: string; answers: Record<string, boolean>; versionId?: string }
) => apiPost<Execution>(`/strategies/${id}/checklist-executions`, body)
export const getStrategyEvidence = (id: string) => apiGet<StrategyEvidence>(`/strategies/${id}/studio/evidence`)
export const linkResearchTrades = (id: string, body: { tradeIds: string[]; versionId?: string; sample?: string }) =>
  apiPost<void>(`/strategies/${id}/studio/trades`, body)

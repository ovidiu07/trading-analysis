import { apiDelete, apiGet, apiPatch, apiPost, apiPostMultipart } from './client'
import type { AssetItem } from './assets'

export type BacktestingScreenshotResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'MISSED' | 'INVALID' | 'GOOD_EXAMPLE' | 'BAD_EXAMPLE'

export type BacktestingStrategySummary = {
  id: string
  name: string
  model?: string | null
  entryConditions?: string[]
  invalidationLogic?: string | null
  tpFramework?: string | null
  noTradeRules?: string | null
}

export type BacktestingWorkspace = {
  id: string
  symbol: string
  marketType?: string | null
  strategyId?: string | null
  strategyNameSnapshot?: string | null
  strategyName?: string | null
  title?: string | null
  primaryTimeframe?: string | null
  contextTimeframe?: string | null
  executionTimeframe?: string | null
  entryTimeframe?: string | null
  numberOfTrades: number
  winningTrades: number
  losingTrades: number
  breakevenTrades: number
  averageR?: number | null
  winRate: number
  lossRate: number
  breakevenRate: number
  categorizedTrades: number
  missingClassificationCount: number
  screenshotCount: number
  notes?: string | null
  whatWorked?: string | null
  whatFailed?: string | null
  bestConditions?: string | null
  avoidConditions?: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt?: string | null
  updatedAt?: string | null
  strategy?: BacktestingStrategySummary | null
}

export type BacktestingWorkspacePayload = {
  symbol: string
  marketType?: string | null
  strategyId?: string | null
  strategyNameSnapshot?: string | null
  title?: string | null
  primaryTimeframe?: string | null
  contextTimeframe?: string | null
  executionTimeframe?: string | null
  entryTimeframe?: string | null
  numberOfTrades?: number
  winningTrades?: number
  losingTrades?: number
  breakevenTrades?: number
  averageR?: number | null
  notes?: string | null
  whatWorked?: string | null
  whatFailed?: string | null
  bestConditions?: string | null
  avoidConditions?: string | null
}

export type BacktestingSummary = {
  totalBacktests: number
  totalScreenshots: number
  totalTradesTested: number
  averageWinRate: number
  bestPerformer?: string | null
}

export type BacktestingListResponse = {
  summary: BacktestingSummary
  workspaces: BacktestingWorkspace[]
}

export type BacktestingScreenshot = {
  id: string
  workspaceId: string
  assetId: string
  originalFileName: string
  contentType?: string | null
  sizeBytes?: number | null
  url?: string | null
  viewUrl?: string | null
  downloadUrl?: string | null
  thumbnailUrl?: string | null
  caption?: string | null
  tradeResult?: BacktestingScreenshotResult | null
  session?: string | null
  timeframe?: string | null
  tags: string[]
  sortOrder?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  asset?: AssetItem | null
}

export type BacktestingScreenshotPayload = {
  caption?: string | null
  tradeResult?: BacktestingScreenshotResult | null
  session?: string | null
  timeframe?: string | null
  tags?: string[]
  sortOrder?: number | null
}

export async function listBacktestingWorkspaces() {
  return apiGet<BacktestingListResponse>('/backtesting/workspaces')
}

export async function createBacktestingWorkspace(payload: BacktestingWorkspacePayload) {
  return apiPost<BacktestingWorkspace>('/backtesting/workspaces', payload)
}

export async function getBacktestingWorkspace(id: string) {
  return apiGet<BacktestingWorkspace>(`/backtesting/workspaces/${encodeURIComponent(id)}`)
}

export async function updateBacktestingWorkspace(id: string, payload: BacktestingWorkspacePayload) {
  return apiPatch<BacktestingWorkspace>(`/backtesting/workspaces/${encodeURIComponent(id)}`, payload)
}

export async function archiveBacktestingWorkspace(id: string) {
  return apiPost<void>(`/backtesting/workspaces/${encodeURIComponent(id)}/archive`, {})
}

export async function listBacktestingScreenshots(workspaceId: string) {
  return apiGet<BacktestingScreenshot[]>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/screenshots`)
}

export async function uploadBacktestingScreenshots(workspaceId: string, files: File[]) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  return apiPostMultipart<BacktestingScreenshot[]>(`/backtesting/workspaces/${encodeURIComponent(workspaceId)}/screenshots`, formData)
}

export async function updateBacktestingScreenshot(id: string, payload: BacktestingScreenshotPayload) {
  return apiPatch<BacktestingScreenshot>(`/backtesting/screenshots/${encodeURIComponent(id)}`, payload)
}

export async function deleteBacktestingScreenshot(id: string) {
  return apiDelete(`/backtesting/screenshots/${encodeURIComponent(id)}`)
}

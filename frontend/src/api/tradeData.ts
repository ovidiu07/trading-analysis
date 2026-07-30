import { apiPost } from './client'
import { announceTradingAccountsChanged } from './accounts'

export type TradeDeletionScope = 'DATE_RANGE' | 'ENTIRE_HISTORY'

export type TradeDeletionRequest = {
  accountId: string
  scope: TradeDeletionScope
  startDate?: string
  endDate?: string
  timezone: string
  confirmed?: boolean
  confirmationText?: string
  previewToken?: string
}

export type TradeDeletionPreview = {
  accountId: string
  accountName: string
  scope: TradeDeletionScope
  startDate?: string | null
  endDate?: string | null
  timezone: string
  tradeCount: number
  earliestAffectedTrade?: string | null
  latestAffectedTrade?: string | null
  realizedPnl: number
  linkedJournalRecords: number
  sourceDistribution: Record<string, number>
  previewToken: string
}

export type TradeDeletionResult = {
  accountId: string
  accountName: string
  deletedTrades: number
  deletedRealizedPnl: number
  deletedAt: string
}

export function previewTradeDeletion(request: TradeDeletionRequest) {
  return apiPost<TradeDeletionPreview>('/trade-data/deletion-preview', request)
}

export async function deleteAccountTrades(request: TradeDeletionRequest) {
  const result = await apiPost<TradeDeletionResult>('/trade-data/delete', request)
  announceTradingAccountsChanged()
  return result
}

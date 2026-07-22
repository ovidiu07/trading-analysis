import { apiGet, apiPost, apiPostMultipart } from './client'
import type { TradeRequest } from './trades'

export type Mt5ManualMatch = {
  tradeId: string
  symbol: string
  confidence: number
  explanation: string
}

export type Mt5TradePreview = {
  externalPositionId: string
  externalSymbol: string
  mappedSymbol?: string | null
  market?: TradeRequest['market'] | null
  tradeCurrency?: string | null
  direction: TradeRequest['direction']
  status: TradeRequest['status']
  openedAt?: string | null
  closedAt?: string | null
  quantity?: number | null
  entryPrice?: number | null
  exitPrice?: number | null
  initialStopLossPrice?: number | null
  initialTakeProfitPrice?: number | null
  finalStopLossPrice?: number | null
  finalTakeProfitPrice?: number | null
  grossPnl?: number | null
  commission?: number | null
  otherCosts?: number | null
  netPnl?: number | null
  accountCurrency?: string | null
  entryOrderType?: string | null
  requestedEntryPrice?: number | null
  requestedExitPrice?: number | null
  entrySlippagePoints?: number | null
  exitSlippagePoints?: number | null
  exitReason?: string | null
  note?: string | null
  duplicate: boolean
  existingTradeId?: string | null
  potentialManualMatches: Mt5ManualMatch[]
  warnings: string[]
}

export type Mt5ImportPreview = {
  importBatchId: string
  status: string
  account: {
    externalAccountId?: string | null
    accountName?: string | null
    currency?: string | null
    broker?: string | null
    server?: string | null
    accountType?: string | null
    accountMode?: string | null
    reportGeneratedAt?: string | null
  }
  summary: {
    positionsFound: number
    ordersFound: number
    dealsFound: number
    accountTransactionsFound: number
    tradesReady: number
    duplicates: number
    warnings: number
    grossPnl: number
    costs: number
    netPnl: number
  }
  sourceTimezone?: string | null
  targetAccountId?: string | null
  unmappedSymbols: Array<{ externalSymbol: string; suggestedInternalSymbol?: string | null }>
  trades: Mt5TradePreview[]
  warnings: string[]
  errors: string[]
}

export type Mt5SymbolMapping = {
  externalSymbol: string
  internalSymbol: string
  market: TradeRequest['market']
  tradeCurrency: string
  tickSize?: number | null
  tickValue?: number | null
  pointValue?: number | null
  contractMultiplier?: number | null
  saveForFuture: boolean
}

export type Mt5ImportCommitResult = {
  importBatchId: string
  status: string
  created: number
  updated: number
  duplicatesSkipped: number
  excluded: number
  grossPnl: number
  costs: number
  netPnl: number
  tradeIds: string[]
  warnings: string[]
  errors: string[]
}

export async function previewMt5Import(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiPostMultipart<Mt5ImportPreview>('/trade-imports/metatrader5/preview', formData)
}

export async function commitMt5Import(importBatchId: string, request: {
  targetAccountId: string
  sourceTimezone: string
  selectedPositionIds: string[]
  symbolMappings: Mt5SymbolMapping[]
  linkToExistingTradeIds: Record<string, string>
  saveBrokerTimezone: boolean
}) {
  return apiPost<Mt5ImportCommitResult>(`/trade-imports/${importBatchId}/commit`, request)
}

export async function getTradeImport(importBatchId: string) {
  return apiGet<Mt5ImportPreview | Mt5ImportCommitResult>(`/trade-imports/${importBatchId}`)
}

import { apiGet, apiPost, apiPut } from './client'
import { announceAnalyticsDataChanged } from './dataEvents'

export type TradingAccountStatus = 'ACTIVE' | 'ARCHIVED' | 'DISABLED'

export type TradingAccountOption = {
  id: string
  name: string
  broker?: string | null
  currency?: string | null
  externalAccountId?: string | null
  brokerServer?: string | null
  brokerTimezone?: string | null
  accountType?: string | null
  status?: TradingAccountStatus
  isDefault?: boolean
  startingBalance?: number | null
  tradeCount?: number
  createdAt?: string | null
  updatedAt?: string | null
}

export type CreateTradingAccountRequest = {
  name: string
  broker?: string
  currency: string
  accountType?: string
  externalAccountId?: string
  brokerServer?: string
  brokerTimezone?: string
  startingBalance?: number | null
}

export type UpdateTradingAccountRequest = CreateTradingAccountRequest

export const tradingAccountsChangedEvent = 'tradejaudit:trading-accounts-changed'

export function announceTradingAccountsChanged() {
  window.dispatchEvent(new CustomEvent(tradingAccountsChangedEvent))
  announceAnalyticsDataChanged()
}

export async function fetchTradingAccounts() {
  return apiGet<TradingAccountOption[]>('/accounts')
}

export async function createTradingAccount(request: CreateTradingAccountRequest) {
  return apiPost<TradingAccountOption>('/accounts', request)
}

export async function updateTradingAccount(id: string, request: UpdateTradingAccountRequest) {
  return apiPut<TradingAccountOption>(`/accounts/${id}`, request)
}

export async function archiveTradingAccount(id: string) {
  return apiPost<TradingAccountOption>(`/accounts/${id}/archive`, {})
}

export async function restoreTradingAccount(id: string) {
  return apiPost<TradingAccountOption>(`/accounts/${id}/restore`, {})
}

export async function setDefaultTradingAccount(id: string) {
  return apiPost<TradingAccountOption>(`/accounts/${id}/default`, {})
}

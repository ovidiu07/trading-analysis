import { apiGet, apiPost } from './client'

export type TradingAccountOption = {
  id: string
  name: string
  broker?: string | null
  currency?: string | null
  externalAccountId?: string | null
  brokerServer?: string | null
  brokerTimezone?: string | null
}

export type CreateTradingAccountRequest = {
  name: string
  broker?: string
  currency: string
}

export async function fetchTradingAccounts() {
  return apiGet<TradingAccountOption[]>('/accounts')
}

export async function createTradingAccount(request: CreateTradingAccountRequest) {
  return apiPost<TradingAccountOption>('/accounts', request)
}

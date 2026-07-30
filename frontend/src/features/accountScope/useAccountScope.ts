import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { fetchTradingAccounts } from '../../api/accounts'
import type { TradingAccountOption } from '../../api/accounts'
import {
  AccountScopeValue,
  accountScopeApiParams,
  accountScopeCacheKey,
  allAccountsScope,
  readAccountScope,
  writeAccountScope
} from './accountScope'

export const accountQueryKey = ['tradingAccounts'] as const
const tradingAccountsChangedEvent = 'tradejaudit:trading-accounts-changed'
const emptyTradingAccounts: TradingAccountOption[] = []

export function useAccountScope(enabled = true) {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [selectionNotice, setSelectionNotice] = useState('')
  const accountsQuery = useQuery({
    queryKey: accountQueryKey,
    queryFn: fetchTradingAccounts,
    enabled,
    staleTime: 60_000
  })
  const refetchAccounts = accountsQuery.refetch

  useEffect(() => {
    const refresh = () => {
      void refetchAccounts()
    }
    window.addEventListener(tradingAccountsChangedEvent, refresh)
    return () => window.removeEventListener(tradingAccountsChangedEvent, refresh)
  }, [refetchAccounts])

  const requestedScope = useMemo(
    () => readAccountScope(new URLSearchParams(searchParamsKey)),
    [searchParamsKey]
  )

  const scope = requestedScope

  useEffect(() => {
    if (!accountsQuery.data) return
    if (requestedScope.mode === 'all') {
      setSelectionNotice('')
      return
    }
    const availableIds = new Set(accountsQuery.data.map((account) => account.id))
    const hasUnavailableSelection = requestedScope.accountIds.some((id) => !availableIds.has(id))
    setSelectionNotice(hasUnavailableSelection ? 'accountScope.notice.invalid' : '')
  }, [accountsQuery.data, requestedScope])

  const setScope = useCallback((nextScope: AccountScopeValue) => {
    setSelectionNotice('')
    setSearchParams(writeAccountScope(searchParams, nextScope))
  }, [searchParams, setSearchParams])

  const clearScope = useCallback(() => setScope(allAccountsScope()), [setScope])

  return {
    scope,
    setScope,
    clearScope,
    accounts: accountsQuery.data || emptyTradingAccounts,
    isLoading: accountsQuery.isLoading,
    isError: accountsQuery.isError,
    retry: accountsQuery.refetch,
    apiParams: accountScopeApiParams(scope),
    cacheKey: accountScopeCacheKey(scope),
    selectionNotice,
    clearSelectionNotice: () => setSelectionNotice('')
  }
}

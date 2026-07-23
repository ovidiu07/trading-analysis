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
  selectedAccountsScope,
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

  const scope = useMemo<AccountScopeValue>(() => {
    if (requestedScope.mode === 'all' || !accountsQuery.data) {
      return requestedScope
    }
    const availableIds = new Set(accountsQuery.data.map((account) => account.id))
    return selectedAccountsScope(requestedScope.accountIds.filter((id) => availableIds.has(id)))
  }, [accountsQuery.data, requestedScope])

  useEffect(() => {
    if (!accountsQuery.data) return

    const canonicalParams = writeAccountScope(searchParams, scope)
    if (canonicalParams.toString() === searchParams.toString()) return

    if (
      requestedScope.mode === 'selected'
      && (scope.mode === 'all' || scope.accountIds.length !== requestedScope.accountIds.length)
    ) {
      setSelectionNotice('accountScope.notice.removed')
    }
    setSearchParams(canonicalParams, { replace: true })
  }, [accountsQuery.data, requestedScope, scope, searchParams, setSearchParams])

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

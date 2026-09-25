import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { ApiError } from '../../api/client'
import { fetchMarketWorkspace, providerConnectionChanged, type MarketWorkspaceResponse } from '../../api/marketData'

const keyRoot = ['marketWorkspace'] as const
const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible'

export function marketPollInterval(data?: MarketWorkspaceResponse, failures = 0) {
  if (failures) return Math.min(60_000, 5_000 * 2 ** Math.min(failures, 4))
  const reasons = data?.quotes.map(q => q.availabilityReason) ?? []
  if (reasons.includes('RATE_LIMIT')) return 60_000
  if (reasons.some(r => r === 'UPSTREAM_TIMEOUT' || r === 'UPSTREAM_ERROR')) return 15_000
  if (!data?.quotes.some(q => q.mid != null)) return 30_000
  return 5_000
}

export function useMarketWorkspaceData(accountId: string, selectedInstrument: string, date: string, active = true) {
  const { isAuthenticated, user } = useAuth()
  const queryClient = useQueryClient()
  const [isVisible, setVisible] = useState(visible)
  const [now, setNow] = useState(Date.now)
  const queryKey = useMemo(() => [...keyRoot, user?.id, accountId, selectedInstrument, date], [accountId, date, selectedInstrument, user?.id])
  const failures = useRef({ key: queryKey, count: 0 })
  if (failures.current.key !== queryKey) failures.current = { key: queryKey, count: 0 }
  const enabled = active && isVisible && isAuthenticated && Boolean(user?.id && accountId)
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      try {
        const result = await fetchMarketWorkspace(accountId, selectedInstrument, date, signal)
        if (failures.current.key === queryKey) failures.current.count = 0
        return result
      } catch (error) {
        if (!signal?.aborted && failures.current.key === queryKey) failures.current.count += 1
        throw error
      }
    },
    enabled,
    cacheTime: 0,
    staleTime: 1_000,
    refetchInterval: data => enabled ? marketPollInterval(data, failures.current.count) : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: false
  })
  const { refetch } = query

  useEffect(() => {
    // User switches and logout discard every other user's cached native prices.
    void queryClient.cancelQueries({ queryKey: keyRoot, predicate: q => !isAuthenticated || q.queryKey[1] !== user?.id })
    queryClient.removeQueries({ queryKey: keyRoot, predicate: q => !isAuthenticated || q.queryKey[1] !== user?.id })
  }, [isAuthenticated, queryClient, user?.id])

  useEffect(() => {
    const onVisibility = () => {
      setVisible(visible())
      setNow(Date.now())
      if (!visible()) void queryClient.cancelQueries({ queryKey, exact: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    const timer = enabled ? window.setInterval(() => setNow(Date.now()), 1000) : undefined
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
      void queryClient.cancelQueries({ queryKey, exact: true })
    }
  }, [enabled, queryClient, queryKey])

  useEffect(() => {
    const reset = () => { void queryClient.resetQueries({ queryKey: keyRoot }) }
    window.addEventListener(providerConnectionChanged, reset)
    const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(providerConnectionChanged)
    if (channel) channel.onmessage = reset
    return () => { window.removeEventListener(providerConnectionChanged, reset); channel?.close() }
  }, [queryClient])

  const data = useMemo(() => {
    if (!isAuthenticated || !user?.id || !active || !query.data) return undefined
    const denied = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status ?? 0)
    const heartbeatLost = query.isError || now - query.dataUpdatedAt > 15_000
    return { ...query.data, quotes: query.data.quotes.map(q => {
      if (denied) return { ...q, mid: null, bid: null, ask: null, spread: null, freshness: 'UNAVAILABLE' as const, availabilityReason: 'PROVIDER_DISCONNECTED' as const }
      if (q.mid == null) return q
      const age = q.observedAt ? now - new Date(q.observedAt).getTime() : Infinity
      if (heartbeatLost || !Number.isFinite(age) || age > 15_000 || age < -5_000)
        return { ...q, freshness: 'STALE' as const, availabilityReason: heartbeatLost ? 'CONNECTION_LOST' as const : q.availabilityReason }
      return q
    }), analysis: heartbeatLost ? null : query.data.analysis }
  }, [active, isAuthenticated, now, query.data, query.dataUpdatedAt, query.error, query.isError, user?.id])

  return { ...query, data, refetch, heartbeatAt: query.dataUpdatedAt || undefined }
}

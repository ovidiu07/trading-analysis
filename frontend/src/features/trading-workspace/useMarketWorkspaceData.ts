import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { fetchMarketWorkspace } from '../../api/marketData'

const keyRoot = ['marketWorkspace'] as const

export function useMarketWorkspaceData(accountId: string, selectedInstrument: string, date: string, active = true) {
  const { isAuthenticated, user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => [...keyRoot, user?.id, accountId, selectedInstrument, date], [accountId, date, selectedInstrument, user?.id])
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchMarketWorkspace(accountId, selectedInstrument, date, signal),
    enabled: active && isAuthenticated && Boolean(user?.id && accountId),
    staleTime: 500,
    refetchInterval: () => typeof document !== 'undefined' && document.visibilityState === 'visible' ? 2000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    retry: false
  })
  const { refetch } = query

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      void queryClient.removeQueries({ queryKey: [...keyRoot] })
      return
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void queryClient.cancelQueries({ queryKey })
      } else if (accountId) {
        void refetch()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void queryClient.cancelQueries({ queryKey })
    }
  }, [accountId, isAuthenticated, queryClient, refetch, queryKey, user?.id])

  return query
}

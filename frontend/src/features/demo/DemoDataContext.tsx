import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DemoRemovalResponse, DemoStatusResponse, fetchDemoStatus, removeDemoData as removeDemoDataApi } from '../../api/demo'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'

const EMPTY_STATUS: DemoStatusResponse = {
  demoEnabled: false,
  hasDemoData: false
}

type DemoDataContextType = {
  demoEnabled: boolean
  hasDemoData: boolean
  loading: boolean
  removing: boolean
  refreshToken: number
  refreshStatus: () => Promise<void>
  removeDemoData: () => Promise<DemoRemovalResponse>
}

const defaultContext: DemoDataContextType = {
  demoEnabled: false,
  hasDemoData: false,
  loading: false,
  removing: false,
  refreshToken: 0,
  refreshStatus: async () => {},
  removeDemoData: async () => ({ demoEnabled: false })
}

const DemoDataContext = createContext<DemoDataContextType>(defaultContext)

export function DemoDataProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, initializing, user } = useAuth()
  const [status, setStatus] = useState<DemoStatusResponse>(EMPTY_STATUS)
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setStatus(EMPTY_STATUS)
      return
    }

    setLoading(true)
    try {
      const nextStatus = await fetchDemoStatus()
      setStatus(nextStatus)
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setStatus(EMPTY_STATUS)
        return
      }
      throw error
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const removeDemoData = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('Authentication required')
    }

    setRemoving(true)
    try {
      const response = await removeDemoDataApi()
      setStatus({ demoEnabled: false, hasDemoData: false })
      setRefreshToken((prev) => prev + 1)
      return response
    } finally {
      setRemoving(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (initializing) {
      return
    }

    if (!isAuthenticated) {
      setStatus(EMPTY_STATUS)
      setLoading(false)
      return
    }

    refreshStatus().catch(() => {
      setStatus(EMPTY_STATUS)
    })
  }, [initializing, isAuthenticated, user?.id, refreshStatus])

  const value = useMemo<DemoDataContextType>(() => ({
    demoEnabled: status.demoEnabled,
    hasDemoData: status.hasDemoData,
    loading,
    removing,
    refreshToken,
    refreshStatus,
    removeDemoData
  }), [status.demoEnabled, status.hasDemoData, loading, removing, refreshToken, refreshStatus, removeDemoData])

  return (
    <DemoDataContext.Provider value={value}>
      {children}
    </DemoDataContext.Provider>
  )
}

export function useDemoData() {
  return useContext(DemoDataContext)
}

import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { Alert, Button, Snackbar } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import {
  NotificationCreatedStreamPayload,
  getUnreadNotificationCount,
  openNotificationsStream
} from '../../api/notifications'
import { useI18n } from '../../i18n'

type StreamMode = 'idle' | 'sse' | 'polling'

type NotificationsContextType = {
  unreadCount: number
  streamMode: StreamMode
  lastNotificationTick: number
  refreshUnreadCount: () => Promise<void>
  setUnreadCount: Dispatch<SetStateAction<number>>
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

const POLL_INTERVAL_MS = 45_000
const RECONNECT_DELAY_MS = 15_000

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth()
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [streamMode, setStreamMode] = useState<StreamMode>('idle')
  const [lastNotificationTick, setLastNotificationTick] = useState(0)
  const [toast, setToast] = useState<NotificationCreatedStreamPayload | null>(null)

  const streamAbortRef = useRef<AbortController | null>(null)
  const pollIntervalRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const disconnectStream = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
    }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      return
    }
    try {
      const response = await getUnreadNotificationCount()
      setUnreadCount(Math.max(0, response.unreadCount || 0))
    } catch {
      // no-op: fallback polling/stream reconnect will retry
    }
  }, [isAuthenticated])

  const startPollingFallback = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      return
    }
    setStreamMode('polling')
    pollIntervalRef.current = window.setInterval(() => {
      void refreshUnreadCount()
    }, POLL_INTERVAL_MS)
  }, [refreshUnreadCount])

  const parseEventBlock = useCallback((block: string): { event: string; data: string } | null => {
    const lines = block
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.trim().length > 0 && !line.startsWith(':'))
    if (lines.length === 0) {
      return null
    }

    let eventName = 'message'
    const dataLines: string[] = []

    lines.forEach((line) => {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
        return
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    })

    return { event: eventName, data: dataLines.join('\n') }
  }, [])

  const handleStreamEvent = useCallback((eventName: string, data: string) => {
    if (!data) {
      return
    }
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>
      if (eventName === 'unread_count') {
        const nextUnread = typeof parsed.unreadCount === 'number' ? parsed.unreadCount : 0
        setUnreadCount(Math.max(0, nextUnread))
        return
      }
      if (eventName === 'notification_created') {
        const payload = parsed as unknown as NotificationCreatedStreamPayload
        setLastNotificationTick((value) => value + 1)
        setToast(payload)
      }
    } catch {
      // Ignore malformed payloads from stream and keep the connection alive.
    }
  }, [])

  const consumeStream = useCallback(async (response: Response, signal: AbortSignal) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Notification stream body is missing')
    }
    const decoder = new TextDecoder()
    let buffer = ''

    while (!signal.aborted) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')

      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex >= 0) {
        const block = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        const parsedBlock = parseEventBlock(block)
        if (parsedBlock) {
          handleStreamEvent(parsedBlock.event, parsedBlock.data)
        }
        separatorIndex = buffer.indexOf('\n\n')
      }
    }
  }, [handleStreamEvent, parseEventBlock])

  const connectStream = useCallback(async () => {
    if (!isAuthenticated) {
      return
    }

    clearReconnectTimer()
    disconnectStream()
    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      const response = await openNotificationsStream(controller.signal)
      if (!response.ok) {
        throw new Error(`Notification stream failed with status ${response.status}`)
      }
      setStreamMode('sse')
      clearPolling()
      await consumeStream(response, controller.signal)
      if (!controller.signal.aborted) {
        throw new Error('Notification stream closed')
      }
    } catch {
      if (controller.signal.aborted || !isAuthenticated) {
        return
      }
      startPollingFallback()
      reconnectTimerRef.current = window.setTimeout(() => {
        void connectStream()
      }, RECONNECT_DELAY_MS)
    }
  }, [
    clearPolling,
    clearReconnectTimer,
    consumeStream,
    disconnectStream,
    isAuthenticated,
    startPollingFallback
  ])

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0)
      setStreamMode('idle')
      clearReconnectTimer()
      clearPolling()
      disconnectStream()
      return
    }

    void refreshUnreadCount()
    void connectStream()

    return () => {
      clearReconnectTimer()
      clearPolling()
      disconnectStream()
    }
  }, [clearPolling, clearReconnectTimer, connectStream, disconnectStream, isAuthenticated, refreshUnreadCount])

  const toastTitle = useMemo(() => {
    if (!toast) {
      return ''
    }
    const resolvedTitle = language === 'ro'
      ? (toast.titleRo || toast.titleEn || '')
      : (toast.titleEn || toast.titleRo || '')
    if (toast.eventType === 'CONTENT_UPDATED') {
      return t('notifications.toast.updated', { title: resolvedTitle })
    }
    return t('notifications.toast.published', { title: resolvedTitle })
  }, [language, t, toast])

  const handleToastView = () => {
    if (!toast?.slug) {
      setToast(null)
      return
    }
    navigate(`/insights/${toast.slug}`)
    setToast(null)
  }

  const contextValue = useMemo<NotificationsContextType>(() => ({
    unreadCount,
    streamMode,
    lastNotificationTick,
    refreshUnreadCount,
    setUnreadCount
  }), [lastNotificationTick, refreshUnreadCount, streamMode, unreadCount])

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={() => setToast(null)}
          action={toast?.slug ? (
            <Button color="inherit" size="small" onClick={handleToastView}>
              {t('notifications.toast.view')}
            </Button>
          ) : undefined}
        >
          {toastTitle}
        </Alert>
      </Snackbar>
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}

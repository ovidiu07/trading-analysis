import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import {
  Badge,
  Box,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  NotificationFeedFilter,
  UserNotificationItem,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../../api/notifications'
import { useI18n } from '../../i18n'
import { formatRelativeTime } from '../../utils/format'
import { useNotifications } from '../../features/notifications/NotificationsContext'

const DEFAULT_LIMIT = 20

const isUnread = (item: UserNotificationItem) => !item.readAt

export default function NotificationBell() {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const {
    unreadCount,
    streamMode,
    lastNotificationTick,
    refreshUnreadCount,
    setUnreadCount
  } = useNotifications()

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [activeTab, setActiveTab] = useState<NotificationFeedFilter>('unread')
  const [items, setItems] = useState<UserNotificationItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const open = Boolean(anchorEl)

  const localizedEventLabel = useCallback((item: UserNotificationItem) => (
    item.event.type === 'CONTENT_UPDATED'
      ? t('notifications.labels.updated')
      : t('notifications.labels.new')
  ), [t])

  const localizedTitle = useCallback((item: UserNotificationItem) => {
    const title = language === 'ro'
      ? (item.event.titleRo || item.event.titleEn)
      : (item.event.titleEn || item.event.titleRo)
    return title || t('notifications.untitled')
  }, [language, t])

  const localizedSummary = useCallback((item: UserNotificationItem) => {
    const summary = language === 'ro'
      ? (item.event.summaryRo || item.event.summaryEn)
      : (item.event.summaryEn || item.event.summaryRo)
    return summary || ''
  }, [language])

  const fetchNotifications = useCallback(async (cursor?: string, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError('')
    }
    try {
      const response = await listNotifications({
        filter: activeTab,
        limit: DEFAULT_LIMIT,
        cursor
      })
      setItems((prev) => append ? [...prev, ...response.items] : response.items)
      setNextCursor(response.nextCursor || null)
    } catch {
      if (!append) {
        setError(t('notifications.errors.load'))
      }
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [activeTab, t])

  useEffect(() => {
    if (!open) {
      return
    }
    void fetchNotifications()
  }, [fetchNotifications, lastNotificationTick, open])

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
    void refreshUnreadCount()
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleMarkAllRead = async () => {
    try {
      const response = await markAllNotificationsRead()
      setUnreadCount(Math.max(0, response.unreadCount))
      setItems((prev) => prev.map((item) => (
        isUnread(item) ? { ...item, readAt: new Date().toISOString() } : item
      )))
      if (activeTab === 'unread') {
        setItems([])
      }
      setError('')
    } catch {
      setError(t('notifications.errors.markAll'))
      void refreshUnreadCount()
    }
  }

  const handleItemClick = (item: UserNotificationItem) => {
    const targetId = item.event.slug || item.event.contentId
    const wasUnread = isUnread(item)

    if (wasUnread) {
      const nowIso = new Date().toISOString()
      setItems((prev) => prev.map((entry) => (
        entry.id === item.id ? { ...entry, readAt: nowIso } : entry
      )))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    void markNotificationRead(item.id)
      .then((response) => {
        setUnreadCount(Math.max(0, response.unreadCount))
      })
      .catch(() => {
        void refreshUnreadCount()
      })

    if (targetId) {
      navigate(`/insights/${targetId}`)
    }
    handleClose()
  }

  const emptyText = useMemo(() => (
    activeTab === 'unread'
      ? t('notifications.empty.unread')
      : t('notifications.empty.all')
  ), [activeTab, t])

  return (
    <>
      <IconButton
        aria-label={t('notifications.title')}
        onClick={handleOpen}
        sx={{ width: 44, height: 44 }}
      >
        <Badge
          color="error"
          badgeContent={unreadCount > 99 ? '99+' : unreadCount}
          invisible={unreadCount <= 0}
        >
          <NotificationsNoneOutlinedIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: 'calc(100vw - 24px)', sm: 420 },
              maxHeight: 520,
              overflow: 'hidden',
              mt: 1
            }
          }
        }}
      >
        <Stack sx={{ height: '100%' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t('notifications.title')}
            </Typography>
            <Button
              size="small"
              onClick={handleMarkAllRead}
              disabled={unreadCount <= 0 || loading}
            >
              {t('notifications.markAllRead')}
            </Button>
          </Stack>

          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            sx={{ px: 1 }}
          >
            <Tab value="unread" label={t('notifications.tabs.unread')} />
            <Tab value="all" label={t('notifications.tabs.all')} />
          </Tabs>

          {streamMode === 'polling' && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1 }}>
              {t('notifications.status.polling')}
            </Typography>
          )}

          <Box sx={{ overflowY: 'auto', maxHeight: 420 }}>
            {loading ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {t('common.loading')}
              </Typography>
            ) : error ? (
              <Typography variant="body2" color="error.main" sx={{ p: 2 }}>
                {error}
              </Typography>
            ) : items.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {emptyText}
              </Typography>
            ) : (
              <List disablePadding>
                {items.map((item) => (
                  <ListItemButton
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    sx={{
                      alignItems: 'flex-start',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      bgcolor: isUnread(item) ? 'action.hover' : 'transparent'
                    }}
                  >
                    <ListItemText
                      primary={(
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                            {localizedTitle(item)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {formatRelativeTime(item.createdAt)}
                          </Typography>
                        </Stack>
                      )}
                      secondary={(
                        <Stack spacing={0.5} sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                            {localizedEventLabel(item)}
                          </Typography>
                          {localizedSummary(item) && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {localizedSummary(item)}
                            </Typography>
                          )}
                        </Stack>
                      )}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}

            {nextCursor && (
              <Box sx={{ p: 1.5 }}>
                <Button
                  size="small"
                  fullWidth
                  onClick={() => void fetchNotifications(nextCursor, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? t('common.loading') : t('notifications.actions.loadMore')}
                </Button>
              </Box>
            )}
          </Box>
        </Stack>
      </Popover>
    </>
  )
}

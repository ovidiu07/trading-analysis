import { apiGet, apiPost, apiPut } from './client'
import { getCurrentLanguage } from '../i18n'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export type NotificationEventType = 'CONTENT_PUBLISHED' | 'CONTENT_UPDATED'
export type NotificationFeedFilter = 'all' | 'unread'

export type NotificationEventSummary = {
  type: NotificationEventType
  effectiveAt: string
  contentId: string
  categoryId: string
  slug?: string | null
  titleEn?: string | null
  titleRo?: string | null
  summaryEn?: string | null
  summaryRo?: string | null
}

export type UserNotificationItem = {
  id: string
  createdAt: string
  readAt?: string | null
  clickedAt?: string | null
  dismissedAt?: string | null
  event: NotificationEventSummary
}

export type NotificationFeedResponse = {
  items: UserNotificationItem[]
  nextCursor?: string | null
}

export type NotificationUnreadCountResponse = {
  unreadCount: number
}

export type NotificationMode = 'ALL' | 'SELECTED'
export type NotificationMatchPolicy = 'CATEGORY_ONLY' | 'CATEGORY_OR_TAGS_OR_SYMBOLS'

export type NotificationPreferences = {
  enabled: boolean
  notifyOnNew: boolean
  notifyOnUpdates: boolean
  mode: NotificationMode
  categories: string[]
  tags?: string[]
  symbols?: string[]
  matchPolicy?: NotificationMatchPolicy
}

export type NotificationPreferencesUpdatePayload = NotificationPreferences

export type NotificationCreatedStreamPayload = {
  notificationId: string
  eventType: NotificationEventType
  slug?: string | null
  titleEn?: string | null
  titleRo?: string | null
  createdAt: string
}

type QueryParams = Record<string, string | number | boolean | undefined | null>

const toQuery = (params: QueryParams = {}) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function listNotifications(params: {
  filter?: NotificationFeedFilter
  limit?: number
  cursor?: string
} = {}) {
  return apiGet<NotificationFeedResponse>(`/notifications${toQuery(params)}`)
}

export async function getUnreadNotificationCount() {
  return apiGet<NotificationUnreadCountResponse>('/notifications/unread-count')
}

export async function markNotificationRead(notificationId: string) {
  return apiPost<NotificationUnreadCountResponse>(`/notifications/${notificationId}/read`, {})
}

export async function markAllNotificationsRead() {
  return apiPost<NotificationUnreadCountResponse>('/notifications/read-all', {})
}

export async function getNotificationPreferences() {
  return apiGet<NotificationPreferences>('/notification-preferences')
}

export async function updateNotificationPreferences(payload: NotificationPreferencesUpdatePayload) {
  return apiPut<NotificationPreferences>('/notification-preferences', payload)
}

export async function openNotificationsStream(signal: AbortSignal) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_URL}/notifications/stream`, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      'Accept-Language': getCurrentLanguage(),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: 'include',
    signal
  })
  return response
}

import { apiDelete, apiGet, apiPost, apiPut } from './client'

export type ContentPostType = 'STRATEGY' | 'WEEKLY_PLAN'
export type ContentPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type ContentPost = {
  id: string
  type: ContentPostType
  title: string
  slug?: string | null
  summary?: string | null
  body: string
  status: ContentPostStatus
  tags?: string[]
  symbols?: string[]
  visibleFrom?: string | null
  visibleUntil?: string | null
  weekStart?: string | null
  weekEnd?: string | null
  createdBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  publishedAt?: string | null
}

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type ContentPostRequest = {
  type: ContentPostType
  title: string
  slug?: string | null
  summary?: string | null
  body: string
  tags?: string[]
  symbols?: string[]
  visibleFrom?: string | null
  visibleUntil?: string | null
  weekStart?: string | null
  weekEnd?: string | null
}

type QueryParams = Record<string, string | number | boolean | undefined | null>

const toQuery = (params: QueryParams = {}) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, String(value))
    }
  })
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function listPublishedContent(params: { type?: ContentPostType; q?: string; activeOnly?: boolean } = {}) {
  return apiGet<ContentPost[]>(`/content${toQuery(params)}`)
}

export async function getContent(idOrSlug: string) {
  return apiGet<ContentPost>(`/content/${idOrSlug}`)
}

export async function listAdminContent(params: { page?: number; size?: number; type?: ContentPostType; status?: ContentPostStatus; q?: string } = {}) {
  return apiGet<PageResponse<ContentPost>>(`/admin/content${toQuery(params)}`)
}

export async function createContentDraft(payload: ContentPostRequest) {
  return apiPost<ContentPost>('/admin/content', payload)
}

export async function updateContent(id: string, payload: ContentPostRequest) {
  return apiPut<ContentPost>(`/admin/content/${id}`, payload)
}

export async function publishContent(id: string) {
  return apiPost<ContentPost>(`/admin/content/${id}/publish`, {})
}

export async function archiveContent(id: string) {
  return apiPost<ContentPost>(`/admin/content/${id}/archive`, {})
}

export async function deleteContent(id: string) {
  return apiDelete(`/admin/content/${id}`)
}

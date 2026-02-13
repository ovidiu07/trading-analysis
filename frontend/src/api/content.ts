import { apiDelete, apiGet, apiPost, apiPut } from './client'
import type { AssetItem } from './assets'

export type ContentPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type LocalizedContent = {
  title: string
  summary?: string | null
  body: string
}

export type LocalizedContentType = {
  displayName: string
  description?: string | null
}

export type ContentType = {
  id: string
  key: string
  sortOrder: number
  active: boolean
  displayName: string
  description?: string | null
  locale?: string
  resolvedLocale?: string
  translations?: Record<string, LocalizedContentType> | null
  missingLocales?: string[]
}

export type ContentTypeRequest = {
  key: string
  active: boolean
  sortOrder: number
  translations: Record<string, LocalizedContentType>
}

export type ContentPost = {
  id: string
  contentTypeId: string
  contentTypeKey: string
  contentTypeDisplayName: string
  title: string
  slug?: string | null
  summary?: string | null
  body: string
  locale?: string
  resolvedLocale?: string
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
  assets?: AssetItem[]
  translations?: Record<string, LocalizedContent> | null
  missingLocales?: string[]
}

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type ContentPostRequest = {
  contentTypeId: string
  slug?: string | null
  tags?: string[]
  symbols?: string[]
  visibleFrom?: string | null
  visibleUntil?: string | null
  weekStart?: string | null
  weekEnd?: string | null
  notifySubscribersAboutUpdate?: boolean
  translations: Record<string, LocalizedContent>
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

export async function listContentTypes() {
  return apiGet<ContentType[]>('/content-types')
}

export async function listContentCategories() {
  return apiGet<ContentType[]>('/content-categories')
}

export async function listAdminContentTypes(params: { includeInactive?: boolean } = {}) {
  return apiGet<ContentType[]>(`/admin/content-types${toQuery(params)}`)
}

export async function getAdminContentType(id: string) {
  return apiGet<ContentType>(`/admin/content-types/${id}`)
}

export async function createContentType(payload: ContentTypeRequest) {
  return apiPost<ContentType>('/admin/content-types', payload)
}

export async function updateContentType(id: string, payload: ContentTypeRequest) {
  return apiPut<ContentType>(`/admin/content-types/${id}`, payload)
}

export async function listPublishedContent(params: { type?: string; q?: string; activeOnly?: boolean } = {}) {
  return apiGet<ContentPost[]>(`/content${toQuery(params)}`)
}

export async function getContent(idOrSlug: string) {
  return apiGet<ContentPost>(`/content/${idOrSlug}`)
}

export async function getAdminContent(id: string) {
  return apiGet<ContentPost>(`/admin/content/${id}`)
}

export async function listAdminContent(params: {
  page?: number
  size?: number
  contentTypeId?: string
  status?: ContentPostStatus
  q?: string
} = {}) {
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

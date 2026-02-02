import { ApiError, apiDelete, apiGet, apiPatch, apiPost, clearAuthToken } from './client'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export type NotebookFolder = {
  id: string
  name: string
  parentId?: string | null
  sortOrder?: number | null
  systemKey?: string | null
  createdAt?: string
  updatedAt?: string
}

export type NotebookNoteType = 'DAILY_LOG' | 'TRADE_NOTE' | 'PLAN' | 'GOAL' | 'SESSION_RECAP' | 'NOTE'

export type NotebookNote = {
  id: string
  type: NotebookNoteType
  folderId?: string | null
  title?: string | null
  body?: string | null
  bodyJson?: string | null
  dateKey?: string | null
  relatedTradeId?: string | null
  isDeleted?: boolean
  isPinned?: boolean
  createdAt?: string
  updatedAt?: string
  tagIds?: string[]
}

export type NotebookNoteSummary = {
  id: string
  title: string
  type: NotebookNoteType
  journalDate: string
  createdAt?: string
}

export type NotebookTag = {
  id: string
  name: string
  color?: string | null
}

export type NotebookAttachment = {
  id: string
  noteId: string
  fileName: string
  mimeType?: string
  sizeBytes?: number
  downloadUrl?: string
  createdAt?: string
}

export type NotebookTemplate = {
  id: string
  name: string
  appliesToType?: NotebookNoteType | null
  content?: string | null
  createdAt?: string
  updatedAt?: string
}

export type DailySummary = {
  date: string
  netPnl: number
  tradeCount: number
  winners: number
  losers: number
  winRate: number
  equityPoints?: number[]
}

export async function listNotebookFolders(): Promise<NotebookFolder[]> {
  return apiGet('/notebook/folders')
}

export async function createNotebookFolder(payload: { name: string; parentId?: string | null }): Promise<NotebookFolder> {
  return apiPost('/notebook/folders', payload)
}

export async function updateNotebookFolder(id: string, payload: { name?: string; parentId?: string | null; sortOrder?: number }): Promise<NotebookFolder> {
  return apiPatch(`/notebook/folders/${id}`, payload)
}

export async function deleteNotebookFolder(id: string): Promise<void> {
  return apiDelete(`/notebook/folders/${id}`)
}

export async function listNotebookNotes(params: {
  folderId?: string
  type?: NotebookNoteType
  q?: string
  tagIds?: string[]
  from?: string
  to?: string
  sort?: string
}): Promise<NotebookNote[]> {
  const searchParams = new URLSearchParams()
  if (params.folderId) searchParams.append('folderId', params.folderId)
  if (params.type) searchParams.append('type', params.type)
  if (params.q) searchParams.append('q', params.q)
  if (params.from) searchParams.append('from', params.from)
  if (params.to) searchParams.append('to', params.to)
  if (params.sort) searchParams.append('sort', params.sort)
  if (params.tagIds && params.tagIds.length > 0) {
    params.tagIds.forEach((id) => searchParams.append('tagIds', id))
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiGet(`/notebook/notes${suffix}`)
}

export async function listNotebookNotesByDate(from: string, to: string): Promise<NotebookNoteSummary[]> {
  const searchParams = new URLSearchParams({ from, to })
  return apiGet(`/notebook/notes/by-date?${searchParams.toString()}`)
}

export async function getNotebookNote(id: string): Promise<NotebookNote> {
  return apiGet(`/notebook/notes/${id}`)
}

export async function createNotebookNote(payload: Partial<NotebookNote>): Promise<NotebookNote> {
  return apiPost('/notebook/notes', payload)
}

export async function updateNotebookNote(id: string, payload: Partial<NotebookNote>): Promise<NotebookNote> {
  return apiPatch(`/notebook/notes/${id}`, payload)
}

export async function deleteNotebookNote(id: string): Promise<void> {
  return apiDelete(`/notebook/notes/${id}`)
}

export async function restoreNotebookNote(id: string): Promise<NotebookNote> {
  return apiPost(`/notebook/notes/${id}/restore`, {})
}

export async function replaceNotebookNoteTags(id: string, tagIds: string[]): Promise<NotebookNote> {
  return apiPost(`/notebook/notes/${id}/tags`, tagIds)
}

export async function listNotebookTags(): Promise<NotebookTag[]> {
  return apiGet('/notebook/tags')
}

export async function createNotebookTag(payload: { name: string; color?: string | null }): Promise<NotebookTag> {
  return apiPost('/notebook/tags', payload)
}

export async function deleteNotebookTag(id: string): Promise<void> {
  return apiDelete(`/notebook/tags/${id}`)
}

export async function listNotebookAttachments(noteId: string): Promise<NotebookAttachment[]> {
  return apiGet(`/notebook/attachments?noteId=${noteId}`)
}

export async function uploadNotebookAttachment(noteId: string, file: File): Promise<NotebookAttachment> {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('noteId', noteId)
  formData.append('file', file)
  const res = await fetch(`${API_URL}/notebook/attachments`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401 || res.status === 403) {
      clearAuthToken()
    }
    const error = new ApiError(text || 'Failed to upload attachment')
    error.status = res.status
    throw error
  }
  return res.json()
}

export async function deleteNotebookAttachment(id: string): Promise<void> {
  return apiDelete(`/notebook/attachments/${id}`)
}

export async function listNotebookTemplates(type?: NotebookNoteType): Promise<NotebookTemplate[]> {
  const suffix = type ? `?type=${type}` : ''
  return apiGet(`/notebook/templates${suffix}`)
}

export async function createNotebookTemplate(payload: { name: string; appliesToType?: NotebookNoteType | null; content?: string | null }): Promise<NotebookTemplate> {
  return apiPost('/notebook/templates', payload)
}

export async function updateNotebookTemplate(id: string, payload: { name?: string; appliesToType?: NotebookNoteType | null; content?: string | null }): Promise<NotebookTemplate> {
  return apiPatch(`/notebook/templates/${id}`, payload)
}

export async function deleteNotebookTemplate(id: string): Promise<void> {
  return apiDelete(`/notebook/templates/${id}`)
}

export async function fetchDailySummary(date: string, tz?: string): Promise<DailySummary> {
  const params = new URLSearchParams({ date })
  if (tz) params.append('tz', tz)
  return apiGet(`/trades/daily-summary?${params.toString()}`)
}

export async function listClosedTrades(date: string, tz?: string) {
  const params = new URLSearchParams({ date })
  if (tz) params.append('tz', tz)
  return apiGet(`/trades/closed-day?${params.toString()}`)
}

export async function listLosses(from: string, to: string, tz?: string, minLoss?: number) {
  const params = new URLSearchParams({ from, to })
  if (tz) params.append('tz', tz)
  if (typeof minLoss === 'number') params.append('minLoss', `${minLoss}`)
  return apiGet(`/trades/losses?${params.toString()}`)
}

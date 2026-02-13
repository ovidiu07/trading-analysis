import { apiDelete, apiGet, apiPatch, apiPost } from './client'
import { deleteAsset, listNotebookAssets, uploadAsset, type AssetItem } from './assets'

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
  clearFolder?: boolean
  title?: string | null
  body?: string | null
  bodyJson?: string | null
  reviewJson?: string | null
  clearReview?: boolean
  dateKey?: string | null
  clearDateKey?: boolean
  relatedTradeId?: string | null
  clearRelatedTrade?: boolean
  hasAttachments?: boolean
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
  url?: string
  downloadUrl?: string
  viewUrl?: string
  thumbnailUrl?: string
  image?: boolean
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
  const assets = await listNotebookAssets(noteId)
  return assets.map(toNotebookAttachment)
}

export async function uploadNotebookAttachment(noteId: string, file: File, onProgress?: (progress: number) => void): Promise<NotebookAttachment> {
  const asset = await uploadAsset({
    file,
    scope: 'NOTEBOOK',
    noteId,
    onProgress
  })
  return toNotebookAttachment(asset)
}

export async function deleteNotebookAttachment(id: string): Promise<void> {
  return deleteAsset(id)
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

const toNotebookAttachment = (asset: AssetItem): NotebookAttachment => ({
  id: asset.id,
  noteId: asset.noteId || '',
  fileName: asset.originalFileName,
  mimeType: asset.contentType || undefined,
  sizeBytes: asset.sizeBytes ?? undefined,
  url: asset.url || undefined,
  downloadUrl: asset.downloadUrl || undefined,
  viewUrl: asset.viewUrl || undefined,
  thumbnailUrl: asset.thumbnailUrl || undefined,
  image: Boolean(asset.image),
  createdAt: asset.createdAt || undefined
})

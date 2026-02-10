import { ApiError, apiDelete, apiGet, clearAuthToken } from './client'
import { getCurrentLanguage } from '../i18n'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export type AssetScope = 'CONTENT' | 'NOTEBOOK'

export const MAX_UPLOAD_SIZE_MB = 20
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])

export type AssetItem = {
  id: string
  scope: AssetScope
  contentId?: string | null
  noteId?: string | null
  originalFileName: string
  contentType?: string | null
  sizeBytes?: number | null
  url?: string | null
  downloadUrl?: string | null
  viewUrl?: string | null
  thumbnailUrl?: string | null
  image?: boolean
  createdAt?: string | null
  metadata?: Record<string, unknown>
}

type UploadAssetParams = {
  file: File
  scope: AssetScope
  contentId?: string
  noteId?: string
  sortOrder?: number
  onProgress?: (progress: number) => void
}

const authHeader = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value)

export const resolveAssetUrl = (value?: string | null) => {
  if (!value) return ''
  if (isAbsoluteUrl(value)) return value
  if (!value.startsWith('/')) return value
  if (!isAbsoluteUrl(API_URL)) return value
  try {
    const origin = new URL(API_URL).origin
    return `${origin}${value}`
  } catch {
    return value
  }
}

export const isProtectedApiUrl = (value?: string | null) => {
  if (!value) return false
  if (isAbsoluteUrl(value)) return false
  return value.startsWith('/api/')
}

export async function listContentAssets(contentId: string) {
  return apiGet<AssetItem[]>(`/assets/content/${contentId}`)
}

export async function listNotebookAssets(noteId: string) {
  return apiGet<AssetItem[]>(`/assets/notebook/${noteId}`)
}

export async function deleteAsset(assetId: string) {
  return apiDelete(`/assets/${assetId}`)
}

export function uploadAsset(params: UploadAssetParams): Promise<AssetItem> {
  const { file, scope, contentId, noteId, sortOrder, onProgress } = params

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('scope', scope)
    if (contentId) formData.append('contentId', contentId)
    if (noteId) formData.append('noteId', noteId)
    if (typeof sortOrder === 'number') formData.append('sortOrder', `${sortOrder}`)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/assets/upload`)
    xhr.withCredentials = true
    xhr.responseType = 'json'

    const token = localStorage.getItem('token')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    xhr.setRequestHeader('Accept-Language', getCurrentLanguage())

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return
      const progress = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)))
      onProgress(progress)
    }

    xhr.onerror = () => {
      const error = new ApiError('Network request failed')
      error.code = 'NETWORK_ERROR'
      reject(error)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const payload = xhr.response ?? JSON.parse(xhr.responseText || '{}')
        onProgress?.(100)
        resolve(payload as AssetItem)
        return
      }

      if (xhr.status === 401 || xhr.status === 403) {
        clearAuthToken()
      }

      let errorMessage = xhr.responseText || 'Upload failed'
      let errorCode: string | undefined
      try {
        const parsed = JSON.parse(xhr.responseText)
        errorMessage = parsed?.message || parsed?.error || errorMessage
        errorCode = parsed?.error
      } catch {
        // ignore parse failures
      }
      const error = new ApiError(errorMessage || 'Upload failed')
      error.status = xhr.status
      error.code = errorCode
      reject(error)
    }

    xhr.send(formData)
  })
}

export async function fetchAssetBlob(url: string): Promise<Blob> {
  const resolvedUrl = resolveAssetUrl(url)
  let response: Response
  try {
    response = await fetch(resolvedUrl, {
      method: 'GET',
      headers: {
        ...authHeader(),
        'Accept-Language': getCurrentLanguage()
      },
      credentials: 'include'
    })
  } catch {
    const error = new ApiError('Network request failed')
    error.code = 'NETWORK_ERROR'
    throw error
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearAuthToken()
    }
    const text = await response.text()
    const error = new ApiError(text || 'Could not fetch asset')
    error.status = response.status
    throw error
  }

  return response.blob()
}

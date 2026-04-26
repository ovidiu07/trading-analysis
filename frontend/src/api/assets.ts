import { ApiError, apiDelete, apiGet, clearAuthToken } from './client'
import { getCurrentLanguage } from '../i18n'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export type AssetScope = 'CONTENT' | 'NOTEBOOK' | 'STRATEGY' | 'TRADE' | 'PLAN'

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

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

export type AssetItem = {
  id: string
  scope: AssetScope
  contentId?: string | null
  noteId?: string | null
  strategyId?: string | null
  tradeId?: string | null
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
  strategyId?: string
  tradeId?: string
  sortOrder?: number
  onProgress?: (progress: number) => void
}

const authHeader = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value)
const API_ORIGIN = (() => {
  if (!isAbsoluteUrl(API_URL)) {
    return null
  }
  try {
    return new URL(API_URL).origin
  } catch {
    return null
  }
})()

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

export const toAssetMarkdownUrl = (value?: string | null) => {
  if (!value) return ''
  if (!isAbsoluteUrl(value)) return value

  try {
    const parsed = new URL(value)
    const sameApiOrigin = API_ORIGIN ? parsed.origin === API_ORIGIN : false
    const sameWindowOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin
    if ((sameApiOrigin || sameWindowOrigin) && parsed.pathname.startsWith('/api/assets/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  } catch {
    return value
  }

  return value
}

export const isProtectedApiUrl = (value?: string | null) => {
  if (!value) return false

  if (!isAbsoluteUrl(value)) {
    return value.startsWith('/api/')
  }

  try {
    const parsed = new URL(value)
    if (!parsed.pathname.startsWith('/api/')) {
      return false
    }

    if (API_ORIGIN) {
      return parsed.origin === API_ORIGIN
    }

    if (typeof window !== 'undefined') {
      return parsed.origin === window.location.origin
    }
  } catch {
    return false
  }

  return false
}

export async function listContentAssets(contentId: string) {
  return apiGet<AssetItem[]>(`/assets/content/${contentId}`)
}

export async function listNotebookAssets(noteId: string) {
  return apiGet<AssetItem[]>(`/assets/notebook/${noteId}`)
}

export async function listStrategyAssets(strategyId: string) {
  return apiGet<AssetItem[]>(`/assets/strategy/${strategyId}`)
}

export async function listTradeAssets(tradeId: string) {
  return apiGet<AssetItem[]>(`/assets/trade/${tradeId}`)
}

export async function deleteAsset(assetId: string) {
  return apiDelete(`/assets/${assetId}`)
}

const canReadXhrResponseText = (xhr: XMLHttpRequest) => xhr.responseType === '' || xhr.responseType === 'text'

const readXhrResponseText = (xhr: XMLHttpRequest) => (canReadXhrResponseText(xhr) ? xhr.responseText || '' : '')

const parseXhrJsonPayload = <T>(xhr: XMLHttpRequest): T | null => {
  const response = xhr.response

  if (response && typeof response === 'object') {
    return response as T
  }

  if (typeof response === 'string' && response.trim()) {
    try {
      return JSON.parse(response) as T
    } catch {
      return null
    }
  }

  const rawText = readXhrResponseText(xhr)
  if (!rawText.trim()) {
    return null
  }

  try {
    return JSON.parse(rawText) as T
  } catch {
    return null
  }
}

const buildUploadError = (xhr: XMLHttpRequest) => {
  const parsed = parseXhrJsonPayload<{ message?: string; error?: string; details?: unknown }>(xhr)
  const rawText = readXhrResponseText(xhr)
  const statusLabel = xhr.status ? `${xhr.status} ${xhr.statusText}`.trim() : ''
  const message = parsed?.message || parsed?.error || rawText || statusLabel || 'Upload failed'

  const error = new ApiError(message)
  error.status = xhr.status
  error.code = parsed?.error
  error.details = parsed?.details
  error.rawMessage = message
  return error
}

export function uploadAsset(params: UploadAssetParams): Promise<AssetItem> {
  const { file, scope, contentId, noteId, strategyId, tradeId, sortOrder, onProgress } = params

  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('scope', scope)
    if (contentId) formData.append('contentId', contentId)
    if (noteId) formData.append('noteId', noteId)
    if (strategyId) formData.append('strategyId', strategyId)
    if (tradeId) formData.append('tradeId', tradeId)
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

    xhr.onabort = () => {
      const error = new ApiError('Upload cancelled')
      error.code = 'ABORTED'
      reject(error)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const payload = parseXhrJsonPayload<AssetItem>(xhr)
        if (!payload) {
          const error = new ApiError('Upload completed but the response was invalid')
          error.status = xhr.status
          error.code = 'INVALID_RESPONSE'
          reject(error)
          return
        }
        onProgress?.(100)
        resolve(payload)
        return
      }

      if (xhr.status === 401 || xhr.status === 403) {
        clearAuthToken()
      }

      reject(buildUploadError(xhr))
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

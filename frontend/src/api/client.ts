const API_URL = import.meta.env.VITE_API_URL || '/api'
import { getCurrentLanguage } from '../i18n'
const SKIP_AUTH_REFRESH_HEADER = 'X-Skip-Auth-Refresh'
let refreshInFlight: Promise<boolean> | null = null

export class ApiError extends Error {
  status?: number
  code?: string
  details?: unknown
  rawMessage?: string
}

function authHeader() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function localeHeader() {
  return { 'Accept-Language': getCurrentLanguage() }
}

function toHeadersObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...headers }
}

const isAuthPath = (path: string) => path.startsWith('/auth/')

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...localeHeader(),
          [SKIP_AUTH_REFRESH_HEADER]: '1'
        },
        credentials: 'include'
      })
      if (!res.ok) {
        return false
      }
      const text = await readResponseText(res)
      if (!text) {
        return false
      }
      const data = JSON.parse(text) as { token?: string }
      if (!data?.token) {
        return false
      }
      setAuthToken(data.token)
      return true
    } catch {
      return false
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

async function readResponseText(res: Response): Promise<string> {
  const response = res as Response & {
    text?: () => Promise<string>
    json?: () => Promise<unknown>
  }

  if (typeof response.text === 'function') {
    return response.text()
  }

  if (typeof response.json === 'function') {
    const payload = await response.json()
    return payload === undefined ? '' : JSON.stringify(payload)
  }

  return ''
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`
  let res: Response
  const { headers: customHeaders, ...rest } = options
  const requestHeaders = toHeadersObject(customHeaders as HeadersInit | undefined)
  const isFormData = rest.body instanceof FormData

  try {
    res = await fetch(url, {
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeader(),
        ...localeHeader(),
        ...requestHeaders
      },
      credentials: 'include',
      ...rest
    })
  } catch (e) {
    const error = new ApiError('Network request failed')
    error.code = 'NETWORK_ERROR'
    throw error
  }

  const text = await readResponseText(res)

  if (!res.ok) {
    let message = ''
    let errorCode: string | undefined
    let details: unknown
    try {
      const data = text ? JSON.parse(text) : null
      message = data?.message || data?.error || ''
      errorCode = data?.error
      details = data?.details
    } catch (e) {
      // ignore JSON parsing errors
    }

    const statusLabel = `${res.status} ${res.statusText}`
    const fallback = text || statusLabel
    if (!message) {
      message = fallback
    }

    if (res.status === 401) {
      const shouldAttemptRefresh = (
        !isAuthPath(path)
        && requestHeaders[SKIP_AUTH_REFRESH_HEADER] !== '1'
        && errorCode !== 'EMAIL_NOT_VERIFIED'
      )
      if (shouldAttemptRefresh) {
        const refreshed = await tryRefreshAccessToken()
        if (refreshed) {
          return apiRequest<T>(path, {
            ...options,
            headers: {
              ...requestHeaders,
              [SKIP_AUTH_REFRESH_HEADER]: '1'
            }
          })
        }
      }
      if (errorCode !== 'EMAIL_NOT_VERIFIED') {
        errorCode = 'UNAUTHORIZED'
        message = 'Unauthorized or expired session. Please log in again.'
        clearAuthToken()
      }
    }

    const error = new ApiError(message)
    error.status = res.status
    error.code = errorCode
    error.details = details
    error.rawMessage = message
    throw error
  }

  if (res.status === 204 || !text) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch (e) {
    console.error('Error parsing response:', e)
    return undefined as T
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export async function apiPostMultipart<T>(path: string, formData: FormData): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: formData, headers: authHeader() })
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, { method: 'DELETE' })
}

export function setAuthToken(token: string) {
  localStorage.setItem('token', token)
}

export function clearAuthToken() {
  localStorage.removeItem('token')
}

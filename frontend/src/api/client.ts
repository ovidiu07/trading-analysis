const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

export class ApiError extends Error {
  status?: number
}

function authHeader() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`
  let res: Response
  const { headers: customHeaders, ...rest } = options

  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
        ...(customHeaders || {})
      },
      ...rest
    })
  } catch (e) {
    const error = new ApiError(`Cannot reach API at ${url}. Check server/CORS/network.`)
    throw error
  }

  const text = await res.text()

  if (!res.ok) {
    let message = ''
    try {
      const data = text ? JSON.parse(text) : null
      message = data?.message || data?.error || ''
    } catch (e) {
      // ignore JSON parsing errors
    }

    const statusLabel = `${res.status} ${res.statusText}`
    const fallback = text || statusLabel
    if (!message) {
      message = fallback
    }

    if (res.status === 401 || res.status === 403) {
      message = 'Unauthorized or expired session. Please login again.'
      clearAuthToken()
    }

    const error = new ApiError(`${statusLabel} - ${message}`)
    error.status = res.status
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

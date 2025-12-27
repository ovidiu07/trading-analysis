const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

function authHeader() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(options.headers || {})
    },
    ...options
  })

  if (!res.ok) {
    const message = await res.text()
    throw new Error(message || 'Request failed')
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json()
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

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, { method: 'DELETE' })
}

export function setAuthToken(token: string) {
  localStorage.setItem('token', token)
}

export function clearAuthToken() {
  localStorage.removeItem('token')
}

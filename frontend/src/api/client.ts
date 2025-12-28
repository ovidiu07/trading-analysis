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
    let message = 'Request failed'
    try {
      // Clone the response before reading its body to avoid "body stream already read" error
      const resClone = res.clone()
      const errorBody = await resClone.json()
      message = errorBody?.message || errorBody?.error || message
    } catch (e) {
      // If JSON parsing fails, try to get the text content from the original response
      message = await res.text()
    }
    throw new Error(message || 'Request failed')
  }

  if (res.status === 204) {
    return undefined as T
  }

  try {
    // Avoid crashing when the response has no JSON body (or an empty body).
    const text = await res.text()
    if (!text) {
      return undefined as T
    }
    return JSON.parse(text) as T
  } catch (e) {
    // If we get here, it might be because the body stream was already read in the error handling
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

export async function apiDelete(path: string): Promise<void> {
  return apiRequest<void>(path, { method: 'DELETE' })
}

export function setAuthToken(token: string) {
  localStorage.setItem('token', token)
}

export function clearAuthToken() {
  localStorage.removeItem('token')
}

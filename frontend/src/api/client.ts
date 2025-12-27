const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

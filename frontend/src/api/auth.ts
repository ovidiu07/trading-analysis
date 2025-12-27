import { apiPost, setAuthToken } from './client'

type AuthResponse = { token: string, user: { id: string, email: string, timezone?: string, baseCurrency?: string } }

export async function login(email: string, password: string) {
  const response = await apiPost<AuthResponse>('/auth/login', { email, password })
  setAuthToken(response.token)
  return response
}

export async function register(email: string, password: string) {
  const response = await apiPost<AuthResponse>('/auth/register', { email, password })
  setAuthToken(response.token)
  return response
}

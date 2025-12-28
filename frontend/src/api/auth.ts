import { apiGet, apiPost, setAuthToken } from './client'

export type AuthUser = { id: string; email: string; role?: string; baseCurrency?: string; timezone?: string }

export type AuthResponse = { token: string, user?: AuthUser }

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

export async function getCurrentUser() {
  return apiGet<AuthUser>('/users/me')
}

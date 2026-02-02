import { apiGet, apiPost, setAuthToken } from './client'

export type AuthUser = { id: string; email: string; role?: string; baseCurrency?: string; timezone?: string }

export type AuthResponse = { token: string, user?: AuthUser }

export type RegisterPayload = {
  email: string
  password: string
  termsAccepted: boolean
  termsVersion: string
  privacyAccepted: boolean
  privacyVersion: string
  captchaToken?: string | null
  locale?: string | null
}

export async function login(email: string, password: string) {
  const response = await apiPost<AuthResponse>('/auth/login', { email, password })
  setAuthToken(response.token)
  return response
}

export async function register(payload: RegisterPayload) {
  const response = await apiPost<AuthResponse>('/auth/register', payload)
  setAuthToken(response.token)
  return response
}

export async function getCurrentUser() {
  return apiGet<AuthUser>('/users/me')
}

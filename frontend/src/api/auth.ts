import { apiGet, apiPost, setAuthToken } from './client'

export type AuthUser = {
  id: string
  email: string
  role?: string
  baseCurrency?: string
  timezone?: string
  themePreference?: 'LIGHT' | 'DARK' | 'SYSTEM'
}

export type AuthResponse = { token: string, user?: AuthUser }

export type RegisterResponse = { success: boolean; requiresEmailVerification: boolean }

export type SuccessResponse = { success: boolean }

export type RegisterPayload = {
  email: string
  password: string
  termsAccepted: boolean
  termsVersion: string
  privacyAccepted: boolean
  privacyVersion: string
  locale?: string | null
}

export async function login(email: string, password: string) {
  const response = await apiPost<AuthResponse>('/auth/login', { email, password })
  setAuthToken(response.token)
  return response
}

export async function register(payload: RegisterPayload) {
  return apiPost<RegisterResponse>('/auth/register', payload)
}

export async function verifyEmail(email: string, token: string) {
  return apiPost<SuccessResponse>('/auth/verify-email', { email, token })
}

export async function resendVerification(email: string, locale?: string | null) {
  return apiPost<SuccessResponse>('/auth/resend-verification', { email, locale })
}

export async function forgotPassword(email: string) {
  return apiPost<SuccessResponse>('/auth/forgot-password', { email })
}

export async function resetPassword(email: string, token: string, newPassword: string) {
  return apiPost<SuccessResponse>('/auth/reset-password', { email, token, newPassword })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiPost<SuccessResponse>('/auth/change-password', { currentPassword, newPassword })
}

export async function getCurrentUser() {
  return apiGet<AuthUser>('/users/me')
}

import { apiPost, setAuthToken } from './client'

type AuthResponse = { token: string }

export async function login(email: string, password: string) {
  const response = await apiPost<AuthResponse>('/auth/login', { email, password })
  setAuthToken(response.token)
  return response.token
}

export async function register(email: string, password: string) {
  const response = await apiPost<AuthResponse>('/auth/register', { email, password })
  setAuthToken(response.token)
  return response.token
}

import { apiGet, apiPut } from './client'
import { AuthUser } from './auth'

export type UserSettingsRequest = {
  baseCurrency: string
  timezone: string
}

export async function fetchUserSettings() {
  return apiGet<AuthUser>('/users/me')
}

export async function updateUserSettings(payload: UserSettingsRequest) {
  return apiPut<AuthUser>('/users/me/settings', payload)
}

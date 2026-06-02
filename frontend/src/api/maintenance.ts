import { apiPost } from './client'

export const DATABASE_RESET_CONFIRMATION = 'RESET_TRADEJAUDIT_DATABASE_DATA'

export type DatabaseResetRequest = {
  confirmation: string
  preserveUsers: true
  password: string
}

export type DatabaseResetResponse = {
  status: 'SUCCESS' | string
  deletedRows: Record<string, number>
  preserved: string[]
}

export function resetDatabaseData(payload: DatabaseResetRequest) {
  return apiPost<DatabaseResetResponse>('/admin/maintenance/database/reset-data', payload)
}

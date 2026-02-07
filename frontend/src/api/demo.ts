import { apiGet, apiPost } from './client'

export type DemoStatusResponse = {
  demoEnabled: boolean
  hasDemoData: boolean
}

export type DemoRemovalCount = {
  trades?: number
  notes?: number
  notebookTags?: number
  notebookTagLinks?: number
  notebookAttachments?: number
  tags?: number
  accounts?: number
  notebookTemplates?: number
  notebookFolders?: number
}

export type DemoRemovalResponse = {
  demoEnabled: boolean
  removedCount?: DemoRemovalCount
}

export async function fetchDemoStatus() {
  return apiGet<DemoStatusResponse>('/me/demo-status')
}

export async function removeDemoData() {
  return apiPost<DemoRemovalResponse>('/me/demo/remove', {})
}

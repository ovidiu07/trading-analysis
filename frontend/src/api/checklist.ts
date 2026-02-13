import { apiGet, apiPut } from './client'

export type ChecklistTemplateItem = {
  id: string
  text: string
  sortOrder: number
  enabled: boolean
}

export type ChecklistTemplateItemInput = {
  id?: string
  text: string
  sortOrder: number
  enabled: boolean
}

export type TodayChecklistItem = {
  id: string
  text: string
  completed: boolean
}

export type TodayChecklistResponse = {
  date: string
  items: TodayChecklistItem[]
}

export type TodayChecklistUpdate = {
  checklistItemId: string
  completed: boolean
}

const toQuery = (params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, value)
    }
  })
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

const ensureTemplateList = (value: ChecklistTemplateItem[] | null | undefined): ChecklistTemplateItem[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
}

const ensureTodayResponse = (value: TodayChecklistResponse | null | undefined): TodayChecklistResponse => {
  if (!value || typeof value.date !== 'string' || !Array.isArray(value.items)) {
    throw new Error('Invalid today checklist response')
  }
  return {
    date: value.date,
    items: value.items
  }
}

export async function fetchChecklistTemplate(): Promise<ChecklistTemplateItem[]> {
  const payload = await apiGet<ChecklistTemplateItem[] | null>('/me/checklist/template')
  return ensureTemplateList(payload)
}

export async function saveChecklistTemplate(items: ChecklistTemplateItemInput[]): Promise<ChecklistTemplateItem[]> {
  const payload = await apiPut<ChecklistTemplateItem[] | null>('/me/checklist/template', { items })
  return ensureTemplateList(payload)
}

export async function fetchTodayChecklist(tz: string): Promise<TodayChecklistResponse> {
  const payload = await apiGet<TodayChecklistResponse | null>(`/me/checklist/today${toQuery({ tz })}`)
  return ensureTodayResponse(payload)
}

export async function updateTodayChecklist(date: string, updates: TodayChecklistUpdate[]): Promise<TodayChecklistResponse> {
  const payload = await apiPut<TodayChecklistResponse | null>('/me/checklist/today', {
    date,
    updates
  })
  return ensureTodayResponse(payload)
}

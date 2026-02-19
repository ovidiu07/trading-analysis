import { apiDelete, apiGet, apiPost, apiPut } from './client'

export type PlanScope = 'DAILY' | 'WEEKLY'
export type PlanSource = 'MENTOR' | 'USER'

export type Plan = {
  id: string
  scope: PlanScope
  source: PlanSource
  authorUserId?: string | null
  authorDisplayName?: string | null
  title: string
  content: string
  checklistJson?: string | null
  activeFrom: string
  activeTo: string
  featured: boolean
  createdAt: string
  updatedAt: string
}

export type PlanSummary = {
  id: string
  title: string
  scope: PlanScope
  source: PlanSource
  authorDisplayName?: string | null
  featured: boolean
  activeFrom: string
  activeTo: string
}

export type MyPlanPayload = {
  title: string
  content: string
  checklistJson?: string
  activeFrom: string
  activeTo?: string
}

export type ActivePlanSuggestionResponse = {
  plans: PlanSummary[]
  suggestedPlanIds: string[]
}

const toQuery = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      sp.set(key, value)
    }
  })
  const query = sp.toString()
  return query ? `?${query}` : ''
}

export async function fetchTodayMentorPlan(params: { date: string; tz: string }) {
  return apiGet<Plan | null>(`/today/mentor-plan${toQuery(params)}`)
}

export async function fetchTodayMyPlan(params: { date: string; tz: string }) {
  return apiGet<Plan | null>(`/today/my-plan${toQuery(params)}`)
}

export async function createMyDailyPlan(payload: MyPlanPayload) {
  return apiPost<Plan>('/plans/my/daily', payload)
}

export async function updateMyPlan(planId: string, payload: MyPlanPayload) {
  return apiPut<Plan>(`/plans/my/${planId}`, payload)
}

export async function deleteMyPlan(planId: string) {
  return apiDelete(`/plans/my/${planId}`)
}

export async function listMyPlans(params: {
  scope?: PlanScope
  from?: string
  to?: string
}) {
  return apiGet<Plan[]>(`/plans/my${toQuery({
    scope: params.scope,
    from: params.from,
    to: params.to
  })}`)
}

export async function fetchActivePlansForTrade(params: { openedAt: string; tz?: string }) {
  return apiGet<ActivePlanSuggestionResponse>(`/plans/active${toQuery({ openedAt: params.openedAt, tz: params.tz })}`)
}

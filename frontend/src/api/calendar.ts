import { apiGet } from './client'
import type { PlanScope } from './plans'

export type CalendarPlanSummary = {
  id: string
  scope: PlanScope
  title: string
  bias?: string | null
  objectives?: string | null
  focusSymbols: string[]
  periodStart: string
  periodEnd: string
  activeFrom?: string | null
  activeTo?: string | null
  status?: string | null
  setupCount?: number | null
  imageCount?: number | null
  thumbnailUrl?: string | null
  hasImages?: boolean | null
}

export type CalendarPlansResponse = {
  activeMonthlyPlan?: CalendarPlanSummary | null
  activeWeeklyPlan?: CalendarPlanSummary | null
  dailyPlans: CalendarPlanSummary[]
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

export async function fetchCalendarPlans(params: { from: string; to: string; tz?: string }) {
  return apiGet<CalendarPlansResponse>(`/calendar/plans${toQuery(params)}`)
}

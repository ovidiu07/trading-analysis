import { getCurrentLanguage } from '../i18n'
import { apiGet } from './client'

export type FeaturedPlanType = 'daily' | 'weekly'

export type FeaturedPlan = {
  id: string
  slug?: string | null
  title: string
  type: string
  biasSummary: string
  primaryModel: string
  keyLevels: string[]
  tags: string[]
  symbols: string[]
  weekStart?: string | null
  weekEnd?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
}

export type CoachFocus = {
  available: boolean
  severity: 'info' | 'warn' | 'critical' | string
  leakTitle: string
  action: string
  rationale: string
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

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

const authHeader = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const localeHeader = () => ({ 'Accept-Language': getCurrentLanguage() })

const parseFeaturedPlanPayload = async (response: Response, queryName: string, endpoint: string): Promise<FeaturedPlan | null> => {
  const payload = await response.text()
  if (!payload) {
    return null
  }

  try {
    const parsed = JSON.parse(payload) as FeaturedPlan | null
    return parsed ?? null
  } catch {
    throw new Error(`${queryName} failed: invalid JSON (${endpoint})`)
  }
}

const fetchFeaturedPlanByType = async (type: FeaturedPlanType, timezone?: string): Promise<FeaturedPlan | null> => {
  const endpoint = `/insights/featured${toQuery({ type, tz: timezone })}`
  const queryName = type === 'daily' ? 'featuredDailyPlan' : 'featuredWeeklyPlan'

  let response: Response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        ...authHeader(),
        ...localeHeader()
      },
      credentials: 'include'
    })
  } catch {
    throw new Error(`${queryName} failed: network error (${endpoint})`)
  }

  if (response.status === 404 || response.status === 204) {
    return null
  }

  if (!response.ok) {
    throw new Error(`${queryName} failed: ${response.status} ${response.statusText} (${endpoint})`)
  }

  return parseFeaturedPlanPayload(response, queryName, endpoint)
}

export async function fetchFeaturedPlan(type: FeaturedPlanType, timezone?: string): Promise<FeaturedPlan | null> {
  return fetchFeaturedPlanByType(type, timezone)
}

export async function fetchFeaturedDailyPlan(timezone?: string): Promise<FeaturedPlan | null> {
  return fetchFeaturedPlanByType('daily', timezone)
}

export async function fetchFeaturedWeeklyPlan(timezone?: string): Promise<FeaturedPlan | null> {
  return fetchFeaturedPlanByType('weekly', timezone)
}

export async function fetchCoachFocus(): Promise<CoachFocus> {
  return apiGet<CoachFocus>('/today/coach-focus')
}

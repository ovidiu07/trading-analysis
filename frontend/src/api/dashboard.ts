import { fetchAnalyticsSummary } from './analytics'
import { searchTrades, TradeRequest, TradeResponse } from './trades'

export type DashboardFilters = {
  from?: string
  to?: string
  status?: 'OPEN' | 'CLOSED' | 'ALL'
  market?: TradeRequest['market']
  accountId?: string
}

export async function fetchDashboardSummary(filters: DashboardFilters = {}) {
  return fetchAnalyticsSummary({
    from: filters.from,
    to: filters.to,
    dateMode: 'CLOSE',
    status: filters.status && filters.status !== 'ALL' ? filters.status : undefined,
    market: filters.market || undefined
  })
}

export async function fetchRecentTrades(limit = 5, filters: DashboardFilters = {}): Promise<TradeResponse[]> {
  const page = await searchTrades({
    page: 0,
    size: Math.max(50, limit * 6),
    openedAtFrom: filters.from,
    openedAtTo: filters.to,
    status: filters.status && filters.status !== 'ALL' ? filters.status : undefined,
    market: filters.market || undefined,
    accountId: filters.accountId || undefined
  })

  const rows = (page.content || [])
    .filter((trade) => {
      if (filters.market && trade.market !== filters.market) return false
      if (filters.accountId && trade.accountId !== filters.accountId) return false
      return true
    })
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())

  return rows.slice(0, limit)
}

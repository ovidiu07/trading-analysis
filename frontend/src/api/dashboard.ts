import { fetchAnalyticsSummary } from './analytics'
import { listTrades, TradeResponse } from './trades'

export async function fetchDashboardSummary() {
  return fetchAnalyticsSummary()
}

export async function fetchRecentTrades(limit = 5): Promise<TradeResponse[]> {
  const page = await listTrades({ page: 0, size: limit })
  return page.content || []
}

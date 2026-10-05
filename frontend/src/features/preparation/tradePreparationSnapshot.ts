import type { SessionReview } from '../../api/sessionReviews'
import type { PreparedExecutionDraft } from '../risk/preparedExecution'
import type { StrategyResponse } from '../../api/strategies'

export type TradePreparationSnapshot = {
  version: 1
  accountId: string
  date: string
  session: string
  timezone: string
  review?: SessionReview
  strategyDefinition?: StrategyResponse | null
  risk?: PreparedExecutionDraft
  capacity?: { maximumPermittedRisk: number | null; maximumPermittedRiskPct: number | null; remainingTrades: number | null; reason: string | null }
  capturedAt?: string
  source?: string
  setupConfiguration?: Record<string, unknown>
  sessionConfiguration?: Record<string, unknown>
  loggedTrade?: Record<string, unknown>
}

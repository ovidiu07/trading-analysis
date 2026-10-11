import { endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { BacktestingMetric, BacktestingTrade } from '../../api/backtesting'
import { computeResearchMetrics } from './research'

export type CalendarPeriod = {
  start: string
  end: string
  trades: BacktestingTrade[]
  metrics: BacktestingMetric
}

// Exported dates are local calendar dates. Do not reinterpret them as UTC instants.
export const calendarTradeDate = (trade: BacktestingTrade) => trade.exitDate || trade.date

export const calendarResearchTrades = (trades: BacktestingTrade[], workspaceId: string) => trades.filter(trade =>
  trade.workspaceId === workspaceId && trade.includedInAnalytics !== false && trade.tradeScope !== 'LIVE' && trade.source !== 'LIVE'
)

export function calendarPeriod(trades: BacktestingTrade[], start: string, end = start): CalendarPeriod {
  const rows = trades.filter(trade => calendarTradeDate(trade) >= start && calendarTradeDate(trade) <= end)
  return { start, end, trades: rows, metrics: computeResearchMetrics(rows) }
}

export function groupCalendarPeriods(trades: BacktestingTrade[], unit: 'day' | 'week' | 'month'): CalendarPeriod[] {
  const groups = new Map<string, Pick<CalendarPeriod, 'start' | 'end' | 'trades'>>()
  trades.forEach(trade => {
    const date = parseISO(calendarTradeDate(trade))
    const start = format(unit === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : unit === 'month' ? startOfMonth(date) : date, 'yyyy-MM-dd')
    const end = format(unit === 'week' ? endOfWeek(date, { weekStartsOn: 1 }) : unit === 'month' ? endOfMonth(date) : date, 'yyyy-MM-dd')
    const group = groups.get(start) || { start, end, trades: [] }
    group.trades.push(trade)
    groups.set(start, group)
  })
  return [...groups.values()].map(group => ({ ...group, metrics: computeResearchMetrics(group.trades) }))
    .sort((a, b) => a.start.localeCompare(b.start))
}

export const calendarPeriodValue = (period: CalendarPeriod, currency: string): number | null => {
  if (!period.metrics.trades) return null
  return currency ? period.metrics.currencyMetrics?.[currency]?.netPnl ?? null : period.metrics.totalR ?? null
}

export const rankCalendarPeriods = (periods: CalendarPeriod[], currency: string) => periods
  .filter(period => calendarPeriodValue(period, currency) != null)
  .sort((a, b) => calendarPeriodValue(b, currency)! - calendarPeriodValue(a, currency)! || a.start.localeCompare(b.start))
  .slice(0, 5)

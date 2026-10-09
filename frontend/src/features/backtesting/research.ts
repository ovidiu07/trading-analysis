import type { BacktestingCurrencyMetric, BacktestingMetric, BacktestingTrade } from '../../api/backtesting'

export type ResearchFilters = {
  search: string
  dateFrom: string
  dateTo: string
  source: string
  result: string
  session: string
  direction: string
  classificationStatus: string
}

export const emptyResearchFilters: ResearchFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  source: '',
  result: '',
  session: '',
  direction: '',
  classificationStatus: ''
}

export const filterResearchTrades = (trades: BacktestingTrade[], filters: ResearchFilters) => {
  const search = filters.search.trim().toLowerCase()
  return trades.filter((trade) => {
    if (filters.dateFrom && trade.date < filters.dateFrom) return false
    if (filters.dateTo && trade.date > filters.dateTo) return false
    if (filters.source && trade.source !== filters.source) return false
    if (filters.result && trade.result !== filters.result) return false
    if (filters.session && (trade.session || '').toLowerCase() !== filters.session.toLowerCase()) return false
    if (filters.direction && trade.direction !== filters.direction) return false
    if (filters.classificationStatus && (trade.classificationStatus || 'COMPLETE') !== filters.classificationStatus) return false
    if (search && ![
      trade.instrument,
      trade.setupName,
      trade.strategyNameSnapshot,
      trade.notes,
      ...(trade.tags || [])
    ].some((value) => (value || '').toLowerCase().includes(search))) return false
    return true
  })
}

const round = (value: number) => Number(value.toFixed(2))
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
const average = (values: number[]) => values.length ? round(sum(values) / values.length) : 0
const averageKnown = (values: Array<number | null | undefined>) => {
  const known = values.filter((v): v is number => v != null)
  return known.length ? average(known) : null
}
export const realizedTradeOrder = (trade: BacktestingTrade) => `${trade.exitDate || trade.date}T${trade.exitTime || trade.entryTime}|${trade.date}T${trade.entryTime}`
const drawdown = (values: number[]) => {
  let cumulative = 0, peak = 0, maximum = 0
  values.forEach(value => { cumulative += value; peak = Math.max(peak, cumulative); maximum = Math.max(maximum, peak - cumulative) })
  return round(maximum)
}

export const computeResearchMetrics = (input: BacktestingTrade[]): BacktestingMetric => {
  const trades = input.filter(t => t.includedInAnalytics !== false).sort((a, b) => realizedTradeOrder(a).localeCompare(realizedTradeOrder(b)))
  const values = trades.filter(t => t.pnlR != null).map(t => Number(t.pnlR))
  const completeR = values.length === trades.length
  const wins = values.filter(value => value > 0), losses = values.filter(value => value < 0)
  const winCount = trades.filter(t => t.result === 'WIN').length
  const lossCount = trades.filter(t => t.result === 'LOSS').length
  const breakevens = trades.filter(t => t.result === 'BREAKEVEN').length
  const grossWin = sum(wins), grossLoss = Math.abs(sum(losses))
  let currentLosingStreak = 0, maximumLosingStreak = 0
  trades.forEach(t => {
    currentLosingStreak = t.result === 'LOSS' ? currentLosingStreak + 1 : 0
    maximumLosingStreak = Math.max(maximumLosingStreak, currentLosingStreak)
  })
  const sorted = [...values].sort((a, b) => a - b)
  const medianR = !sorted.length ? 0 : sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  const groups: Record<string, BacktestingTrade[]> = {}
  trades.forEach(t => { if (t.netPnl != null && t.currency) (groups[t.currency] ||= []).push(t) })
  const currencyMetrics: Record<string, BacktestingCurrencyMetric> = {}
  Object.entries(groups).forEach(([currency, rows]) => {
    const amounts = rows.map(t => Number(t.netPnl)), winners = amounts.filter(v => v > 0), losers = amounts.filter(v => v < 0)
    const profit = sum(winners), loss = Math.abs(sum(losers))
    currencyMetrics[currency] = {
      currency, trades: rows.length, netPnl: round(sum(amounts)), grossProfit: round(profit), grossLoss: round(loss),
      expectancy: average(amounts), profitFactor: loss ? round(profit / loss) : profit ? null : 0,
      averageWinner: average(winners), averageLoser: average(losers), largestWinner: winners.length ? Math.max(...winners) : 0,
      largestLoser: losers.length ? Math.min(...losers) : 0, maximumDrawdown: drawdown(amounts),
      commission: rows.some(t => t.commission == null) ? null : round(sum(rows.map(t => Number(t.commission)))),
      averageHoldingMinutes: averageKnown(rows.map(t => t.exitDate && t.exitTime
        ? (Date.parse(`${t.exitDate}T${t.exitTime}Z`) - Date.parse(`${t.date}T${t.entryTime}Z`)) / 60000 : null)),
      averageDurationBars: averageKnown(rows.map(t => t.durationBars)),
      averageFavorableExcursion: averageKnown(rows.map(t => t.favorableExcursion)),
      averageAdverseExcursion: averageKnown(rows.map(t => t.adverseExcursion))
    }
  })
  return {
    trades: trades.length, wins: winCount, losses: lossCount, breakevens,
    winRate: trades.length ? round(winCount / trades.length * 100) : 0,
    lossRate: trades.length ? round(lossCount / trades.length * 100) : 0,
    breakevenRate: trades.length ? round(breakevens / trades.length * 100) : 0,
    totalR: completeR ? round(sum(values)) : null, averageR: completeR ? average(values) : null,
    expectancy: completeR ? average(values) : null,
    profitFactor: completeR ? (grossLoss ? round(grossWin / grossLoss) : grossWin ? null : 0) : null,
    averageWinR: completeR ? average(wins) : null, averageLossR: completeR ? average(losses) : null,
    largestWinR: completeR ? (wins.length ? Math.max(...wins) : 0) : null,
    largestLossR: completeR ? (losses.length ? Math.min(...losses) : 0) : null,
    medianR: completeR ? round(medianR) : null, maximumDrawdownR: completeR ? drawdown(values) : null,
    maximumLosingStreak, currentLosingStreak, rSampleSize: values.length, currencyMetrics,
    sampleQuality: sampleQuality(trades.length)
  }
}

export const sampleQuality = (count: number) => {
  if (count < 5) return 'INSUFFICIENT_DATA'
  if (count < 10) return 'EXPLORATORY'
  if (count < 30) return 'EARLY_SIGNAL'
  if (count < 50) return 'DEVELOPING_EDGE'
  return 'VALIDATED_EVIDENCE'
}

export const sourceCounts = (trades: BacktestingTrade[]) => ({
  MANUAL: trades.filter((trade) => trade.source === 'MANUAL').length,
  IMPORT: trades.filter((trade) => trade.source === 'IMPORT').length,
  LIVE: trades.filter((trade) => trade.source === 'LIVE').length
})

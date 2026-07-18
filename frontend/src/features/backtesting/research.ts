import type { BacktestingMetric, BacktestingTrade } from '../../api/backtesting'

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

export const computeResearchMetrics = (trades: BacktestingTrade[]): BacktestingMetric => {
  const values = trades.map((trade) => Number(trade.pnlR || 0))
  const wins = values.filter((value) => value > 0)
  const losses = values.filter((value) => value < 0)
  const breakevens = values.filter((value) => value === 0).length
  const totalR = values.reduce((sum, value) => sum + value, 0)
  const grossWin = wins.reduce((sum, value) => sum + value, 0)
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0))
  let cumulative = 0
  let peak = 0
  let maximumDrawdownR = 0
  let currentLosingStreak = 0
  let maximumLosingStreak = 0
  values.forEach((value) => {
    cumulative += value
    peak = Math.max(peak, cumulative)
    maximumDrawdownR = Math.max(maximumDrawdownR, peak - cumulative)
    if (value < 0) {
      currentLosingStreak += 1
      maximumLosingStreak = Math.max(maximumLosingStreak, currentLosingStreak)
    } else {
      currentLosingStreak = 0
    }
  })
  const sorted = [...values].sort((left, right) => left - right)
  const medianR = sorted.length === 0 ? 0 : sorted.length % 2
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  const average = (items: number[]) => items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : 0
  const round = (value: number) => Number(value.toFixed(2))
  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakevens,
    winRate: trades.length ? round((wins.length / trades.length) * 100) : 0,
    lossRate: trades.length ? round((losses.length / trades.length) * 100) : 0,
    breakevenRate: trades.length ? round((breakevens / trades.length) * 100) : 0,
    totalR: round(totalR),
    averageR: round(average(values)),
    expectancy: round(average(values)),
    profitFactor: grossLoss ? round(grossWin / grossLoss) : grossWin ? null : 0,
    averageWinR: round(average(wins)),
    averageLossR: round(average(losses)),
    largestWinR: values.length ? Math.max(...values) : 0,
    largestLossR: values.length ? Math.min(...values) : 0,
    medianR: round(medianR),
    maximumDrawdownR: round(maximumDrawdownR),
    maximumLosingStreak,
    currentLosingStreak,
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

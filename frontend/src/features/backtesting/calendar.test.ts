import { describe, expect, it } from 'vitest'
import type { BacktestingTrade } from '../../api/backtesting'
import {
  calendarPeriod, calendarPeriodValue, calendarResearchTrades, groupCalendarPeriods, rankCalendarPeriods
} from './calendar'

const trade = (overrides: Partial<BacktestingTrade> = {}): BacktestingTrade => ({
  id: 'trade', workspaceId: 'workspace', date: '2026-01-05', entryTime: '23:30:00',
  instrument: 'NQ', direction: 'LONG', result: 'WIN', pnlR: 2, netPnl: 200,
  currency: 'USD', source: 'IMPORT', tradeScope: 'REPLAY', tags: [], ...overrides
})

describe('backtesting calendar aggregation', () => {
  it('keeps only included tested trades owned by the selected workspace', () => {
    const rows = [trade(), trade({ id: 'manual', source: 'MANUAL', tradeScope: 'BACKTEST' }),
      trade({ id: 'live', tradeScope: 'LIVE' }), trade({ id: 'linked', source: 'LIVE' }),
      trade({ id: 'excluded', includedInAnalytics: false }), trade({ id: 'other', workspaceId: 'other' })]
    expect(calendarResearchTrades(rows, 'workspace').map(row => row.id)).toEqual(['trade', 'manual'])
    expect(calendarResearchTrades(rows, 'other').map(row => row.id)).toEqual(['other'])
  })

  it('uses exit dates across month/year boundaries and Monday–Sunday calendar weeks', () => {
    const rows = [trade({ id: 'overnight', date: '2025-12-31', exitDate: '2026-01-01' }),
      trade({ id: 'prior', date: '2025-12-29' }), trade({ id: 'next', date: '2026-01-05' })]
    const days = groupCalendarPeriods(rows, 'day')
    expect(days.map(day => day.start)).toEqual(['2025-12-29', '2026-01-01', '2026-01-05'])
    const weeks = groupCalendarPeriods(rows, 'week')
    expect(weeks.map(week => [week.start, week.end, week.metrics.trades])).toEqual([
      ['2025-12-29', '2026-01-04', 2], ['2026-01-05', '2026-01-11', 1]
    ])
    const months = groupCalendarPeriods(rows, 'month')
    expect(months.map(month => [month.start, month.end, month.metrics.trades])).toEqual([
      ['2025-12-01', '2025-12-31', 1], ['2026-01-01', '2026-01-31', 2]
    ])
  })

  it('keeps currencies separate and missing R unavailable without subtracting costs twice', () => {
    const period = calendarPeriod([
      trade({ commission: 5 }), trade({ id: 'eur', pnlR: null, currency: 'EUR', netPnl: -50, result: 'LOSS' }),
      trade({ id: 'unknown-cash', currency: 'USD', netPnl: null })
    ], '2026-01-05')
    expect(calendarPeriodValue(period, '')).toBeNull()
    expect(period.metrics.rSampleSize).toBe(2)
    expect(calendarPeriodValue(period, 'USD')).toBe(200)
    expect(period.metrics.currencyMetrics?.USD.trades).toBe(1)
    expect(calendarPeriodValue(period, 'EUR')).toBe(-50)
    expect(calendarPeriodValue(period, 'GBP')).toBeNull()
    expect(calendarPeriodValue(calendarPeriod([], '2026-01-05'), '')).toBeNull()
    expect(calendarPeriodValue(calendarPeriod([trade({ pnlR: 0, netPnl: 0 })], '2026-01-05'), '')).toBe(0)
  })

  it('clips boundary-week summaries to the month without affecting full-week rankings', () => {
    const rows = [trade({ date: '2026-01-31', pnlR: 2 }), trade({ id: 'feb', date: '2026-02-01', pnlR: -1 })]
    expect(groupCalendarPeriods(rows, 'week')[0].metrics.totalR).toBe(1)
    expect(calendarPeriod(rows, '2026-01-26', '2026-01-31').metrics.totalR).toBe(2)
    expect(calendarPeriod(rows, '2026-02-01', '2026-02-01').metrics.totalR).toBe(-1)
  })

  it('ranks by the selected metric, skips unavailable periods, and resolves ties by date', () => {
    const periods = groupCalendarPeriods([
      trade({ date: '2026-01-05', pnlR: 3, netPnl: 50 }),
      trade({ id: 'feb', date: '2026-02-05', pnlR: 1, netPnl: 300 }),
      trade({ id: 'mar', date: '2026-03-05', pnlR: null, netPnl: 400 }),
      trade({ id: 'apr', date: '2026-04-05', pnlR: 1, netPnl: 300 })
    ], 'month')
    expect(rankCalendarPeriods(periods, '').map(period => period.start)).toEqual(['2026-01-01', '2026-02-01', '2026-04-01'])
    expect(rankCalendarPeriods(periods, 'USD').map(period => period.start)).toEqual(['2026-03-01', '2026-02-01', '2026-04-01', '2026-01-01'])
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { BacktestingTrade } from '../../api/backtesting'
import { computeResearchMetrics, emptyResearchFilters, filterResearchTrades } from './research'

const fixture = readFileSync(resolve(process.cwd(), '../backend/src/test/resources/backtesting/tradingview-replay-ger40f.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
const trades: BacktestingTrade[] = fixture.filter(line => line.split(',')[1].startsWith('Exit')).map((line, i) => {
  const r = line.split(',')
  const entry = fixture[i * 2].split(',')
  return { id: String(i), workspaceId: 'workspace', instrument: 'PEPPERSTONE:GER40F', date: entry[2].slice(0, 10), entryTime: entry[2].slice(11), exitDate: r[2].slice(0, 10), exitTime: r[2].slice(11),
    direction: r[1].endsWith('long') ? 'LONG' : 'SHORT', result: Number(r[7]) > 0 ? 'WIN' : 'LOSS', pnlR: null, netPnl: Number(r[7]), currency: 'EUR', commission: Number(r[9]), favorableExcursion: Number(r[10]), adverseExcursion: Number(r[12]), durationBars: Number(r[16]), tags: [], source: 'IMPORT', tradeScope: 'REPLAY' }
})

describe('backtesting money and R metrics', () => {
  it('matches the supplied 25-trade replay without double-counting execution rows', () => {
    const m = computeResearchMetrics(trades), eur = m.currencyMetrics!.EUR
    expect(m.trades).toBe(25); expect(m.wins).toBe(15); expect(m.losses).toBe(10); expect(m.winRate).toBe(60)
    expect(eur.netPnl).toBe(1768.4); expect(eur.profitFactor).toBe(2.53); expect(eur.maximumDrawdown).toBe(265)
    expect(eur.expectancy).toBe(70.74); expect(eur.averageFavorableExcursion).toBe(159.68); expect(eur.averageAdverseExcursion).toBe(-79.3)
    expect(m.rSampleSize).toBe(0); expect(m.expectancy).toBeNull(); expect(m.totalR).toBeNull(); expect(m.maximumDrawdownR).toBeNull()
  })
  it('keeps mixed currencies separate and never treats missing R as breakeven', () => {
    const m = computeResearchMetrics([{ ...trades[0], netPnl: 100, currency: 'USD', result: 'WIN' }, { ...trades[1], netPnl: -50, currency: 'EUR', result: 'LOSS', pnlR: -1 }])
    expect(m.currencyMetrics!.USD.netPnl).toBe(100); expect(m.currencyMetrics!.EUR.netPnl).toBe(-50)
    expect(m.rSampleSize).toBe(1); expect(m.breakevens).toBe(0); expect(m.averageR).toBeNull()
  })
  it('orders realized equity and losing streaks by exit time', () => {
    const m = computeResearchMetrics([{ ...trades[0], exitTime: '12:00', result: 'WIN', netPnl: 100 }, { ...trades[0], exitTime: '11:00', result: 'LOSS', netPnl: -50 }])
    expect(m.currencyMetrics!.EUR.maximumDrawdown).toBe(50); expect(m.currentLosingStreak).toBe(0)
  })
  it('recalculates monetary metrics for active filters and excludes evidence marked out', () => {
    const filtered = filterResearchTrades(trades, { ...emptyResearchFilters, result: 'LOSS' })
    expect(computeResearchMetrics(filtered).currencyMetrics!.EUR.netPnl).toBe(-1152.2)
    expect(computeResearchMetrics([{ ...trades[0], includedInAnalytics: false }]).trades).toBe(0)
  })
  it('preserves R analytics for existing manual evidence and handles no-loss profit factor', () => {
    const m = computeResearchMetrics([{ ...trades[0], pnlR: 2, result: 'WIN', netPnl: null }, { ...trades[1], pnlR: -1, result: 'LOSS', netPnl: null }])
    expect(m.totalR).toBe(1); expect(m.expectancy).toBe(0.5); expect(m.profitFactor).toBe(2)
    expect(computeResearchMetrics([{ ...trades[0], netPnl: 2, result: 'WIN' }]).currencyMetrics!.EUR.profitFactor).toBeNull()
  })
})

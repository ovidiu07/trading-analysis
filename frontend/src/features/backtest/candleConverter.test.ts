import { describe, expect, it } from 'vitest'
import { normalizeBacktestCandlesWithDiagnostics, toSeriesPoint } from './candleConverter'

describe('candleConverter', () => {
  it('converts candle DTO rows into sorted chart points with numeric OHLC values', () => {
    const rows = [
      {
        timestamp: 1_770_002_400_000,
        open: 1.1025,
        high: 1.104,
        low: 1.102,
        close: 1.1035,
        volume: 130
      },
      {
        timestamp: '2026-02-02T09:00:00Z',
        open: '1.1020',
        high: '1.1030',
        low: '1.1010',
        close: '1.1025',
        volume: '120'
      },
      {
        timestamp: 1_770_002_100,
        open: 1.101,
        high: 1.102,
        low: 1.1,
        close: 1.1015,
        volume: 110
      },
      {
        timestamp: '2026-02-02T09:00:00Z',
        open: '1.2020',
        high: '1.2030',
        low: '1.2010',
        close: '1.2025',
        volume: '220'
      },
      {
        timestamp: 'invalid',
        open: 'x',
        high: 'x',
        low: 'x',
        close: 'x',
        volume: 'x'
      }
    ]

    const normalized = normalizeBacktestCandlesWithDiagnostics(rows)

    expect(normalized.invalidRows).toBe(1)
    expect(normalized.candles).toHaveLength(3)
    expect(normalized.candles.map((row) => row.timestamp)).toEqual([
      '2026-02-02T03:15:00.000Z',
      '2026-02-02T03:20:00.000Z',
      '2026-02-02T09:00:00.000Z',
    ])
    expect(normalized.series[0]).toMatchObject({
      time: 1_770_002_100_000,
      open: 1.101,
      high: 1.102,
      low: 1.1,
      close: 1.1015,
      volume: 110
    })
    expect(normalized.series[2]).toMatchObject({
      open: 1.202,
      high: 1.203,
      low: 1.201,
      close: 1.2025,
      volume: 220
    })
    expect(normalized.series.every((point) => Number.isFinite(point.time))).toBe(true)
    expect(normalized.series.every((point) =>
      Number.isFinite(point.open)
      && Number.isFinite(point.high)
      && Number.isFinite(point.low)
      && Number.isFinite(point.close)
    )).toBe(true)
  })

  it('returns null series point when timestamp or OHLC cannot be parsed', () => {
    expect(toSeriesPoint({
      timestamp: 'not-a-date',
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100
    })).toBeNull()

    expect(toSeriesPoint({
      timestamp: '2026-02-02T09:00:00Z',
      open: 'bad-number',
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100
    })).toBeNull()
  })
})

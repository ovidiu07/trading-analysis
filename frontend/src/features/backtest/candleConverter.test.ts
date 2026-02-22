import { describe, expect, it } from 'vitest'
import { normalizeBacktestCandles } from './candleConverter'

describe('normalizeBacktestCandles', () => {
  it('parses numeric fields, normalizes time, and sorts candles ascending', () => {
    const rows = [
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
        timestamp: 1_770_002_400_000,
        open: 1.1025,
        high: 1.104,
        low: 1.102,
        close: 1.1035,
        volume: 130
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

    const normalized = normalizeBacktestCandles(rows)

    expect(normalized).toHaveLength(3)
    expect(normalized.map((row) => row.timestamp)).toEqual([
      '2026-02-02T03:15:00.000Z',
      '2026-02-02T03:20:00.000Z',
      '2026-02-02T09:00:00.000Z',
    ])
    expect(normalized[0]).toMatchObject({
      open: 1.101,
      high: 1.102,
      low: 1.1,
      close: 1.1015,
      volume: 110
    })
  })
})

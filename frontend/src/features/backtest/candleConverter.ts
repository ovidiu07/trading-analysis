import type { BacktestCandle } from '../../api/backtest'

type BacktestCandleLike = Partial<BacktestCandle> & {
  timestamp?: string | number | Date
  open?: unknown
  high?: unknown
  low?: unknown
  close?: unknown
  volume?: unknown
}

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toTimestampMs = (value: unknown) => {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const asNumber = Number(trimmed)
    if (Number.isFinite(asNumber)) {
      return asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber
    }

    const parsed = Date.parse(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const normalizeBacktestCandles = (candles: BacktestCandleLike[]): BacktestCandle[] => {
  const byTimestamp = new Map<number, BacktestCandle>()

  for (const candle of candles || []) {
    const timestampMs = toTimestampMs(candle.timestamp)
    const open = toFiniteNumber(candle.open)
    const high = toFiniteNumber(candle.high)
    const low = toFiniteNumber(candle.low)
    const close = toFiniteNumber(candle.close)
    const volume = toFiniteNumber(candle.volume ?? 0)

    if (
      timestampMs === null
      || open === null
      || high === null
      || low === null
      || close === null
      || volume === null
      || high < low
    ) {
      continue
    }

    byTimestamp.set(timestampMs, {
      timestamp: new Date(timestampMs).toISOString(),
      open,
      high,
      low,
      close,
      volume
    })
  }

  return Array.from(byTimestamp.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
}


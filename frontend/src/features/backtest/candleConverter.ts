import type { BacktestCandle } from '../../api/backtest'

type BacktestCandleLike = Partial<BacktestCandle> & {
  timestamp?: string | number | Date
  epochSec?: number
  open?: unknown
  high?: unknown
  low?: unknown
  close?: unknown
  volume?: unknown
}

export type ReplaySeriesPoint = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type BacktestCandleNormalizationResult = {
  candles: BacktestCandle[]
  series: ReplaySeriesPoint[]
  invalidRows: number
  invalidReasons: string[]
  warnings: string[]
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

export const toSeriesPoint = (dto: BacktestCandleLike): ReplaySeriesPoint | null => {
  const rawTime = dto.epochSec ?? dto.timestamp
  const time = toTimestampMs(rawTime)
  const open = toFiniteNumber(dto.open)
  const high = toFiniteNumber(dto.high)
  const low = toFiniteNumber(dto.low)
  const close = toFiniteNumber(dto.close)
  const volume = toFiniteNumber(dto.volume ?? 0)

  if (
    time === null
    || open === null
    || high === null
    || low === null
    || close === null
    || volume === null
  ) {
    return null
  }

  return {
    time,
    open,
    high,
    low,
    close,
    volume
  }
}

export const normalizeBacktestCandlesWithDiagnostics = (candles: BacktestCandleLike[]): BacktestCandleNormalizationResult => {
  const byTimestamp = new Map<number, ReplaySeriesPoint>()
  const invalidReasons: string[] = []
  const warnings: string[] = []
  let invalidRows = 0

  for (const [index, candle] of (candles || []).entries()) {
    const seriesPoint = toSeriesPoint(candle)
    if (!seriesPoint) {
      invalidRows += 1
      if (invalidReasons.length < 3) {
        invalidReasons.push(`Row ${index + 1}: invalid timestamp or OHLC/volume value.`)
      }
      continue
    }

    const adjustedHigh = Math.max(seriesPoint.high, seriesPoint.open, seriesPoint.close)
    const adjustedLow = Math.min(seriesPoint.low, seriesPoint.open, seriesPoint.close)
    if (adjustedHigh !== seriesPoint.high || adjustedLow !== seriesPoint.low) {
      warnings.push(`Row ${index + 1}: high/low adjusted to include open/close.`)
    }

    byTimestamp.set(seriesPoint.time, {
      ...seriesPoint,
      high: adjustedHigh,
      low: adjustedLow
    })
  }

  const series = Array.from(byTimestamp.values()).sort((a, b) => a.time - b.time)
  const normalizedCandles = series.map((item) => ({
    timestamp: new Date(item.time).toISOString(),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume
  }))

  return {
    candles: normalizedCandles,
    series,
    invalidRows,
    invalidReasons,
    warnings
  }
}

export const normalizeBacktestCandles = (candles: BacktestCandleLike[]): BacktestCandle[] => {
  return normalizeBacktestCandlesWithDiagnostics(candles).candles
}

import type { BacktestingTrade } from '../../api/backtesting'

// Keep source diagnostics separate from editable gap annotations. Missing fill metrics are not zero.
export function fvgSignalExport(trade: BacktestingTrade): Record<string, string | number | boolean | null> {
  const columns: Record<string, string | number | boolean | null> = {
    'FVG metadata status': 'MISSING', 'FVG created (UTC)': null, 'FVG size (price units)': null,
    'FVG entry mode': null, 'FVG planned entry depth (%)': null, 'FVG actual fill depth (%)': null,
    'FVG bars from creation to entry': null, 'FVG bars from creation to first touch': null,
    'FVG minutes from creation to entry': null, 'FVG configured R:R': null, 'FVG BE enabled': null,
    'FVG BE trigger (% of entry-to-TP)': null, 'FVG BE protected profit (% of entry-to-TP)': null
  }
  const payload = trade.entrySignal?.split(' | FVGv1 ')[1]
  if (!payload || trade.source !== 'IMPORT' || trade.tradeScope !== 'REPLAY') return columns
  const pairs = payload.split(/\s+/).map(token => token.split('='))
  const values = Object.fromEntries(pairs)
  const numeric = (value: string | undefined) => value && /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null
  const low = numeric(values.lo), high = numeric(values.hi), size = numeric(values.size), created = numeric(values.created)
  const plannedDepth = numeric(values.depth), rr = numeric(values.rr)
  const be = values.BE === 'OFF' ? null : values.BE?.split('/').map(numeric)
  if (pairs.some(pair => pair.length !== 2) || new Set(pairs.map(pair => pair[0])).size !== pairs.length
    || low == null || high == null || size == null || low <= 0 || high <= low || Math.abs(high - low - size) > 1e-7
    || created == null || !Number.isSafeInteger(created) || created <= 0 || created > 253402300799999
    || !values.tf || !/^[a-zA-Z0-9]+$/.test(values.tf) || values.tf.length > 40
    || plannedDepth == null || plannedDepth < 0 || plannedDepth > 100 || rr == null || rr <= 0
    || !['TOUCH', 'DEPTH'].includes(values.mode) || numeric(values.sizePct) == null
    || (values.BE !== 'OFF' && (!be || be.length !== 2 || be[0] == null || be[1] == null
      || be[0] <= 0 || be[0] > 100 || be[1] < 0 || be[1] >= be[0]))) {
    columns['FVG metadata status'] = 'INVALID'
    return columns
  }
  const fill = Object.fromEntries((trade.exitSignal?.split(' | ')[1] || '').split(/\s+/).map(token => token.split('=')))
  const bars = (value: string | undefined) => {
    const number = numeric(value)
    return number != null && Number.isSafeInteger(number) && number >= 0 ? number : null
  }
  const minutes = numeric(fill.ageMin)
  // Geometry and the actual CSV execution price also cover same-candle round trips.
  const actualDepth = trade.entryPrice == null ? null : 100 * (trade.direction === 'LONG' ? high - trade.entryPrice : trade.entryPrice - low) / size
  return {
    ...columns, 'FVG metadata status': 'AVAILABLE', 'FVG created (UTC)': new Date(created).toISOString(),
    'FVG size (price units)': size, 'FVG entry mode': values.mode, 'FVG planned entry depth (%)': plannedDepth,
    'FVG actual fill depth (%)': actualDepth == null ? null : Number(actualDepth.toFixed(6)),
    'FVG bars from creation to entry': bars(fill.fillBars), 'FVG bars from creation to first touch': bars(fill.touchBars),
    'FVG minutes from creation to entry': minutes != null && minutes >= 0 ? minutes : null,
    'FVG configured R:R': rr, 'FVG BE enabled': values.BE !== 'OFF',
    'FVG BE trigger (% of entry-to-TP)': be?.[0] ?? null, 'FVG BE protected profit (% of entry-to-TP)': be?.[1] ?? null
  }
}

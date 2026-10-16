import registry from './ict-fields.generated.json'
import type { BacktestingTrade, BacktestingTradePayload } from '../../api/backtesting'

export const ictFields = registry
export type IctKey = typeof registry[number]['key'] & keyof BacktestingTradePayload
export const ictGroups = ['setup', 'htf', 'liquidity', 'fvg'] as const
export const contextKeys = ['contextTimeframe', 'htfTrend', 'marketStructure', 'marketCondition', 'session'] as const
export const metadataValues = (trade: Partial<BacktestingTradePayload>) => Object.fromEntries(ictFields.map(field => [field.key, trade[field.key as IctKey] ?? null]))
export const copyTradeContext = (trade: BacktestingTrade) => Object.fromEntries(contextKeys.map(key => {
  const value = trade[key]
  const field = ictFields.find(f => f.key === key)
  const canonical = field?.options.find(o => o.value === value || o.aliases.some(alias => alias.toLowerCase() === value?.toLowerCase()))?.value
  return [key, canonical ?? value ?? null]
}))
export function directionVsHtf(direction?: string | null, trend?: string | null) {
  if (!direction || !trend || !['LONG', 'SHORT'].includes(direction)) return null
  if (trend === 'RANGING') return 'NEUTRAL'
  if (!['BULLISH', 'BEARISH'].includes(trend)) return null
  return (direction === 'LONG') === (trend === 'BULLISH') ? 'WITH_TREND' : 'AGAINST_TREND'
}
export function validIctNumbers(trade: Partial<BacktestingTradePayload>) {
  return ictFields.filter(f => f.kind !== 'select').every(field => {
    const value = trade[field.key as IctKey]
    if (value == null) return true
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false
    if (field.kind === 'integer') return Number.isInteger(value) && value <= 2147483647
    const [coefficient, exponent = '0'] = value.toString().toLowerCase().split('e')
    const [integer, decimals = ''] = coefficient.split('.')
    return Math.max(1, integer.length + Number(exponent)) <= field.integerDigits
      && Math.max(0, decimals.length - Number(exponent)) <= field.scale
  })
}
export function previousContextTrade(trades: BacktestingTrade[], current: { id?: string; date: string; entryTime: string }) {
  const at = `${current.date}T${current.entryTime.padEnd(8, ':00')}`
  return trades.filter(t => t.id !== current.id && `${t.date}T${t.entryTime.padEnd(8, ':00')}` < at)
    .sort((a, b) => `${b.date}T${b.entryTime}|${b.createdAt || ''}`.localeCompare(`${a.date}T${a.entryTime}|${a.createdAt || ''}`))[0]
}

// Use the metadata-only route when the user has not changed other editable trade fields.
export function isIctOnlyEdit(original: BacktestingTrade, draft: BacktestingTradePayload) {
  const otherFields = ['date', 'entryTime', 'instrument', 'direction', 'result', 'pnlR', 'riskPercent', 'plannedRR',
    'setupName', 'strategyId', 'strategySource', 'strategyNameSnapshot', 'sourceTimezone', 'executionTimeframe', 'tags', 'notes'] as const
  const comparable = (value: unknown) => value === '' || value == null ? null : value
  return otherFields.every(key => JSON.stringify(comparable(original[key])) === JSON.stringify(comparable(draft[key])))
}

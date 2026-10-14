import { strToU8, zipSync } from 'fflate'
import type { BacktestingEdgeLens, BacktestingMetric, BacktestingScreenshot, BacktestingTrade, BacktestingWorkspace } from '../../api/backtesting'
import { calendarResearchTrades, groupCalendarPeriods } from './calendar'
import { computeResearchMetrics, emptyResearchFilters, filterResearchTrades, type ResearchFilters } from './research'

export type ExportPeriod = { from: string; to: string; dateBasis: 'entry' | 'exit'; filters?: ResearchFilters }
type Cell = string | number | boolean | null | undefined
type Row = Record<string, Cell>

export function validExportDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function selectExportTrades(trades: BacktestingTrade[], workspaceId: string, period: ExportPeriod) {
  if (!validExportDate(period.from) || !validExportDate(period.to) || period.from > period.to) throw new Error('INVALID_EXPORT_PERIOD')
  const candidates = filterResearchTrades(trades, { ...emptyResearchFilters, ...period.filters, dateFrom: '', dateTo: '' })
  return candidates.filter(trade => {
    const date = period.dateBasis === 'exit' ? trade.exitDate : trade.date
    return trade.workspaceId === workspaceId && trade.source !== 'LIVE' && trade.tradeScope !== 'LIVE'
      && Boolean(date && date >= period.from && date <= period.to)
  }).sort((a, b) => `${a.date}T${a.entryTime}|${a.id}`.localeCompare(`${b.date}T${b.entryTime}|${b.id}`))
}

// Text is quoted and formula-escaped; numeric negatives remain numbers in Excel.
export function csvCell(value: Cell) {
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) return '""'
  let text = String(value)
  if (typeof value === 'string' && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function rowsToCsv(rows: Row[], headers = [...new Set(rows.flatMap(row => Object.keys(row)))]) {
  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(row => headers.map(header => csvCell(row[header])).join(','))].join('\r\n') + '\r\n'
}

// Exhaustive mapping makes new API fields visible to the export at compile time.
const tradeFields = {
  id: 'Trade ID', workspaceId: 'Workspace ID', liveTradeId: 'Linked live trade ID',
  date: 'Entry date', weekday: 'Weekday', entryTime: 'Entry time', instrument: 'Instrument', direction: 'Direction',
  session: 'Session', setupName: 'Setup', strategyId: 'Strategy ID', strategySource: 'Strategy source', strategyNameSnapshot: 'Strategy',
  gapPresent: 'Gap present', gapType: 'Gap type', gapTimeframe: 'Gap timeframe', gapCreatedAt: 'Gap created time', gapMitigatedAt: 'Gap mitigated time',
  gapHigh: 'Gap high', gapLow: 'Gap low', gapMidpoint: 'Gap midpoint', gapSizePoints: 'Gap size (points)', gapSizePercent: 'Gap size (%)',
  gapEntryPositionPercent: 'Gap entry position (%)', gapFillStatus: 'Gap fill status', gapRelationToLiquidity: 'Gap liquidity relation', gapConfluenceNotes: 'Gap confluence notes',
  riskPercent: 'Risk (%)', plannedRR: 'Planned R:R', result: 'Result', pnlR: 'Realized R',
  exitDate: 'Exit date', exitTime: 'Exit time', entryPrice: 'Entry price', exitPrice: 'Exit price', priceCurrency: 'Price currency', quantity: 'Size (qty)', positionValue: 'Size (value)',
  netPnl: 'Net PnL', currency: 'PnL currency', returnPercent: 'Return (%)', commission: 'Commission',
  favorableExcursion: 'Favorable excursion', adverseExcursion: 'Adverse excursion', favorableExcursionPercent: 'Favorable excursion (%)', adverseExcursionPercent: 'Adverse excursion (%)',
  reportedCumulativePnl: 'Source cumulative PnL', reportedCumulativePercent: 'Source cumulative PnL (%)', durationBars: 'Duration (bars)',
  entrySignal: 'Entry signal', exitSignal: 'Exit signal', importFormat: 'Import format', importFileName: 'Import file', importTradeNumber: 'Source trade number', importFingerprint: 'Import fingerprint',
  sourceTimezone: 'Source timezone', contextTimeframe: 'Context timeframe', executionTimeframe: 'Execution timeframe', entryTimeframe: 'Entry timeframe',
  tags: 'Tags (JSON)', notes: 'Notes', source: 'Source', tradeScope: 'Trade scope', syncStatus: 'Sync status', classificationStatus: 'Classification status',
  includedInAnalytics: 'Included in analytics', excludedReason: 'Exclusion reason', ruleBreakCount: 'Rule breaks', screenshotCount: 'Screenshot count', createdAt: 'Created at', updatedAt: 'Updated at'
} satisfies Record<keyof BacktestingTrade, string>

export function exitKind(signal?: string | null): 'SL' | 'TP' | 'OTHER' | 'UNKNOWN' {
  const value = signal?.trim().toUpperCase().replace(/[_-]+/g, ' ')
  if (!value) return 'UNKNOWN'
  if (/^(SL\d*|STOP LOSS)(\b|$)/.test(value)) return 'SL'
  if (/^(TP\d*|TAKE PROFIT)(\b|$)/.test(value)) return 'TP'
  return 'OTHER'
}

export function tradeExportRows(trades: BacktestingTrade[]): Row[] {
  return trades.map(trade => {
    const kind = exitKind(trade.exitSignal)
    const row: Row = {
      'Entry date and time': `${trade.date} ${trade.entryTime}`,
      'Exit date and time': trade.exitDate && trade.exitTime ? `${trade.exitDate} ${trade.exitTime}` : null,
      'Exit type': kind,
      'SL hit date': kind === 'SL' ? trade.exitDate : null, 'SL hit time': kind === 'SL' ? trade.exitTime : null,
      'TP hit date': kind === 'TP' ? trade.exitDate : null, 'TP hit time': kind === 'TP' ? trade.exitTime : null
    }
    for (const [field, header] of Object.entries(tradeFields)) {
      const value = trade[field as keyof BacktestingTrade]
      row[header] = Array.isArray(value) ? JSON.stringify(value) : value
    }
    return row
  })
}

const metricHeaders = ['Group', 'Condition', 'Basis', 'Group trades', 'Metric sample size', 'Coverage (%)', 'Wins', 'Losses', 'Breakevens', 'Win rate (%)',
  'Net result', 'Average result', 'Expectancy', 'Profit factor', 'Average winner', 'Average loser', 'Largest winner', 'Largest loser', 'Maximum drawdown',
  'Maximum losing streak', 'Current losing streak', 'Commission', 'Average duration (bars)', 'Average favorable excursion', 'Average adverse excursion',
  'Expectancy delta vs period', 'Manual trades', 'Imported trades', 'Screenshot trades', 'Sample size band']

function metricRows(trades: BacktestingTrade[], group: string, condition: string, baseline?: BacktestingMetric): Row[] {
  const metrics = computeResearchMetrics(trades)
  const baselineMetrics = baseline || metrics
  const common: Row = {
    Group: group, Condition: condition, 'Group trades': metrics.trades,
    'Manual trades': trades.filter(trade => trade.source === 'MANUAL').length,
    'Imported trades': trades.filter(trade => trade.source === 'IMPORT').length,
    'Screenshot trades': trades.filter(trade => trade.source === 'SCREENSHOT').length,
    'Sample size band': metrics.trades < 5 ? 'UNDER_5' : metrics.trades < 10 ? '5_TO_9' : metrics.trades < 30 ? '10_TO_29' : metrics.trades < 50 ? '30_TO_49' : '50_PLUS'
  }
  const row: Row = { ...common, Basis: 'R', 'Metric sample size': metrics.rSampleSize, 'Coverage (%)': metrics.trades ? (metrics.rSampleSize || 0) / metrics.trades * 100 : null,
    Wins: metrics.wins, Losses: metrics.losses, Breakevens: metrics.breakevens, 'Win rate (%)': metrics.trades ? metrics.winRate : null,
    'Net result': metrics.trades ? metrics.totalR : null, 'Average result': metrics.trades ? metrics.averageR : null, Expectancy: metrics.trades ? metrics.expectancy : null,
    'Profit factor': metrics.trades ? metrics.profitFactor : null, 'Average winner': metrics.trades ? metrics.averageWinR : null, 'Average loser': metrics.trades ? metrics.averageLossR : null,
    'Largest winner': metrics.trades ? metrics.largestWinR : null, 'Largest loser': metrics.trades ? metrics.largestLossR : null, 'Maximum drawdown': metrics.trades ? metrics.maximumDrawdownR : null,
    'Maximum losing streak': metrics.maximumLosingStreak, 'Current losing streak': metrics.currentLosingStreak,
    'Expectancy delta vs period': metrics.trades && metrics.expectancy != null && baselineMetrics.expectancy != null ? metrics.expectancy - baselineMetrics.expectancy : null }
  return [row, ...Object.keys(metrics.currencyMetrics || {}).sort().map(currency => {
    const cash = metrics.currencyMetrics![currency]
    const currencyTrades = trades.filter(trade => trade.currency === currency)
    const known = computeResearchMetrics(currencyTrades.filter(trade => trade.netPnl != null))
    const base = baselineMetrics.currencyMetrics?.[currency]
    return { ...common, Basis: currency, 'Metric sample size': cash.trades, 'Coverage (%)': cash.trades / currencyTrades.length * 100,
      Wins: known.wins, Losses: known.losses, Breakevens: known.breakevens, 'Win rate (%)': known.winRate,
      'Net result': cash.netPnl, 'Average result': cash.expectancy, Expectancy: cash.expectancy, 'Profit factor': cash.profitFactor,
      'Average winner': cash.averageWinner, 'Average loser': cash.averageLoser, 'Largest winner': cash.largestWinner, 'Largest loser': cash.largestLoser, 'Maximum drawdown': cash.maximumDrawdown,
      'Maximum losing streak': known.maximumLosingStreak, 'Current losing streak': known.currentLosingStreak, Commission: cash.commission,
      'Average duration (bars)': cash.averageDurationBars, 'Average favorable excursion': cash.averageFavorableExcursion, 'Average adverse excursion': cash.averageAdverseExcursion,
      'Expectancy delta vs period': cash.expectancy != null && base?.expectancy != null ? cash.expectancy - base.expectancy : null }
  })]
}

function edgeRows(trades: BacktestingTrade[], baseline: BacktestingMetric): Row[] {
  const dimensions: Array<[string, (trade: BacktestingTrade) => string[]]> = [
    ['Session', trade => [trade.session || 'Unclassified']], ['Direction', trade => [trade.direction]],
    ['Weekday', trade => [trade.weekday || new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${trade.date}T12:00:00Z`))]],
    ['Source', trade => [trade.source]], ['Setup', trade => [trade.setupName || 'Unclassified']], ['Entry timeframe', trade => [trade.entryTimeframe || 'Unclassified']],
    ['Gap type', trade => [trade.gapPresent ? trade.gapType || 'UNKNOWN' : 'NO_GAP']], ['Tag', trade => [...new Set(trade.tags || [])]]
  ]
  return dimensions.flatMap(([dimension, classify]) => {
    const groups = new Map<string, BacktestingTrade[]>()
    trades.forEach(trade => classify(trade).forEach(label => { const rows = groups.get(label) || []; rows.push(trade); groups.set(label, rows) }))
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([label, rows]) => metricRows(rows, dimension, label, baseline))
  })
}

export function buildBacktestingReport(workspace: BacktestingWorkspace, trades: BacktestingTrade[], period: ExportPeriod,
  lenses: BacktestingEdgeLens[], screenshots: BacktestingScreenshot[], generatedAt = new Date().toISOString()): Record<string, string> {
  const selected = selectExportTrades(trades, workspace.id, period)
  if (!selected.length) throw new Error('EMPTY_EXPORT_PERIOD')
  const analyzed = calendarResearchTrades(selected, workspace.id)
  const baseline = computeResearchMetrics(analyzed)
  const selectedIds = new Set(selected.map(trade => trade.id))
  const lensRows = lenses.filter(lens => lens.workspaceId === workspace.id).flatMap(lens => {
    const unsupported = Object.keys(lens.filterDefinition).filter(key => !(key in emptyResearchFilters))
    const filters = { ...emptyResearchFilters, ...lens.filterDefinition } as ResearchFilters
    const supported = !unsupported.length && Object.values(filters).every(value => typeof value === 'string')
    const context: Row = { 'Lens ID': lens.id, 'Lens name': lens.name, Description: lens.description,
      'Filters (JSON)': JSON.stringify(lens.filterDefinition), Status: supported ? 'RECALCULATED_FOR_EXPORT_PERIOD' : 'UNSUPPORTED_FILTERS',
      'Unsupported filters': unsupported.join(', ') }
    return supported ? metricRows(filterResearchTrades(analyzed, filters), 'Saved lens', lens.name, baseline).map(row => ({ ...context, ...row })) : [context]
  })
  const periods = (['day', 'week', 'month'] as const).flatMap(unit => groupCalendarPeriods(analyzed, unit)
    .flatMap(group => metricRows(group.trades, unit, `${group.start} / ${group.end}`, baseline).map(row => ({ 'Period start': group.start, 'Period end': group.end, ...row }))))
  const screenshotHeaders = ['Screenshot ID', 'Trade ID', 'Original filename', 'Content type', 'Size (bytes)', 'Caption', 'Result', 'Session', 'Timeframe', 'Tags (JSON)', 'Created at', 'Updated at']
  const screenshotRows = screenshots.filter(item => item.workspaceId === workspace.id && item.backtestingTradeId && selectedIds.has(item.backtestingTradeId))
    .map(item => ({ 'Screenshot ID': item.id, 'Trade ID': item.backtestingTradeId, 'Original filename': item.originalFileName, 'Content type': item.contentType,
      'Size (bytes)': item.sizeBytes, Caption: item.caption, Result: item.tradeResult, Session: item.session, Timeframe: item.timeframe,
      'Tags (JSON)': JSON.stringify(item.tags), 'Created at': item.createdAt, 'Updated at': item.updatedAt }))
  return {
    'trades.csv': rowsToCsv(tradeExportRows(selected)),
    'overview.csv': rowsToCsv(metricRows(analyzed, 'Overview', workspace.title || workspace.symbol), metricHeaders),
    'edge-analysis.csv': rowsToCsv(edgeRows(analyzed, baseline), metricHeaders),
    'periods.csv': rowsToCsv(periods, ['Period start', 'Period end', ...metricHeaders]),
    'saved-edge-lenses.csv': rowsToCsv(lensRows, ['Lens ID', 'Lens name', 'Description', 'Filters (JSON)', 'Status', 'Unsupported filters', ...metricHeaders]),
    'screenshots.csv': rowsToCsv(screenshotRows, screenshotHeaders),
    'workspace.json': JSON.stringify({ schemaVersion: 1, generatedAt, period, exportedTrades: selected.length, analyzedTrades: analyzed.length,
      excludedTrades: selected.length - analyzed.length, missingR: analyzed.filter(trade => trade.pnlR == null).length,
      missingCash: analyzed.filter(trade => trade.netPnl == null || !trade.currency).length,
      unknownTimezone: selected.filter(trade => !trade.sourceTimezone).length,
      workspace, workspaceStatisticsScope: 'ALL_TIME_SNAPSHOT_NOT_SELECTED_PERIOD' }, null, 2),
    'README.txt': [
      `Backtesting export: ${workspace.title || workspace.symbol}`, `Generated at (UTC): ${generatedAt}`,
      `Inclusive ${period.dateBasis} date period: ${period.from} to ${period.to}. Dates use each trade's recorded local clock.`,
      `Exported trades: ${selected.length}. Analytics trades: ${analyzed.length}. Excluded trades retained in trades.csv: ${selected.length - analyzed.length}.`,
      'trades.csv: one row per trade, with entry and exit details and every available API trade field. Live trades are excluded.',
      'overview.csv and edge-analysis.csv: recomputed from included trades in the selected period; saved lifetime analytics are not reused.',
      'periods.csv: daily, Monday-Sunday weekly and monthly groups using exit date, falling back to entry date when exit date is absent.',
      'Period groups contain only this export sample; boundary weeks/months may be partial and entry-period selection can include later exits.',
      'saved-edge-lenses.csv: saved filter definitions applied within the export sample, including their own saved entry-date bounds. Unsupported filters are explicitly flagged.',
      'screenshots.csv: metadata for screenshots linked to exported trades. Image files and temporary signed URLs are not included.',
      'workspace.json: workspace notes, strategy context, export settings and coverage. Workspace statistics are an all-time snapshot; overview.csv contains period results.',
      'SL/TP hit date and time use only an explicit SL/TP exit signal and recorded exit timestamp. Result alone does not establish an SL/TP hit.',
      'Planned SL/TP prices and order placement/amendment timestamps are not stored by this trade model and cannot be exported.',
      'Missing fields are blank. Source timezone is blank when unspecified; no timezone conversion is applied. Gap timestamps contain time only as stored.',
      'Planned R:R and realized R are separate stored fields. R is never inferred from cash, outcome, prices or planned R:R.',
      'R totals, expectancy and drawdown are blank when R coverage is incomplete. Empty analytics samples have blank performance values.',
      'Cash results use known net PnL separately for each currency without FX conversion. Cash coverage is known PnL / trades with that currency.',
      'Metric sample size identifies the known-value sample. Cash win rate uses outcomes of that sample. missingCash in workspace.json also counts unknown currencies.',
      'Commission and excursions use the stored PnL currency. Price currency is stored independently from the source price header; older rows may be unspecified. Position-value currency is not separately recorded.',
      'Profit factor is blank when profits exist without losses. Net PnL already includes reported costs; commission is not subtracted again.',
      'Source cumulative PnL is preserved as reported by the import and is not reset to this period.',
      'Edge groups and tags overlap; do not sum across dimensions. Sample size bands describe counts and do not establish a validated trading edge.',
      'CSV files use UTF-8 with BOM, comma separators, quoted fields, ISO dates and decimal points. Text starting with spreadsheet formula characters is prefixed with an apostrophe.'
    ].join('\r\n') + '\r\n'
  }
}

export function reportArchive(files: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])), { level: 6 })
}

export function exportFilename(workspace: BacktestingWorkspace, period: ExportPeriod, extension: 'zip' | 'csv') {
  const name = (workspace.title || workspace.symbol).replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 90) || 'workspace'
  return `backtesting-${name}-${period.dateBasis}-${period.from}-${period.to}.${extension}`
}

export function downloadExport(data: BlobPart, filename: string, contentType: string) {
  const url = URL.createObjectURL(new Blob([data], { type: contentType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  try { link.click() } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

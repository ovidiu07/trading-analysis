import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { BacktestingEdgeLens, BacktestingScreenshot, BacktestingTrade, BacktestingWorkspace } from '../../api/backtesting'
import { buildBacktestingReport, csvCell, exitKind, exportFilename, reportArchive, rowsToCsv, selectExportTrades, tradeExportRows, validExportDate, type ExportPeriod } from './export'
import { emptyResearchFilters } from './research'

const workspace = { id: 'workspace-1', title: 'GER40 Research / Test', symbol: 'GER40', notes: 'Keep the original notes', totalR: 999 } as BacktestingWorkspace
const period: ExportPeriod = { from: '2026-10-01', to: '2026-10-14', dateBasis: 'entry' }
const trade = (id: string, overrides: Partial<BacktestingTrade> = {}): BacktestingTrade => ({
  id, workspaceId: workspace.id, date: '2026-10-02', entryTime: '18:00:00', exitDate: '2026-10-02', exitTime: '18:20:00',
  instrument: 'PEPPERSTONE:GER40F', direction: 'LONG', result: 'WIN', pnlR: 1.5, plannedRR: 1.5, netPnl: 150, currency: 'USD', commission: 0,
  source: 'IMPORT', tradeScope: 'REPLAY', includedInAnalytics: true, tags: ['FVG'], entryPrice: 24490.7, exitPrice: 24511.7,
  exitSignal: 'TP', favorableExcursion: 152.55, adverseExcursion: -58.84, reportedCumulativePnl: 700, ...overrides
})

// Parse the actual CSV output, including embedded commas, quotes and newlines.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (index === 0 && char === '\uFEFF') continue
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++ } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if (char === '\r' && !quoted && text[index + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; index++ }
    else cell += char
  }
  const [headers, ...data] = rows
  return data.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]])))
}

describe('backtesting CSV export', () => {
  it('validates calendar dates and inclusive period bounds', () => {
    expect(validExportDate('2026-02-30')).toBe(false)
    expect(validExportDate('2024-02-29')).toBe(true)
    expect(validExportDate('14/10/2026')).toBe(false)
    expect(() => selectExportTrades([], workspace.id, { ...period, from: '2026-10-15' })).toThrow('INVALID_EXPORT_PERIOD')
    const rows = [trade('last', { date: period.to }), trade('before', { date: '2026-09-30' }), trade('first', { date: period.from }), trade('after', { date: '2026-10-15' })]
    expect(selectExportTrades(rows, workspace.id, period).map(row => row.id)).toEqual(['first', 'last'])
  })

  it('isolates the workspace and backtest/replay scopes while retaining excluded details', () => {
    const rows = [trade('valid'), trade('excluded', { includedInAnalytics: false }), trade('other', { workspaceId: 'other' }),
      trade('live-source', { source: 'LIVE' }), trade('live-scope', { tradeScope: 'LIVE' }), trade('manual', { source: 'MANUAL', tradeScope: 'BACKTEST' })]
    expect(selectExportTrades(rows, workspace.id, period).map(row => row.id).sort()).toEqual(['excluded', 'manual', 'valid'])
    const files = buildBacktestingReport(workspace, rows, period, [], [])
    expect(parseCsv(files['trades.csv'])).toHaveLength(3)
    expect(parseCsv(files['overview.csv'])[0]['Group trades']).toBe('2')
    expect(JSON.parse(files['workspace.json']).excludedTrades).toBe(1)
  })

  it('supports entry or recorded exit dates and optional filters without leaking workspace date bounds', () => {
    const rows = [trade('crossing', { date: '2026-09-30', exitDate: '2026-10-01' }), trade('no-exit', { exitDate: null }), trade('loser', { result: 'LOSS' })]
    expect(selectExportTrades(rows, workspace.id, { ...period, dateBasis: 'exit' }).map(row => row.id).sort()).toEqual(['crossing', 'loser'])
    expect(selectExportTrades(rows, workspace.id, { ...period, filters: { ...emptyResearchFilters, result: 'LOSS', dateFrom: '2030-01-01' } }).map(row => row.id)).toEqual(['loser'])
  })

  it('exports all stored details and derives SL/TP timestamps only from explicit signals', () => {
    const rows = tradeExportRows([trade('tp'), trade('sl', { exitSignal: 'SL', result: 'LOSS', pnlR: -1 }),
      trade('unknown', { exitSignal: null }), trade('manual-exit', { exitSignal: 'Close entry(s) order LONG' }), trade('no-time', { exitTime: null })])
    expect(rows[0]['TP hit date']).toBe('2026-10-02')
    expect(rows[0]['SL hit date']).toBeNull()
    expect(rows[1]['SL hit time']).toBe('18:20:00')
    expect(rows[2]['TP hit date']).toBeNull()
    expect(rows[3]['TP hit date']).toBeNull()
    expect(rows[4]['Exit date and time']).toBeNull()
    expect(tradeExportRows([trade('currency', { priceCurrency: 'EUR' })])[0]['Price currency']).toBe('EUR')
    expect(rows[0]).toMatchObject({ 'Entry price': 24490.7, 'Favorable excursion': 152.55, 'Adverse excursion': -58.84, 'Source cumulative PnL': 700, 'Planned R:R': 1.5, 'Realized R': 1.5, 'PnL currency': 'USD' })
    expect(exitKind('TP1')).toBe('TP')
    expect(exitKind('Stop-loss')).toBe('SL')
    expect(exitKind('SLOW_EXIT')).toBe('OTHER')
  })

  it('escapes spreadsheet formulas and preserves numeric losses, Unicode and multiline notes', () => {
    expect(csvCell(-99.02)).toBe('"-99.02"')
    for (const value of ['=HYPERLINK("url")', '+SUM(1,2)', '-2+4', '@SUM(1,2)', '  =1+1', '\t=1+1', '\n=1+1']) expect(csvCell(value)).toMatch(/^"'/)
    expect(csvCell(Number.NaN)).toBe('""')
    const notes = 'Observații, "FVG"\nA doua linie'
    expect(parseCsv(rowsToCsv([{ Notes: notes, Loss: -99.02 }]))).toEqual([{ Notes: notes, Loss: '-99.02' }])
  })

  it('exports FVG source geometry, timing and independent profit-lock settings as dedicated columns', () => {
    const entrySignal = 'SHORT GER / 2 | FVGv1 tf=5 lo=19198.5 hi=19210.0 size=11.5 sizePct=0.0599 created=1728397200000 mode=TOUCH depth=0 rr=3 BE=90/30'
    const source = trade('fvg', { direction: 'SHORT', entryPrice: 19198.5, entrySignal,
      exitSignal: 'SL | fillPct=0 fillBars=1 touchBars=1 ageMin=0', pnlR: null, plannedRR: null,
      gapPresent: true, gapHigh: 19210, gapLow: 19198.5, gapSizePoints: null })
    const [row] = parseCsv(rowsToCsv(tradeExportRows([source])))
    expect(row).toMatchObject({ 'FVG metadata status': 'AVAILABLE', 'Gap present': 'true', 'Gap high': '19210', 'Gap low': '19198.5',
      'FVG created (UTC)': '2024-10-08T14:20:00.000Z', 'FVG size (price units)': '11.5', 'Gap size (points)': '',
      'FVG entry mode': 'TOUCH', 'FVG planned entry depth (%)': '0', 'FVG actual fill depth (%)': '0',
      'FVG bars from creation to entry': '1', 'FVG bars from creation to first touch': '1', 'FVG minutes from creation to entry': '0',
      'FVG configured R:R': '3', 'FVG BE enabled': 'true', 'FVG BE trigger (% of entry-to-TP)': '90',
      'FVG BE protected profit (% of entry-to-TP)': '30', 'Planned R:R': '', 'Realized R': '', 'Exit type': 'SL', 'Entry signal': entrySignal })
    expect(source.gapSizePoints).toBeNull()
  })

  it('leaves missing same-candle ages blank and computes actual depth without clamping', () => {
    const source = trade('fvg', { entryPrice: 19187, entrySignal: 'LONG GER / 1 | FVGv1 tf=5 lo=19198.5 hi=19210 size=11.5 sizePct=0.0599 created=1728397200000 mode=DEPTH depth=25 rr=3 BE=OFF', exitSignal: 'TP' })
    const [row] = parseCsv(rowsToCsv(tradeExportRows([source])))
    expect(row).toMatchObject({ 'FVG metadata status': 'AVAILABLE', 'FVG actual fill depth (%)': '200',
      'FVG planned entry depth (%)': '25', 'FVG bars from creation to entry': '', 'FVG bars from creation to first touch': '',
      'FVG minutes from creation to entry': '', 'FVG BE enabled': 'false', 'FVG BE trigger (% of entry-to-TP)': '' })
  })

  it('does not fabricate FVG diagnostics from old, live, unknown-version or invalid signals', () => {
    const signal = 'LONG GER / 1 | FVGv1 tf=5 lo=100 hi=110 size=10 sizePct=10 created=1728397200000 mode=TOUCH depth=0 rr=3 BE=90/30'
    const rows = tradeExportRows([trade('legacy', { entrySignal: 'LONG GER / 1' }), trade('v2', { entrySignal: signal.replace('FVGv1', 'FVGv2') }),
      trade('live', { entrySignal: signal, source: 'LIVE' }), trade('bad', { entrySignal: signal.replace('size=10', 'size=11') }),
      trade('duplicate-token', { entrySignal: signal + ' lo=1' })])
    expect(rows.map(row => row['FVG metadata status'])).toEqual(['MISSING', 'MISSING', 'MISSING', 'INVALID', 'INVALID'])
    expect(rows.every(row => row['FVG created (UTC)'] == null && row['FVG size (price units)'] == null)).toBe(true)
  })

  it('recalculates period R and cash metrics without borrowing lifetime totals or mixing currencies', () => {
    const files = buildBacktestingReport(workspace, [trade('win'), trade('loss', { pnlR: -1, result: 'LOSS', netPnl: -100 }), trade('eur', { netPnl: 20, currency: 'EUR', pnlR: 0, result: 'BREAKEVEN' })], period, [], [])
    const overview = parseCsv(files['overview.csv'])
    expect(overview.find(row => row.Basis === 'R')).toMatchObject({ 'Net result': '0.5', 'Metric sample size': '3', 'Maximum drawdown': '1' })
    expect(overview.find(row => row.Basis === 'USD')).toMatchObject({ 'Net result': '50', 'Metric sample size': '2', 'Profit factor': '1.5' })
    expect(overview.find(row => row.Basis === 'EUR')['Net result']).toBe('20')
    expect(JSON.parse(files['workspace.json']).workspace.totalR).toBe(999)
    expect(JSON.parse(files['workspace.json']).workspaceStatisticsScope).toBe('ALL_TIME_SNAPSHOT_NOT_SELECTED_PERIOD')
  })

  it('leaves incomplete R unavailable and exposes partial and missing cash coverage', () => {
    const files = buildBacktestingReport(workspace, [trade('known'), trade('unknown-r', { pnlR: null, netPnl: null }), trade('unknown-currency', { netPnl: 12, currency: null })], period, [], [])
    const overview = parseCsv(files['overview.csv'])
    expect(overview.find(row => row.Basis === 'R')).toMatchObject({ 'Net result': '', Expectancy: '', 'Maximum drawdown': '', 'Metric sample size': '2' })
    expect(overview.find(row => row.Basis === 'USD')).toMatchObject({ 'Net result': '150', 'Coverage (%)': '50' })
    expect(JSON.parse(files['workspace.json'])).toMatchObject({ missingR: 1, missingCash: 2 })
  })

  it('recomputes saved lenses within the period and flags unsupported filter definitions', () => {
    const lenses = [
      { id: 'long', workspaceId: workspace.id, name: 'Long trades', filterDefinition: { direction: 'LONG' }, metrics: { trades: 900 } },
      { id: 'unsupported', workspaceId: workspace.id, name: 'Future filter', filterDefinition: { unknownField: 'x' } },
      { id: 'other', workspaceId: 'other', name: 'Other workspace', filterDefinition: {} }
    ] as BacktestingEdgeLens[]
    const files = buildBacktestingReport(workspace, [trade('long'), trade('short', { direction: 'SHORT' }), trade('old', { date: '2020-01-01' })], period, lenses, [])
    const rows = parseCsv(files['saved-edge-lenses.csv'])
    expect(rows.find(row => row['Lens ID'] === 'long' && row.Basis === 'R')).toMatchObject({ 'Group trades': '1', Status: 'RECALCULATED_FOR_EXPORT_PERIOD' })
    expect(rows.find(row => row['Lens ID'] === 'unsupported')).toMatchObject({ Status: 'UNSUPPORTED_FILTERS', 'Net result': '' })
    expect(rows.some(row => row['Lens ID'] === 'other')).toBe(false)
  })

  it('groups periods by realized date and edge dimensions without including excluded trades', () => {
    const files = buildBacktestingReport(workspace, [trade('one', { session: 'London', exitDate: '2026-10-05', tags: ['FVG', 'FVG'] }),
      trade('excluded', { includedInAnalytics: false, session: 'Excluded' })], period, [], [])
    const edge = parseCsv(files['edge-analysis.csv'])
    expect(edge.find(row => row.Group === 'Tag' && row.Basis === 'R')['Group trades']).toBe('1')
    expect(edge.some(row => row.Condition === 'Excluded')).toBe(false)
    expect(parseCsv(files['periods.csv']).find(row => row.Group === 'week' && row.Basis === 'R')).toMatchObject({ 'Period start': '2026-10-05', 'Period end': '2026-10-11' })
  })

  it('does not represent empty analytics as zero performance and rejects an empty export', () => {
    const files = buildBacktestingReport(workspace, [trade('excluded', { includedInAnalytics: false })], period, [], [])
    expect(parseCsv(files['overview.csv'])[0]).toMatchObject({ 'Group trades': '0', 'Net result': '', 'Win rate (%)': '', Expectancy: '' })
    expect(() => buildBacktestingReport(workspace, [], period, [], [])).toThrow('EMPTY_EXPORT_PERIOD')
  })

  it('creates a readable ZIP and includes only linked screenshot metadata for selected trades', () => {
    const screenshots = [{ id: 'image', workspaceId: workspace.id, backtestingTradeId: 'one', originalFileName: 'chart.png', tags: ['FVG'], viewUrl: 'https://private.test/signed-token' },
      { id: 'unlinked', workspaceId: workspace.id, backtestingTradeId: null }, { id: 'outside', workspaceId: workspace.id, backtestingTradeId: 'outside' }] as BacktestingScreenshot[]
    const files = buildBacktestingReport(workspace, [trade('one')], period, [], screenshots, '2026-10-14T10:00:00Z')
    const unpacked = unzipSync(reportArchive(files))
    expect(Object.keys(unpacked)).toHaveLength(8)
    expect([...unpacked['trades.csv'].slice(0, 3)]).toEqual([239, 187, 191])
    expect(strFromU8(unpacked['trades.csv'])).toBe(files['trades.csv'].slice(1))
    expect(parseCsv(strFromU8(unpacked['screenshots.csv']))).toHaveLength(1)
    expect(files['screenshots.csv']).not.toContain('signed-token')
    expect(exportFilename(workspace, period, 'zip')).toBe('backtesting-GER40-Research-Test-entry-2026-10-01-2026-10-14.zip')
  })
})

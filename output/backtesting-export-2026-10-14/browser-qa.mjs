import { chromium } from '/Users/ovidiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = '/Users/ovidiu/Documents/trading-analysis'
const output = `${root}/output/backtesting-export-2026-10-14`
const require = createRequire(`${root}/frontend/package.json`)
const { unzipSync, strFromU8 } = require('fflate')
function readCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  text = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++ } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if (char === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [headers, ...data] = rows
  return data.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]])))
}
const sourceFile = '/Users/ovidiu/Downloads/Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_d9b67.csv'
const source = readCsv(readFileSync(sourceFile, 'utf8'))
const trades = source.filter(row => row.Type.startsWith('Exit')).map(row => {
  const entry = source.find(candidate => candidate['Trade number'] === row['Trade number'] && candidate.Type.startsWith('Entry'))
  assert(entry)
  const netPnl = Number(row['Net PnL USD'])
  return { id: `fixture-${row['Trade number']}`, workspaceId: 'export-qa', date: entry['Date and time'].slice(0, 10), entryTime: entry['Date and time'].slice(11),
    exitDate: row['Date and time'].slice(0, 10), exitTime: row['Date and time'].slice(11), instrument: 'PEPPERSTONE:GER40F',
    direction: row.Type.endsWith('long') ? 'LONG' : 'SHORT', result: netPnl > 0 ? 'WIN' : netPnl < 0 ? 'LOSS' : 'BREAKEVEN',
    pnlR: null, netPnl, currency: 'USD', commission: Number(row['Commission USD']), tags: [], source: 'IMPORT', tradeScope: 'REPLAY',
    importFormat: 'TRADINGVIEW_REPLAY', importTradeNumber: row['Trade number'], importFileName: sourceFile.split('/').pop(),
    entryPrice: Number(entry['Price EUR']), exitPrice: Number(row['Price EUR']), quantity: Number(row['Size (qty)']), positionValue: Number(row['Size (value)']),
    returnPercent: Number(row['Return %']), favorableExcursion: Number(row['Favorable excursion USD']), adverseExcursion: Number(row['Adverse excursion USD']),
    favorableExcursionPercent: Number(row['Favorable excursion %']), adverseExcursionPercent: Number(row['Adverse excursion %']),
    reportedCumulativePnl: Number(row['Cumulative PnL USD']), reportedCumulativePercent: Number(row['Cumulative PnL %']), durationBars: Number(row['Duration (bars)']),
    entrySignal: entry.Signal, exitSignal: row.Signal, includedInAnalytics: true, classificationStatus: 'PARTIAL' }
})
const workspace = { id: 'export-qa', title: 'Five Sessions GER40 Replay', symbol: 'GER40', strategyNameSnapshot: 'Five Sessions FVG Windows',
  numberOfTrades: trades.length, winningTrades: trades.filter(trade => trade.result === 'WIN').length, losingTrades: trades.filter(trade => trade.result === 'LOSS').length,
  breakevenTrades: 0, winRate: trades.filter(trade => trade.result === 'WIN').length / trades.length * 100, lossRate: trades.filter(trade => trade.result === 'LOSS').length / trades.length * 100,
  breakevenRate: 0, categorizedTrades: trades.length, missingClassificationCount: trades.length, importedTradeCount: trades.length, screenshotCount: 0,
  status: 'ACTIVE', evidenceStatus: 'EXPLORATORY', evidenceConfidence: 'LOW' }
const checks = []
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const variant of [
    { name: 'desktop-en-dark', width: 1440, height: 1100, language: 'en', theme: 'DARK' },
    { name: 'tablet-en-light', width: 768, height: 1024, language: 'en', theme: 'LIGHT' },
    { name: 'mobile-ro-light', width: 390, height: 844, language: 'ro', theme: 'LIGHT' },
    { name: 'mobile-en-dark', width: 375, height: 812, language: 'en', theme: 'DARK' }
  ]) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, timezoneId: 'Europe/Bucharest', acceptDownloads: true })
    await context.addInitScript(({ language, theme }) => {
      localStorage.setItem('token', 'isolated-ui-fixture')
      localStorage.setItem('app.language', language)
      localStorage.setItem('app.themePreference', theme.toLowerCase())
      localStorage.setItem('app.analyticsConsent', 'denied')
    }, variant)
    const page = await context.newPage()
    page.setDefaultTimeout(12000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (!url.pathname.startsWith('/api/')) return url.hostname === '127.0.0.1' ? route.continue() : route.abort()
      const path = url.pathname.slice(4)
      let data
      if (path === '/users/me') data = { id: 'qa-user', email: 'fixture@example.test', role: 'USER', baseCurrency: 'USD', timezone: 'Europe/Bucharest', themePreference: variant.theme }
      else if (path === '/backtesting/workspaces') data = { summary: { totalBacktests: 1, totalTradesTested: 25, averageWinRate: workspace.winRate }, workspaces: [workspace] }
      else if (path === '/backtesting/workspaces/export-qa') data = workspace
      else if (path === '/backtesting/workspaces/export-qa/trades') data = trades
      else if (path === '/backtesting/workspaces/export-qa/analytics') data = { baseline: {}, breakdowns: {}, impactRows: [], sourceMetrics: {}, recentLiveSampleSize: 0, regressionStatus: 'INSUFFICIENT_LIVE_DATA' }
      else if (path === '/backtesting/research-inbox') data = { total: 0, items: [] }
      else if (path === '/strategies') data = { myStrategies: [], mentorStrategies: [] }
      else if (path === '/notifications/unread-count') data = { unreadCount: 0 }
      else if (path === '/notifications/stream') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': fixture\n\n' })
      else if (path === '/me/demo-status') data = { demoEnabled: false, hasDemoData: false }
      else data = []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    const ro = variant.language === 'ro'
    await page.goto('http://127.0.0.1:5184/backtesting/export-qa')
    await page.getByRole('heading', { name: workspace.title }).waitFor()
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    assert(overflow.document <= overflow.viewport, JSON.stringify(overflow))
    await page.getByRole('button', { name: ro ? 'Exportă datele' : 'Export data', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: ro ? 'Exportă datele de backtesting' : 'Export backtesting data' })
    await dialog.waitFor()
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.MuiDialog-container')).opacity === '1')
    assert((await dialog.innerText()).includes(ro ? '25 tranzacții de exportat' : '25 trades to export'))
    await dialog.screenshot({ path: `${output}/${variant.name}.png`, animations: 'disabled' })
    const dialogBox = await dialog.boundingBox()
    assert(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= variant.width + 1)
    const from = dialog.getByLabel(ro ? 'Export de la' : 'Export from', { exact: true })
    const to = dialog.getByLabel(ro ? 'Export până la' : 'Export to', { exact: true })
    const downloadButton = dialog.getByRole('button', { name: ro ? 'Descarcă exportul' : 'Download export', exact: true })
    await from.fill('2025-11-01')
    assert(await downloadButton.isDisabled())
    await from.fill('2025-10-06')
    await to.fill('2025-10-06')
    const expected = trades.filter(trade => trade.date === '2025-10-06')
    const downloadPromise = page.waitForEvent('download')
    await downloadButton.click()
    const download = await downloadPromise
    assert(download.suggestedFilename().endsWith('-entry-2025-10-06-2025-10-06.zip'))
    const zipPath = `${output}/${variant.name}-sample.zip`
    await download.saveAs(zipPath)
    const files = unzipSync(readFileSync(zipPath))
    assert.equal(Object.keys(files).length, 8)
    const exported = readCsv(strFromU8(files['trades.csv']))
    assert.equal(exported.length, expected.length)
    const fields = { 'Entry date': 'date', 'Entry time': 'entryTime', 'Exit date': 'exitDate', 'Exit time': 'exitTime',
      'Entry price': 'entryPrice', 'Exit price': 'exitPrice', 'Net PnL': 'netPnl', 'PnL currency': 'currency', 'Favorable excursion': 'favorableExcursion',
      'Adverse excursion': 'adverseExcursion', 'Size (qty)': 'quantity', 'Size (value)': 'positionValue', 'Return (%)': 'returnPercent',
      Commission: 'commission', 'Duration (bars)': 'durationBars', 'Entry signal': 'entrySignal', 'Exit signal': 'exitSignal',
      'Source cumulative PnL': 'reportedCumulativePnl', 'Source cumulative PnL (%)': 'reportedCumulativePercent' }
    for (const row of exported) {
      const original = expected.find(trade => trade.id === row['Trade ID'])
      assert(original)
      for (const [header, field] of Object.entries(fields)) assert.equal(row[header], String(original[field]), `${header} for ${original.id}`)
      assert.equal(row[original.exitSignal === 'SL' ? 'SL hit date' : 'TP hit date'], original.exitDate)
      assert.equal(row[original.exitSignal === 'SL' ? 'SL hit time' : 'TP hit time'], original.exitTime)
      assert.equal(row['Realized R'], '')
    }
    const overview = readCsv(strFromU8(files['overview.csv']))
    assert.equal(overview.find(row => row.Basis === 'R')['Net result'], '')
    assert.equal(Number(overview.find(row => row.Basis === 'USD')['Net result']), Number(expected.reduce((sum, trade) => sum + trade.netPnl, 0).toFixed(2)))
    await page.getByRole('button', { name: ro ? 'Exportă datele' : 'Export data', exact: true }).click()
    await page.getByRole('combobox', { name: ro ? 'Formatul exportului' : 'Export format' }).click()
    await page.getByRole('option', { name: ro ? 'Doar detaliile tranzacțiilor (CSV)' : 'Trade details only (CSV)' }).click()
    const csvPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: ro ? 'Descarcă exportul' : 'Download export', exact: true }).click()
    const csvDownload = await csvPromise
    const csvPath = `${output}/${variant.name}-all-trades.csv`
    await csvDownload.saveAs(csvPath)
    const allExported = readCsv(readFileSync(csvPath, 'utf8'))
    assert.equal(allExported.length, 25)
    for (const row of allExported) {
      const original = trades.find(trade => trade.id === row['Trade ID'])
      for (const [header, field] of Object.entries(fields)) assert.equal(row[header], String(original[field]), `${header} for ${original.id}`)
    }
    assert.equal(errors.length, 0, errors.join('\n'))
    checks.push({ ...variant, sourceTrades: 25, selectedTrades: expected.length, zipFiles: Object.keys(files), csvTrades: 25, overflow, errors })
    await context.close()
  }
} finally { await browser.close() }
writeFileSync(`${output}/browser-checks.json`, JSON.stringify({ proof: 'Local UI with mocked API records derived from the user CSV; no authenticated provider, backend persistence or deployment proof.', checks }, null, 2))
console.log(JSON.stringify(checks, null, 2))

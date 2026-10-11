import { chromium } from '/Users/ovidiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const root = '/Users/ovidiu/Documents/trading-analysis'
const output = `${root}/output/backtesting-calendar-2026-10-11`
const lines = readFileSync(`${root}/backend/src/test/resources/backtesting/tradingview-replay-ger40f.csv`, 'utf8').trim().split(/\r?\n/).slice(1).map(line => line.split(','))
const trades = lines.filter(row => row[1].startsWith('Exit')).map((row, index) => {
  const entry = lines[index * 2]
  return { id: `fixture-${index}`, workspaceId: 'calendar-qa', date: entry[2].slice(0, 10), entryTime: entry[2].slice(11), exitDate: row[2].slice(0, 10), exitTime: row[2].slice(11),
    instrument: 'PEPPERSTONE:GER40F', direction: row[1].endsWith('long') ? 'LONG' : 'SHORT', result: Number(row[7]) > 0 ? 'WIN' : 'LOSS',
    pnlR: null, netPnl: Number(row[7]), currency: 'EUR', commission: Number(row[9]), tags: [], source: 'IMPORT', tradeScope: 'REPLAY', importFormat: 'TRADINGVIEW_REPLAY',
    quantity: Number(row[5]), entryPrice: Number(entry[4]), exitPrice: Number(row[4]), favorableExcursion: Number(row[10]), adverseExcursion: Number(row[12]), durationBars: Number(row[16]),
    entrySignal: entry[3], exitSignal: row[3], importFileName: 'tradingview-replay-ger40f.csv', includedInAnalytics: true, classificationStatus: 'COMPLETE' }
})
const workspace = { id: 'calendar-qa', title: 'GER40 Replay Research', symbol: 'GER40', strategyNameSnapshot: 'Liquidity research',
  numberOfTrades: 25, winningTrades: 15, losingTrades: 10, breakevenTrades: 0, winRate: 60, lossRate: 40, breakevenRate: 0, categorizedTrades: 25,
  missingClassificationCount: 0, importedTradeCount: 25, screenshotCount: 0, status: 'ACTIVE', evidenceStatus: 'EARLY_SIGNAL', evidenceConfidence: 'LOW', updatedAt: '2026-10-11T10:00:00Z' }
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const checks = []
try {
  for (const variant of [
    { name: 'desktop-en-dark', width: 1440, height: 1100, language: 'en', theme: 'DARK' },
    { name: 'tablet-en-light', width: 768, height: 1024, language: 'en', theme: 'LIGHT' },
    { name: 'mobile-ro-light', width: 390, height: 844, language: 'ro', theme: 'LIGHT' },
    { name: 'mobile-en-dark', width: 375, height: 812, language: 'en', theme: 'DARK' }
  ]) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, locale: variant.language === 'ro' ? 'ro-RO' : 'en-US', timezoneId: 'Europe/Bucharest' })
    await context.addInitScript(({ language, theme }) => {
      localStorage.setItem('token', 'isolated-ui-fixture')
      localStorage.setItem('app.language', language)
      localStorage.setItem('app.themePreference', theme.toLowerCase())
      localStorage.setItem('app.analyticsConsent', 'denied')
    }, variant)
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.hostname !== '127.0.0.1') return route.abort()
      if (!url.pathname.startsWith('/api/')) return route.continue()
      const path = url.pathname.slice(4)
      let data
      if (path === '/users/me') data = { id: 'qa-user', email: 'fixture@example.test', role: 'USER', baseCurrency: 'EUR', timezone: 'Europe/Bucharest', themePreference: variant.theme }
      else if (path === '/backtesting/workspaces') data = { summary: { totalBacktests: 1, totalTradesTested: 25, averageWinRate: 60 }, workspaces: [workspace] }
      else if (path === '/backtesting/workspaces/calendar-qa') data = workspace
      else if (path === '/backtesting/workspaces/calendar-qa/trades') data = trades
      else if (path === '/backtesting/workspaces/calendar-qa/analytics') data = { baseline: {}, breakdowns: {}, impactRows: [], sourceMetrics: {}, recentLiveSampleSize: 0, regressionStatus: 'INSUFFICIENT_LIVE_DATA' }
      else if (path === '/backtesting/research-inbox') data = { total: 0, items: [] }
      else if (path === '/strategies') data = { myStrategies: [], mentorStrategies: [] }
      else if (path === '/notifications/unread-count') data = { unreadCount: 0 }
      else if (path === '/notifications/stream') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': fixture\n\n' })
      else if (path === '/me/demo-status') data = { demoEnabled: false, hasDemoData: false }
      else data = []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    })
    await page.goto('http://127.0.0.1:5174/backtesting/calendar-qa')
    await page.getByRole('heading', { name: 'GER40 Replay Research' }).waitFor()
    if (variant.width < 600) {
      await page.getByRole('combobox', { name: variant.language === 'ro' ? 'Secțiunile spațiului de backtesting' : 'Backtesting workspace sections' }).click()
      await page.getByRole('option', { name: 'Calendar', exact: true }).click()
    } else await page.getByRole('tab', { name: 'Calendar', exact: true }).click()
    await page.getByRole('heading', { name: variant.language === 'ro' ? 'Calendar de backtesting' : 'Backtesting calendar' }).waitFor()
    const body = await page.locator('body').innerText()
    assert(body.includes(variant.language === 'ro' ? 'Cele mai bune săptămâni' : 'Best weeks'))
    assert(body.includes(variant.language === 'ro' ? 'Cele mai bune luni' : 'Best months'))
    const weekly = page.getByRole(variant.width < 560 ? 'list' : 'table', { name: variant.language === 'ro' ? 'Performanță săptămânală' : 'Weekly performance' })
    assert.equal(await weekly.locator(variant.width < 560 ? 'li' : 'tbody tr').count(), 5)
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
    assert(overflow.document <= overflow.viewport, JSON.stringify(overflow))
    await page.screenshot({ path: `${output}/${variant.name}.png`, fullPage: true, animations: 'disabled' })
    await weekly.screenshot({ path: `${output}/${variant.name}-weekly.png`, animations: 'disabled' })
    await page.getByRole('heading', { name: variant.language === 'ro' ? 'Calendar de backtesting' : 'Backtesting calendar' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${output}/${variant.name}-viewport.png`, animations: 'disabled' })
    const day = page.getByRole('button', { name: variant.language === 'ro' ? /^Vezi tranzacțiile de backtest din 2025-10-06/ : /^View backtested trades for 2025-10-06/ })
    await day.click()
    await page.getByRole('dialog').waitFor()
    const dialogText = await page.getByRole('dialog').innerText()
    assert(dialogText.includes('PEPPERSTONE:GER40F'))
    await page.getByRole('dialog').screenshot({ path: `${output}/${variant.name}-day.png`, animations: 'disabled' })
    const dialogBox = await page.getByRole('dialog').boundingBox()
    assert(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= variant.width + 1, JSON.stringify(dialogBox))
    assert.equal(errors.length, 0, errors.join('\n'))
    checks.push({ ...variant, overflow, weeklyRows: 5, dayDrilldown: true, errors })
    await context.close()
  }
} finally { await browser.close() }
writeFileSync(`${output}/browser-checks.json`, JSON.stringify({ source: 'Mocked API using the repository 25-trade replay fixture; no backend authentication or persistence exercised.', checks }, null, 2))
console.log(JSON.stringify(checks, null, 2))

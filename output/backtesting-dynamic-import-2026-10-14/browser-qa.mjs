import { chromium } from '/Users/ovidiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { createHmac } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const output = '/Users/ovidiu/Documents/trading-analysis/output/backtesting-dynamic-import-2026-10-14'
const source = '/Users/ovidiu/Downloads/Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv'
const api = 'http://127.0.0.1:8098/api'
const userId = '9fb38a2b-bb1a-4dee-94ad-08fc004225df'
const now = Math.floor(Date.now() / 1000)
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, email: 'dynamic-import-browser@example.test', iat: now, exp: now + 3600 })}`
const token = `${unsigned}.${createHmac('sha256', 'local-dynamic-backtesting-import-verification-key-2026').update(unsigned).digest('base64url')}`
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } })
  const text = await response.text()
  assert(response.ok, `${path}: ${response.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const checks = []
try {
  for (const variant of [
    { name: 'desktop-en-light', width: 1440, height: 1100, language: 'en', theme: 'light' },
    { name: 'mobile-ro-light', width: 390, height: 844, language: 'ro', theme: 'light' },
    { name: 'mobile-en-dark', width: 375, height: 812, language: 'en', theme: 'dark' }
  ]) {
    const workspace = await request('/backtesting/workspaces', { method: 'POST', body: JSON.stringify({ title: `Dynamic CSV ${variant.name}`, symbol: 'GER40', researchObjective: 'Local verification of the supplied strategy CSV' }) })
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, timezoneId: 'Europe/Bucharest' })
    await context.addInitScript(({ token, language, theme }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('app.language', language)
      localStorage.setItem('app.themePreference', theme)
      localStorage.setItem('app.analyticsConsent', 'denied')
    }, { ...variant, token })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort()
    })
    const ro = variant.language === 'ro'
    await page.goto(`http://127.0.0.1:5185/backtesting/${workspace.id}`)
    await page.getByRole('heading', { name: workspace.title }).waitFor()
    const openImport = page.getByRole('button', { name: ro ? 'Importă' : 'Import', exact: true })
    await openImport.click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[type=file]').setInputFiles(source)
    assert.equal(await dialog.getByRole('textbox', { name: ro ? 'Instrumentul din CSV' : 'CSV instrument', exact: true }).inputValue(), 'PEPPERSTONE:GER40F')
    await dialog.getByRole('button', { name: ro ? 'Previzualizează importul' : 'Preview import', exact: true }).click()
    await dialog.getByText(ro ? /416 tranzacții închise pregătite/ : /416 closed trades ready/).waitFor()
    assert((await dialog.innerText()).includes('24490.7 EUR'))
    assert((await dialog.innerText()).includes('153.53 USD'))
    const route = `/backtesting/workspaces/${workspace.id}`
    assert.equal((await request(`${route}/trades`)).length, 0)
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.MuiDialog-container')).opacity === '1')
    await dialog.screenshot({ path: `${output}/${variant.name}-preview.png`, animations: 'disabled' })
    if (variant.width < 600) {
      const firstCard = dialog.getByRole('list').getByRole('listitem').first()
      await firstCard.scrollIntoViewIfNeeded()
      await dialog.screenshot({ path: `${output}/${variant.name}-preview-trades.png`, animations: 'disabled' })
      assert((await firstCard.innerText()).includes('153.53 USD'))
      const cardBox = await firstCard.boundingBox()
      assert(cardBox.width <= variant.width)
    }
    const box = await dialog.boundingBox()
    assert(box.x >= 0 && box.x + box.width <= variant.width + 1)
    await dialog.getByRole('button', { name: ro ? 'Importă 416 tranzacții' : 'Import 416 trades', exact: true }).click()
    await dialog.getByText(ro ? /416 tranzacții importate/ : /416 trades imported/).waitFor()
    await dialog.getByRole('button', { name: ro ? 'Închide' : 'Done', exact: true }).click()
    await page.reload()
    await page.getByRole('heading', { name: workspace.title }).waitFor()
    const stored = await request(`${route}/trades`)
    assert.equal(stored.length, 416)
    assert(stored.every(trade => trade.priceCurrency === 'EUR' && trade.currency === 'USD' && trade.instrument === 'PEPPERSTONE:GER40F' && trade.pnlR === null))
    const expected = readFileSync(source, 'utf8').trim().split(/\r?\n/).slice(1).map(row => row.split(','))
    for (const trade of stored) {
      const exit = expected.find(row => row[0] === trade.importTradeNumber && row[1].startsWith('Exit'))
      const entry = expected.find(row => row[0] === trade.importTradeNumber && row[1].startsWith('Entry'))
      assert.equal(trade.date, entry[2].slice(0, 10))
      assert.equal(trade.entryTime.slice(0, 5), entry[2].slice(11))
      assert.equal(trade.exitDate, exit[2].slice(0, 10))
      assert.equal(trade.exitTime.slice(0, 5), exit[2].slice(11))
      assert.equal(trade.entryPrice, Number(entry[4]))
      assert.equal(trade.exitPrice, Number(exit[4]))
      assert.equal(trade.quantity, Number(exit[5]))
      assert.equal(trade.netPnl, Number(exit[7]))
      assert.equal(trade.exitSignal, exit[3])
      const numericFields = { positionValue: 6, returnPercent: 8, commission: 9, favorableExcursion: 10, favorableExcursionPercent: 11,
        adverseExcursion: 12, adverseExcursionPercent: 13, reportedCumulativePnl: 14, reportedCumulativePercent: 15, durationBars: 16 }
      for (const [field, column] of Object.entries(numericFields)) assert.equal(trade[field], Number(exit[column]), `${field} for trade ${trade.importTradeNumber}`)
      assert.equal(trade.entrySignal, entry[3])
    }
    const baseline = (await request(`${route}/analytics`)).baseline
    assert.equal(baseline.currencyMetrics.USD.netPnl, 1601.38)
    assert.equal(baseline.wins, 171)
    assert.equal(baseline.losses, 245)
    assert.equal(baseline.totalR, null)
    await openImport.click()
    await dialog.locator('input[type=file]').setInputFiles(source)
    await dialog.getByRole('button', { name: ro ? 'Previzualizează importul' : 'Preview import', exact: true }).click()
    await dialog.getByText(ro ? /0 tranzacții închise pregătite/ : /0 closed trades ready/).waitFor()
    assert((await dialog.innerText()).includes('416'))
    assert(await dialog.getByRole('button', { name: ro ? 'Importă 0 tranzacții' : 'Import 0 trades', exact: true }).isDisabled())
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    assert(overflow.document <= overflow.viewport)
    assert.equal(errors.length, 0, errors.join('\n'))
    checks.push({ ...variant, sourceRows: 832, previewTrades: 416, persistedTrades: stored.length, reimportDuplicates: 416,
      priceCurrency: 'EUR', pnlCurrency: 'USD', sourceFieldsReconciled: true, netPnl: baseline.currencyMetrics.USD.netPnl, overflow, errors })
    await context.close()
  }
} finally { await browser.close() }
writeFileSync(`${output}/browser-checks.json`, JSON.stringify({ proof: 'Real local frontend/backend, authenticated fixture user and isolated PostgreSQL database. No production data or provider involved.', checks }, null, 2))
console.log(JSON.stringify(checks, null, 2))

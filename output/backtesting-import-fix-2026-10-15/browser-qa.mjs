import { chromium } from '/Users/ovidiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { createHmac } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const output = '/Users/ovidiu/Documents/trading-analysis/output/backtesting-import-fix-2026-10-15'
const source = '/Users/ovidiu/Downloads/Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_38b5c.csv'
const api = 'http://127.0.0.1:8099/api'
const userId = '024dfbd5-7dcb-41f0-b1ee-e3f2234f5a15'
const now = Math.floor(Date.now() / 1000)
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, email: 'long-signals-browser@example.test', iat: now, exp: now + 3600 })}`
const token = `${unsigned}.${createHmac('sha256', 'bG9jYWwtbG9uZy1zaWduYWwtY3N2LXRlc3Qta2V5LTIwMjYtMTAtMTU=').update(unsigned).digest('base64url')}`
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } })
  const text = await response.text()
  assert(response.ok, `${path}: ${response.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}
await request('/backtesting/workspaces')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const checks = []
try {
  for (const variant of [
    { name: 'desktop-en-light', width: 1440, height: 1100, language: 'en', theme: 'light' },
    { name: 'mobile-ro-light', width: 390, height: 844, language: 'ro', theme: 'light' },
    { name: 'mobile-en-dark', width: 375, height: 812, language: 'en', theme: 'dark' }
  ]) {
    const title = `Long signals CSV ${variant.name}`
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
    await page.goto('http://127.0.0.1:5186/backtesting')
    await page.getByRole('button', { name: ro ? 'Backtest nou' : 'New backtest', exact: true }).first().click()
    const create = page.getByRole('dialog')
    await create.getByRole('textbox', { name: ro ? 'Numele spațiului' : 'Workspace name', exact: true }).fill(title)
    const workspaceInstrument = create.getByRole('textbox', { name: ro ? 'Instrument (opțional)' : 'Instrument (optional)', exact: true })
    assert.equal(await workspaceInstrument.getAttribute('required'), null)
    assert.equal(await workspaceInstrument.inputValue(), '')
    const initialSymbol = variant.name === 'mobile-en-dark' ? 'GER40F' : null
    if (initialSymbol) await workspaceInstrument.fill(initialSymbol)
    await create.screenshot({ path: `${output}/${variant.name}-workspace.png`, animations: 'disabled' })
    await create.getByRole('button', { name: ro ? 'Salvează' : 'Save', exact: true }).click()
    await page.waitForURL(/backtesting\/[0-9a-f-]+$/)
    const workspace = await request(`/backtesting/workspaces/${new URL(page.url()).pathname.split('/').at(-1)}`)
    assert.equal(workspace.symbol, initialSymbol)

    await page.getByRole('heading', { name: workspace.title }).waitFor()
    const openImport = page.getByRole('button', { name: ro ? 'Importă' : 'Import', exact: true })
    await openImport.click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[type=file]').setInputFiles(source)
    assert.equal(await dialog.getByRole('textbox', { name: ro ? 'Instrumentul din CSV' : 'CSV instrument', exact: true }).inputValue(), 'PEPPERSTONE:GER40F')
    assert(!(await dialog.innerText()).includes('differs from workspace'))
    assert(!(await dialog.innerText()).includes('diferă de'))
    await dialog.getByRole('button', { name: ro ? 'Previzualizează importul' : 'Preview import', exact: true }).click()
    await dialog.getByText(ro ? /531 tranzacții închise pregătite/ : /531 closed trades ready/).waitFor()
    assert((await dialog.innerText()).includes('19198.5 EUR'))
    assert((await dialog.innerText()).includes('-94.82 USD'))
    const route = `/backtesting/workspaces/${workspace.id}`
    assert.equal((await request(`${route}/trades`)).length, 0)
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.MuiDialog-container')).opacity === '1')
    await dialog.screenshot({ path: `${output}/${variant.name}-preview.png`, animations: 'disabled' })
    if (variant.width < 600) {
      const firstCard = dialog.getByRole('list').getByRole('listitem').first()
      await firstCard.scrollIntoViewIfNeeded()
      await dialog.screenshot({ path: `${output}/${variant.name}-preview-trades.png`, animations: 'disabled' })
      assert((await firstCard.innerText()).includes('-94.82 USD'))
      const cardBox = await firstCard.boundingBox()
      assert(cardBox.width <= variant.width)
    }
    const box = await dialog.boundingBox()
    assert(box.x >= 0 && box.x + box.width <= variant.width + 1)
    await dialog.getByRole('button', { name: ro ? 'Importă 531 tranzacții' : 'Import 531 trades', exact: true }).click()
    await dialog.getByText(ro ? /531 tranzacții importate/ : /531 trades imported/).waitFor()
    await dialog.getByRole('button', { name: ro ? 'Închide' : 'Done', exact: true }).click()
    await page.reload()
    await page.getByRole('heading', { name: workspace.title }).waitFor()
    const stored = await request(`${route}/trades`)
    assert.equal(stored.length, 531)
    assert(stored.every(trade => trade.priceCurrency === 'EUR' && trade.currency === 'USD' && trade.instrument === 'PEPPERSTONE:GER40F' && trade.pnlR === null))
    const expected = JSON.parse(readFileSync(`${output}/source-records.json`, 'utf8'))
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
      assert(trade.entrySignal.length > 255)
      assert.equal(trade.gapPresent, true)
    }
    const baseline = (await request(`${route}/analytics`)).baseline
    assert.equal(baseline.currencyMetrics.USD.netPnl, 5834.85)
    assert.equal(baseline.wins, 260)
    assert.equal(baseline.losses, 271)
    assert.equal(baseline.totalR, null)
    if (variant.width < 600) {
      await page.getByRole('combobox', { name: ro ? 'Secțiunile spațiului de backtesting' : 'Backtesting workspace sections', exact: true }).click()
      await page.getByRole('option', { name: ro ? 'Tranzacții' : 'Trades', exact: true }).click()
    } else await page.getByRole('tab', { name: 'Trades', exact: true }).click()
    await page.getByRole('button', { name: ro ? 'Detalii Replay' : 'Replay details', exact: true }).first().click()
    const detail = page.getByRole('dialog')
    const signalRow = detail.getByRole('row', { name: /FVGAGEv1/ })
    assert((await signalRow.innerText()).includes('sl=19230.5'))
    await signalRow.scrollIntoViewIfNeeded()
    await detail.screenshot({ path: `${output}/${variant.name}-full-signal.png`, animations: 'disabled' })
    const detailWidths = await detail.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }))
    assert(detailWidths.scroll <= detailWidths.client + 1)
    await detail.getByRole('button', { name: ro ? 'Închide' : 'Done', exact: true }).click()
    await openImport.click()
    await dialog.locator('input[type=file]').setInputFiles(source)
    assert(!(await dialog.innerText()).includes('differs from workspace'))
    assert(!(await dialog.innerText()).includes('diferă de'))
    await dialog.getByRole('button', { name: ro ? 'Previzualizează importul' : 'Preview import', exact: true }).click()
    await dialog.getByText(ro ? /0 tranzacții închise pregătite/ : /0 closed trades ready/).waitFor()
    assert((await dialog.innerText()).includes('531'))
    assert(await dialog.getByRole('button', { name: ro ? 'Importă 0 tranzacții' : 'Import 0 trades', exact: true }).isDisabled())
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    assert(overflow.document <= overflow.viewport)
    assert.equal(errors.length, 0, errors.join('\n'))
    checks.push({ ...variant, sourceRows: 1062, previewTrades: 531, persistedTrades: stored.length, reimportDuplicates: 531,
      priceCurrency: 'EUR', pnlCurrency: 'USD', sourceFieldsReconciled: true, netPnl: baseline.currencyMetrics.USD.netPnl, overflow, errors })
    await dialog.getByRole('button', { name: ro ? 'Anulează' : 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: ro ? 'Editează spațiul' : 'Edit workspace', exact: true }).click()
    const edit = page.getByRole('dialog')
    await edit.getByRole('textbox', { name: ro ? 'Instrument (opțional)' : 'Instrument (optional)', exact: true }).fill('')
    await edit.getByRole('button', { name: ro ? 'Salvează' : 'Save', exact: true }).click()
    await edit.waitFor({ state: 'hidden' })
    assert.equal((await request(route)).symbol, null)
    checks.at(-1).workspaceCreatedInUi = true
    checks.at(-1).initialWorkspaceInstrument = initialSymbol
    checks.at(-1).workspaceInstrumentCleared = true
    checks.at(-1).fullSignalsReconciled = true
    await context.close()
  }
} finally { await browser.close() }
writeFileSync(`${output}/browser-checks.json`, JSON.stringify({ proof: 'Real local frontend/backend, authenticated fixture user and isolated PostgreSQL database. No production data or provider involved.', checks }, null, 2))
console.log(JSON.stringify(checks, null, 2))

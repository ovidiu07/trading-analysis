const { chromium } = require('/Users/ovidiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('fs')
const path = require('path')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext()
  await context.addInitScript(() => { localStorage.setItem('token', 'synthetic-browser-fixture'); localStorage.setItem('app.language', 'ro'); localStorage.setItem('app.themePreference', 'dark') })
  let saved = { revision: 0, data: {} }
  const unexpected = [], errors = [], results = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.abort()
    if (!url.pathname.startsWith('/api/')) return route.continue()
    let body
    if (url.pathname === '/api/users/me') body = { id: 'fixture-user', email: 'synthetic@example.invalid', role: 'USER', timezone: 'Europe/Bucharest', baseCurrency: 'EUR', themePreference: 'DARK' }
    else if (url.pathname === '/api/accounts') body = [{ id: 'fixture-account', name: 'Synthetic review account', currency: 'EUR', brokerTimezone: 'Europe/Bucharest' }]
    else if (url.pathname === '/api/strategies') body = { myStrategies: [{ id: 'fixture-strategy', name: 'Confirmation first', entryConditions: ['Wait for a confirmed close'], invalidationLogic: 'Break of the planned level', noTradeRules: 'No clear confirmation', archived: false }], mentorStrategies: [] }
    else if (url.pathname.startsWith('/api/assets/trade/')) body = []
    else if (url.pathname.endsWith('/history')) body = [saved]
    else if (url.pathname === '/api/notebook/notes') body = []
    else if (url.pathname.startsWith('/api/today/reviews/')) { if (route.request().method() === 'PUT') saved = { revision: saved.revision + 1, data: route.request().postDataJSON() }; body = saved }
    else if (url.pathname === '/api/trades/search') body = { content: url.searchParams.get('status') === 'OPEN' ? [] : [{ id: 'fixture-trade', symbol: 'DEMO', accountRefId: 'fixture-account', source: 'TRADING212_CSV', accountCurrency: 'EUR', tradeCurrency: 'USD', direction: 'LONG', status: 'CLOSED', openedAt: new Date().toISOString(), closedAt: new Date().toISOString(), pnlNet: 25 }], totalPages: 1, totalElements: 1 }
    else if (url.pathname === '/api/growth-coach') body = { detail: null }
    else if (url.pathname === '/api/analytics/coach') body = { advice: [] }
    else if (url.pathname.includes('demo-status')) body = { demoEnabled: false, hasDemoData: false }
    else if (url.pathname.includes('unread-count')) body = { unreadCount: 0 }
    else if (url.pathname.includes('stream')) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' })
    else { unexpected.push(url.pathname); body = {} }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://127.0.0.1:5178/today?accountIds=fixture-account')
  await page.getByRole('button', { name: 'Începe sesiunea', exact: true }).waitFor()
  for (const width of [320,360,390,430,768,1024,1280,1440,1920]) {
    await page.setViewportSize({ width, height: 1000 })
    const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0,5).map(e=>e.tagName) }))
    if (overflow.scroll > overflow.width) throw new Error('Overflow at '+width)
    results.push({ width, ...overflow })
    if ([390,1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `today-prepare-ro-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByLabel('Un obiectiv de proces', { exact: true }).fill('Wait for confirmation')
  await page.reload()
  await page.getByDisplayValue?.('Wait for confirmation')
  if (await page.getByLabel('Un obiectiv de proces', { exact: true }).inputValue() !== 'Wait for confirmation') throw new Error('Draft recovery failed')
  await page.getByRole('button', { name: 'Începe sesiunea', exact: true }).click()
  await page.getByText('Cronologia execuțiilor', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Evaluare', exact: true }).click()
  const tradeButton = page.getByRole('button').filter({ hasText: 'DEMO' }).first()
  await tradeButton.click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Am urmat planul', exact: true }).click()
  await page.getByLabel('Notă scurtă de evaluare').fill('Confirmation recorded before entry')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  const focused = await tradeButton.evaluate(e => e === document.activeElement)
  results.push({ escapeDismissal: true, focusRestored: focused, draftRecovery: true })
  await page.getByLabel('Ce păstrezi pentru viitor?').click()
  await page.getByRole('option', { name: 'Ceva de repetat', exact: true }).click()
  await page.getByLabel('Un obiectiv pentru sesiunea următoare').fill('Keep waiting for confirmation')
  await page.getByRole('button', { name: 'Finalizează evaluarea', exact: true }).click()
  await page.getByText('Evaluare finalizată și salvată.', { exact: false }).waitFor()
  if (saved.data.state !== 'COMPLETE' || saved.data.assessments.length !== 1) throw new Error('Completion failed')
  await page.getByRole('button', { name: 'Istoricul evaluării', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  results.push({ historyOpened: true })
  await page.screenshot({ path: path.join(__dirname, 'today-review-complete-ro-390.png'), fullPage: true })
  await page.getByRole('button', { name: 'Redeschide evaluarea', exact: true }).click()
  await page.getByText('Evaluează deciziile', { exact: true }).waitFor()
  results.push({ completion: true, reopening: saved.data.state === 'REVIEW', savedRevision: saved.revision })
  fs.writeFileSync(path.join(__dirname, 'browser-results-ro.json'), JSON.stringify({ fixtureOnly: true, results, unexpected, errors }, null, 2))
  await browser.close()
  console.log(JSON.stringify({ results, unexpected, errors }))
})().catch(e => { console.error(e); process.exit(1) })

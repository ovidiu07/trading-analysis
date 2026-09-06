const { chromium } = require('/Users/ovidiu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs = require('fs')
;(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true })
 const page = await browser.newPage()
 await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
 const results = []
 for (const language of ['en', 'ro']) {
  await page.goto(`http://127.0.0.1:5178/${language}/index.html`)
  const sample = page.locator('details').first()
  await sample.locator('summary').click()
  if (!(await sample.getAttribute('open') !== null)) throw new Error('Evidence did not expand')
  for (const width of [320,390,768,1440]) {
   await page.setViewportSize({ width, height: 900 })
   const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
   if (overflow) throw new Error(`Public overflow ${language} ${width}`)
   results.push({ language, width, overflow: false, sampleExpanded: true })
  }
  await page.goto(`http://127.0.0.1:5178/${language}/pricing/index.html`)
  if (await page.locator('a[href*="checkout"]').count()) throw new Error('Unexpected checkout CTA')
  results.push({ language, noFakeCheckout: true })
 }
 await page.goto('http://127.0.0.1:5178/en/about/index.html')
 if (await page.getByRole('link', { name: 'View features', exact: true }).getAttribute('href') !== '/en/features/') throw new Error('Wrong feature link')
 fs.writeFileSync(__dirname + '/public-browser-results.json', JSON.stringify(results,null,2))
 await browser.close()
 console.log(JSON.stringify(results))
})().catch(error => { console.error(error); process.exit(1) })

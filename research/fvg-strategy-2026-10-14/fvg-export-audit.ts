import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { tradeExportRows, rowsToCsv } from '../../frontend/src/features/backtesting/export'
import type { BacktestingTrade } from '../../frontend/src/api/backtesting'

const dir = new URL('.', import.meta.url)
const trades = JSON.parse(readFileSync(new URL('hydrated-trades.json', dir), 'utf8')) as BacktestingTrade[]
const rows = tradeExportRows(trades)
assert.equal(rows.length, 523)
assert.equal(rows.filter(row => row['Gap present'] === true).length, 523)
assert.equal(rows.filter(row => row['FVG metadata status'] === 'AVAILABLE').length, 523)
assert.equal(rows.filter(row => row['FVG bars from creation to entry'] != null).length, 501)
assert.equal(rows.filter(row => row['FVG bars from creation to entry'] == null).length, 22)
assert.equal(rows.filter(row => row['FVG actual fill depth (%)'] != null).length, 523)
for (let i = 0; i < trades.length; i++) {
  assert.equal(rows[i]['FVG configured R:R'], 3)
  assert.equal(rows[i]['FVG BE trigger (% of entry-to-TP)'], 90)
  assert.equal(rows[i]['FVG BE protected profit (% of entry-to-TP)'], 30)
  const reported = trades[i].exitSignal?.match(/fillPct=(-?[\d.]+)/)?.[1]
  // Pine comments round percentages to two decimals; the app retains six.
  if (reported != null) assert.ok(Math.abs(Number(reported) - Number(rows[i]['FVG actual fill depth (%)'])) <= 0.005001)
}
// Exercise the real production CSV serializer, retaining the local audit as a support artifact.
const csv = rowsToCsv(rows)
assert.ok(csv.includes('"FVG bars from creation to first touch"'))
assert.ok(csv.includes('"FVG BE protected profit (% of entry-to-TP)"'))
writeFileSync(new URL('app-export-audit.json', dir), JSON.stringify({
  rows: rows.length, gapPresent: 523, metadataAvailable: 523, actualDepthAvailable: 523,
  timingAvailable: 501, timingUnavailable: 22, sourceFillDepthReconciled: true,
  configuredRR: 3, beTriggerPercent: 90, beProtectedProfitPercent: 30,
  verification: 'LOCAL_PRODUCTION_EXPORT_FUNCTIONS_WITH_MOCKED_BACKEND_PERSISTENCE'
}, null, 2) + '\n')
console.log('PASS: 523 rows through the production exporter; gap geometry, depth, timing and 90/30 settings reconciled.')

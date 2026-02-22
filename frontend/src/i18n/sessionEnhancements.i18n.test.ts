import { describe, expect, it } from 'vitest'
import en from './en.json'
import ro from './ro.json'

const getValue = (source: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || !(key in (current as Record<string, unknown>))) {
      return undefined
    }
    return (current as Record<string, unknown>)[key]
  }, source)
}

const REQUIRED_KEYS = [
  'today.session.chart.modeLabel',
  'today.session.chart.modeLive',
  'today.session.chart.modeBacktest',
  'today.session.chartProfiles.label',
  'today.session.chartProfiles.save',
  'today.session.chartProfiles.saveAs',
  'today.session.chartProfiles.manage',
  'today.session.chartProfiles.followPlanSymbol',
  'today.session.backtest.setupTitle',
  'today.session.backtest.setupHint',
  'today.session.backtest.loadData',
  'today.session.backtest.summaryTitle',
  'today.session.backtest.errors.setupRequired',
  'today.session.backtest.errors.loadDataFirst',
  'nav.diagnostics'
]

describe('session enhancements i18n', () => {
  it.each(REQUIRED_KEYS)('has required key in EN and RO: %s', (key) => {
    const enValue = getValue(en as unknown as Record<string, unknown>, key)
    const roValue = getValue(ro as unknown as Record<string, unknown>, key)

    expect(typeof enValue).toBe('string')
    expect((enValue as string).trim().length).toBeGreaterThan(0)

    expect(typeof roValue).toBe('string')
    expect((roValue as string).trim().length).toBeGreaterThan(0)
  })
})


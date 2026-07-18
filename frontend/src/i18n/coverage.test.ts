import { describe, expect, it } from 'vitest'
import en from './en.json'
import ro from './ro.json'

const flatten = (value: Record<string, unknown>, prefix = '', output: Record<string, unknown> = {}) => {
  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child as Record<string, unknown>, path, output)
    } else {
      output[path] = child
    }
  })
  return output
}

describe('translation coverage', () => {
  it('keeps English and Romanian resource keys in parity', () => {
    expect(Object.keys(flatten(ro)).sort()).toEqual(Object.keys(flatten(en)).sort())
  })

  it('covers the redesigned shell and core trading routes', () => {
    const english = flatten(en)
    const romanian = flatten(ro)
    const required = [
      'layout.homeLabel',
      'today.session.simple.setup.logTrade',
      'calendar.plans.today',
      'analytics.signals.title',
      'diagnostics.live.title',
      'settings.tradingView.title'
    ]

    required.forEach((key) => {
      expect(english[key]).toBeTruthy()
      expect(romanian[key]).toBeTruthy()
    })
  })
})

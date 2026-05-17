import { describe, expect, it } from 'vitest'
import { normalizeIndicatorLines } from './chartSettings'

describe('normalizeIndicatorLines', () => {
  it('trims empty lines and removes duplicates while preserving order', () => {
    expect(normalizeIndicatorLines(' RSI@tv-basicstudies \n\nMACD@tv-basicstudies\nRSI@tv-basicstudies\nMASimple@tv-basicstudies')).toEqual([
      'RSI@tv-basicstudies',
      'MACD@tv-basicstudies',
      'MASimple@tv-basicstudies'
    ])
  })
})

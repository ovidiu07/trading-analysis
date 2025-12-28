import { describe, expect, it } from 'vitest'
import { formatCurrency, formatSignedCurrency } from './format'

describe('format helpers', () => {
  it('formats currency with provided base currency', () => {
    const result = formatCurrency(1000, 'EUR')
    expect(result).toContain('€')
  })

  it('formats signed currency', () => {
    expect(formatSignedCurrency(50, 'USD')).toContain('+')
    expect(formatSignedCurrency(-10, 'USD')).toContain('-')
  })
})

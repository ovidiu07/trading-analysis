import { describe, expect, it } from 'vitest'
import { formatLocalizedNumberInput, parseLocalizedNumberInput } from './numberInput'

describe('parseLocalizedNumberInput', () => {
  it('parses comma decimals', () => {
    expect(parseLocalizedNumberInput('1,5')).toBe(1.5)
  })

  it('parses dot decimals', () => {
    expect(parseLocalizedNumberInput('1.5')).toBe(1.5)
  })

  it('parses grouped values in either style', () => {
    expect(parseLocalizedNumberInput('1,234.56')).toBe(1234.56)
    expect(parseLocalizedNumberInput('1.234,56')).toBe(1234.56)
  })

  it('returns undefined for invalid input', () => {
    expect(parseLocalizedNumberInput('abc')).toBeUndefined()
  })
})

describe('formatLocalizedNumberInput', () => {
  it('formats for ro locale with comma decimal separator', () => {
    expect(formatLocalizedNumberInput(1.5, { locale: 'ro-RO' })).toBe('1,5')
  })

  it('formats for en locale with dot decimal separator', () => {
    expect(formatLocalizedNumberInput(1.5, { locale: 'en-US' })).toBe('1.5')
  })
})


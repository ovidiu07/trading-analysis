import { describe, expect, it } from 'vitest'
import { getDesignTokens, layoutTokens, toMuiPaletteMode } from './tokens'

describe('toMuiPaletteMode', () => {
  it('maps black-shiny to dark', () => {
    expect(toMuiPaletteMode('black-shiny')).toBe('dark')
  })

  it('keeps dark as dark', () => {
    expect(toMuiPaletteMode('dark')).toBe('dark')
  })

  it('keeps light as light', () => {
    expect(toMuiPaletteMode('light')).toBe('light')
  })

  it('exposes semantic trading states in every mode', () => {
    ;(['light', 'dark', 'black-shiny'] as const).forEach((mode) => {
      const tokens = getDesignTokens(mode)
      expect(tokens.trading.profit).toBeTruthy()
      expect(tokens.trading.loss).toBeTruthy()
      expect(tokens.trading.short).not.toBe(tokens.trading.loss)
      expect(tokens.feedback.successMuted).toBeTruthy()
    })
  })

  it('keeps mobile controls at the documented touch target', () => {
    expect(layoutTokens.touchTarget).toBe(44)
  })
})

import { describe, expect, it } from 'vitest'
import { toMuiPaletteMode } from './tokens'

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
})

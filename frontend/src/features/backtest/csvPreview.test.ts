import { describe, expect, it } from 'vitest'
import { isCsvMappingComplete, parseCsvPreview, resolveHeaderFromColumnKey } from './csvPreview'

describe('csvPreview', () => {
  it('parses duplicate headers and infers timeframe/epoch format', async () => {
    const file = new File([
      [
        'time,open,high,low,close,Plot,Plot,ATR',
        '1762725600,1.15578,1.15578,1.15578,1.15578,0,1,0.001',
        '1762725900,1.15577,1.15592,1.15577,1.15588,0,1,0.001',
        '1762726200,1.15588,1.15595,1.15570,1.15575,0,1,0.001'
      ].join('\n')
    ], 'tv.csv', { type: 'text/csv' })

    const preview = await parseCsvPreview(file, 20)

    expect(preview.columns.map((col) => col.displayName)).toContain('Plot (2)')
    expect(preview.detectedTimeFormat).toBe('epochSec')
    expect(preview.detectedTimeframe).toBe('M5')
    expect(preview.dataFrom).toBe('2025-11-09T22:00:00.000Z')
    expect(preview.dataTo).toBe('2025-11-09T22:10:00.000Z')
    expect(isCsvMappingComplete(preview.mapping)).toBe(true)
  })

  it('resolves selected column key back to the original header', async () => {
    const file = new File([
      [
        'time,open,high,low,close',
        '1762725600,1,2,0.5,1.5'
      ].join('\n')
    ], 'tv.csv', { type: 'text/csv' })

    const preview = await parseCsvPreview(file, 5)
    const header = resolveHeaderFromColumnKey(preview.columns, preview.mapping.timeColumn)
    expect(header).toBe('time')
  })
})

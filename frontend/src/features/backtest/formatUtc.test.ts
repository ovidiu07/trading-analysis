import { describe, expect, it } from 'vitest'
import { formatUtcTimestamp } from './formatUtc'

describe('formatUtcTimestamp', () => {
  it('returns ISO UTC with Z suffix', () => {
    expect(formatUtcTimestamp('2026-02-05T08:10:00Z')).toBe('2026-02-05T08:10:00Z')
  })

  it('normalizes offset timestamps to UTC', () => {
    expect(formatUtcTimestamp('2026-02-05T10:10:00+02:00')).toBe('2026-02-05T08:10:00Z')
  })
})

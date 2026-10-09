import { describe, expect, it } from 'vitest'
import { backtestingSession } from './session'

describe('Bucharest backtesting entry sessions', () => {
  it.each([
    ['10:29:59', ''], ['10:30:00', 'London'], ['16:25:59', 'London'], ['16:26:00', ''],
    ['16:29:59', ''], ['16:30:00', 'New York'], ['23:00:59', 'New York'], ['23:01:00', '']
  ])('classifies %s as %s', (time, expected) => {
    expect(backtestingSession('2025-10-24', time)).toBe(expected)
  })
  it('converts known source zones across the daylight-saving change', () => {
    expect(backtestingSession('2025-10-24', '07:30:00', 'UTC')).toBe('London')
    expect(backtestingSession('2025-10-28', '08:30:00', 'UTC')).toBe('London')
    expect(backtestingSession('2025-10-24', '13:27:00', 'UTC')).toBe('')
    expect(backtestingSession('2025-10-28', '13:27:00', 'UTC')).toBe('London')
    expect(backtestingSession('', '', 'Invalid/Zone')).toBe('')
  })
})

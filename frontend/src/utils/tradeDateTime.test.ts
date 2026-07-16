import { describe, expect, it } from 'vitest'
import {
  currentDateTimeForInput,
  formatUtcForDateTimeLocal,
  localDateTimeToUtcIso,
  tradeDateTimeToUtcIso
} from './tradeDateTime'

const BUCHAREST = 'Europe/Bucharest'

describe('trade date-time timezone contract', () => {
  it('converts Bucharest summer wall time to UTC', () => {
    expect(localDateTimeToUtcIso('2026-07-16T14:35', BUCHAREST))
      .toBe('2026-07-16T11:35:00.000Z')
  })

  it('converts Bucharest winter wall time to UTC', () => {
    expect(localDateTimeToUtcIso('2026-01-16T14:35', BUCHAREST))
      .toBe('2026-01-16T12:35:00.000Z')
  })

  it('crosses the UTC date boundary without changing the local wall clock', () => {
    const utc = localDateTimeToUtcIso('2026-07-16T00:30', BUCHAREST)
    expect(utc).toBe('2026-07-15T21:30:00.000Z')
    expect(formatUtcForDateTimeLocal(utc, BUCHAREST)).toBe('2026-07-16T00:30')
  })

  it('preserves opened and closed wall times across repeated edit round trips', () => {
    let openedAt = '2026-07-16T11:35:00.000Z'
    let closedAt = '2026-07-16T12:17:00.000Z'

    for (let update = 0; update < 3; update += 1) {
      const openedInput = formatUtcForDateTimeLocal(openedAt, BUCHAREST)
      const closedInput = formatUtcForDateTimeLocal(closedAt, BUCHAREST)
      expect(openedInput).toBe('2026-07-16T14:35')
      expect(closedInput).toBe('2026-07-16T15:17')
      openedAt = localDateTimeToUtcIso(openedInput, BUCHAREST)
      closedAt = localDateTimeToUtcIso(closedInput, BUCHAREST)
    }

    expect(openedAt).toBe('2026-07-16T11:35:00.000Z')
    expect(closedAt).toBe('2026-07-16T12:17:00.000Z')
  })

  it('preserves offset-bearing API values as the same UTC instant', () => {
    expect(tradeDateTimeToUtcIso('2026-07-16T14:35:00+03:00', BUCHAREST))
      .toBe('2026-07-16T11:35:00.000Z')
  })

  it('formats defaults in the configured zone rather than the runtime zone', () => {
    expect(currentDateTimeForInput(BUCHAREST, new Date('2026-07-16T11:35:00.000Z')))
      .toBe('2026-07-16T14:35')
  })

  it('rejects nonexistent Bucharest wall times during the DST spring gap', () => {
    expect(() => localDateTimeToUtcIso('2026-03-29T03:30', BUCHAREST))
      .toThrow('does not exist')
  })

  it('rejects invalid calendar values and invalid IANA zones', () => {
    expect(() => localDateTimeToUtcIso('2026-02-30T14:35', BUCHAREST))
      .toThrow('Invalid local date-time')
    expect(() => localDateTimeToUtcIso('2026-07-16T14:35', 'Europe/Not_A_Zone'))
      .toThrow('Invalid IANA time zone')
  })
})

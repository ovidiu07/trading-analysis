import { describe, expect, it } from 'vitest'
import { imminentTradaysEvents, sessionDateAt, unavailableTradays, type TradaysCoverage, type TradaysEvent } from './tradaysWarnings'
const now = Date.parse('2026-10-01T12:00:00Z')
const event = (overrides: Partial<TradaysEvent> = {}): TradaysEvent => ({ id: 't1', name: 'US employment', region: 'US', currency: 'USD', importance: 'HIGH', scheduledAt: '2026-10-01T12:25:00Z', exactTime: true, status: 'SCHEDULED', sourceUpdatedAt: '2026-10-01T11:50:00Z', ...overrides })
const coverage = (events: TradaysEvent[] = [event()], overrides: Partial<TradaysCoverage> = {}): TradaysCoverage => ({ source: 'TRADAYS', mode: 'AUTHORIZED_STRUCTURED', coverage: 'COMPLETE', checkedAt: '2026-10-01T11:59:00Z', validUntil: '2026-10-01T13:10:00Z', events, ...overrides })
const run = (data = coverage(), at = now, date = '2026-10-01', zone = 'Europe/Bucharest', frozen = false) => imminentTradaysEvents(data, at, date, zone, frozen)
describe('normalized Tradays warning contract — fixtures, not a live provider adapter', () => {
  it.each([[3600000, 1], [3600001, 0], [1, 1], [0, 0], [-1, 0]])('exact boundary %i ms', (delta, count) => {
    expect(run(coverage([event({ scheduledAt: new Date(now + delta).toISOString() })])).events).toHaveLength(count)
  })
  it.each(['MEDIUM', 'LOW', 'UNKNOWN', undefined, 3])('does not infer high importance from %s', importance => {
    expect(run(coverage([event({ importance } as Partial<TradaysEvent>)])).events).toEqual([])
  })
  it('rejects unknown times, cancellations, released events and other currencies', () => {
    for (const change of [{ scheduledAt: null }, { scheduledAt: 'invalid' }, { exactTime: false }, { status: 'CANCELLED' as const }, { status: 'RELEASED' as const }, { currency: 'JPY' }]) expect(run(coverage([event(change)])).events).toEqual([])
  })
  it('keeps actual geography, multiple events and newest schedule/cancellation versions', () => {
    const de = event({ id: 'de', region: 'DE', currency: 'EUR' })
    const uk = event({ id: 'uk', region: 'UK', currency: 'GBP' })
    expect(run(coverage([event(), de, uk, de])).events.map(e => e.region)).toEqual(['DE', 'US', 'UK'])
    expect(run(coverage([event(), event({ status: 'CANCELLED', sourceUpdatedAt: '2026-10-01T11:59:00Z' })])).events).toEqual([])
    expect(run(coverage([event(), event({ scheduledAt: '2026-10-01T15:00:00Z', sourceUpdatedAt: '2026-10-01T11:59:00Z' })])).events).toEqual([])
  })
  it('never gives an all-clear for unavailable, partial, stale or unverified data', () => {
    expect(run(unavailableTradays).state).toBe('UNAVAILABLE')
    expect(run(coverage([], { coverage: 'PARTIAL' })).state).toBe('PARTIAL')
    expect(run(coverage([], { coverage: 'STALE' })).state).toBe('STALE')
    expect(run(coverage([], { validUntil: new Date(now).toISOString() })).state).toBe('STALE')
    expect(run(coverage([], { checkedAt: null })).state).toBe('STALE')
    expect(run(coverage([])).state).toBe('CLEAR')
  })
  it('withholds present-time warnings for history, saved views and timezone day changes', () => {
    expect(run(coverage(), now, '2026-09-30').state).toBe('HISTORICAL')
    expect(run(coverage(), now, '2026-10-01', 'Europe/Bucharest', true).state).toBe('HISTORICAL')
    expect(sessionDateAt(Date.parse('2026-10-01T23:30Z'), 'Europe/Bucharest')).toBe('2026-10-02')
    expect(sessionDateAt(Date.parse('2026-10-01T23:30Z'), 'America/New_York')).toBe('2026-10-01')
  })
  it.each(['2026-03-29T00:30:00Z', '2026-10-25T00:30:00Z'])('uses instants across DST %s', timestamp => {
    const at = Date.parse(timestamp)
    const data = coverage([event({ scheduledAt: new Date(at + 3600000).toISOString(), sourceUpdatedAt: new Date(at).toISOString() })], { checkedAt: timestamp, validUntil: new Date(at + 7200000).toISOString() })
    expect(run(data, at, timestamp.slice(0, 10), 'Europe/Bucharest').events).toHaveLength(1)
    expect(run(data, at + 3600000, timestamp.slice(0, 10), 'Europe/Bucharest').events).toHaveLength(0)
  })
})

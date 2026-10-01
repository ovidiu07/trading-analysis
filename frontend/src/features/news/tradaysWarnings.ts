/** Normalized future adapter contract; this is not a Tradays endpoint or raw importance mapping. */
export type TradaysEvent = {
  id: string; name: string; region: string; currency: string
  importance: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  scheduledAt: string | null; exactTime: boolean; status: 'SCHEDULED' | 'CANCELLED' | 'RELEASED'
  sourceUpdatedAt: string
}
export type TradaysCoverage = {
  source: 'TRADAYS'; mode: 'WIDGET_ONLY' | 'AUTHORIZED_STRUCTURED'
  coverage: 'COMPLETE' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE' | 'HISTORICAL'
  checkedAt: string | null; validUntil: string | null; events: TradaysEvent[]
}
export const unavailableTradays: TradaysCoverage = { source: 'TRADAYS', mode: 'WIDGET_ONLY', coverage: 'UNAVAILABLE', checkedAt: null, validUntil: null, events: [] }
export const calendarScope = ['USD', 'GBP', 'EUR'] as const
export function sessionDateAt(now: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}
/** Clock supplied by the caller. Unknown/numeric importance is never guessed into HIGH. */
export function imminentTradaysEvents(data: TradaysCoverage, now: number, date: string, timezone: string, frozen = false) {
  if (frozen || sessionDateAt(now, timezone) !== date || data.coverage === 'HISTORICAL') return { state: 'HISTORICAL', events: [] as TradaysEvent[] }
  if (data.source !== 'TRADAYS' || data.mode !== 'AUTHORIZED_STRUCTURED' || !['COMPLETE', 'PARTIAL', 'STALE'].includes(data.coverage)) return { state: 'UNAVAILABLE', events: [] as TradaysEvent[] }
  const checked = Date.parse(data.checkedAt ?? ''), until = Date.parse(data.validUntil ?? '')
  if (data.coverage === 'STALE' || !Number.isFinite(checked) || checked > now || !Number.isFinite(until) || until <= now) return { state: 'STALE', events: [] as TradaysEvent[] }
  const versions = new Map<string, TradaysEvent>()
  for (const event of data.events) {
    if (!event.id || (!Number.isFinite(Date.parse(event.sourceUpdatedAt)) || Date.parse(event.sourceUpdatedAt) > now)) continue
    const previous = versions.get(event.id)
    if (!previous || Date.parse(event.sourceUpdatedAt) >= Date.parse(previous.sourceUpdatedAt)) versions.set(event.id, event)
  }
  const events = [...versions.values()].filter(event => {
    const at = Date.parse(event.scheduledAt ?? '')
    return calendarScope.some(currency => currency === event.currency) && event.importance === 'HIGH'
      && event.exactTime && event.status === 'SCHEDULED' && Number.isFinite(at) && now < at && at <= now + 60 * 60_000
  }).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!) || a.id.localeCompare(b.id))
  return { state: data.coverage === 'PARTIAL' ? 'PARTIAL' : events.length ? 'UPCOMING' : 'CLEAR', events }
}

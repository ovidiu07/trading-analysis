import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export function backtestingSession(date: string, entryTime: string, sourceTimezone?: string | null): string {
  if (!date || !entryTime) return ''
  try {
    const entry = fromZonedTime(`${date}T${entryTime}`, sourceTimezone?.trim() || 'Europe/Bucharest')
    const [hour, minute] = formatInTimeZone(entry, 'Europe/Bucharest', 'HH:mm').split(':').map(Number)
    const clock = hour * 60 + minute
    if (clock >= 630 && clock <= 985) return 'London'
    if (clock >= 990 && clock <= 1380) return 'New York'
  } catch { /* Invalid or incomplete entry metadata has no inferred session. */ }
  return ''
}

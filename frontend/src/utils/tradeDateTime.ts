import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
const OFFSET_DATE_TIME_RE = /(Z|[+-]\d{2}:\d{2})$/i
const DATE_TIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm"
const DATE_TIME_LOCAL_SECONDS_FORMAT = "yyyy-MM-dd'T'HH:mm:ss"

function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
  } catch {
    throw new RangeError(`Invalid IANA time zone: ${timeZone}`)
  }
}

function normalizeLocalDateTime(value: string): { value: string; hasSeconds: boolean } {
  const trimmed = value.trim()
  const match = LOCAL_DATE_TIME_RE.exec(trimmed)
  if (!match) {
    throw new RangeError(`Invalid local date-time: ${value}`)
  }

  const [, year, month, day, hour, minute, seconds] = match
  const hasSeconds = seconds !== undefined
  const normalized = `${year}-${month}-${day}T${hour}:${minute}:${seconds ?? '00'}`
  const validationDate = new Date(`${normalized}Z`)
  if (
    Number.isNaN(validationDate.getTime())
    || validationDate.getUTCFullYear() !== Number(year)
    || validationDate.getUTCMonth() + 1 !== Number(month)
    || validationDate.getUTCDate() !== Number(day)
    || validationDate.getUTCHours() !== Number(hour)
    || validationDate.getUTCMinutes() !== Number(minute)
    || validationDate.getUTCSeconds() !== Number(seconds ?? '0')
  ) {
    throw new RangeError(`Invalid local date-time: ${value}`)
  }

  return { value: normalized, hasSeconds }
}

/** Formats a stored instant for a timezone-free datetime-local input. */
export function formatUtcForDateTimeLocal(utcValue: string | Date, timeZone: string): string {
  assertValidTimeZone(timeZone)
  if (typeof utcValue === 'string' && !OFFSET_DATE_TIME_RE.test(utcValue.trim())) {
    throw new RangeError(`Expected an ISO date-time with an offset: ${utcValue}`)
  }
  const instant = utcValue instanceof Date ? new Date(utcValue.getTime()) : new Date(utcValue)
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Invalid UTC date-time: ${String(utcValue)}`)
  }
  return formatInTimeZone(instant, timeZone, DATE_TIME_LOCAL_FORMAT)
}

/** Resolves a datetime-local wall clock in an explicit IANA zone to one UTC instant. */
export function localDateTimeToUtcIso(localValue: string, timeZone: string): string {
  assertValidTimeZone(timeZone)
  const normalized = normalizeLocalDateTime(localValue)
  const instant = fromZonedTime(normalized.value, timeZone)
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Invalid local date-time: ${localValue}`)
  }

  // A DST gap has no matching instant. Reject it instead of silently rolling the clock.
  const roundTripFormat = normalized.hasSeconds ? DATE_TIME_LOCAL_SECONDS_FORMAT : DATE_TIME_LOCAL_FORMAT
  const expected = normalized.hasSeconds ? normalized.value : normalized.value.slice(0, 16)
  if (formatInTimeZone(instant, timeZone, roundTripFormat) !== expected) {
    throw new RangeError(`Local date-time does not exist in ${timeZone}: ${localValue}`)
  }

  return instant.toISOString()
}

/** Accepts the form's local value and preserves offset-bearing API-compatible inputs. */
export function tradeDateTimeToUtcIso(value: string, timeZone: string): string {
  const trimmed = value.trim()
  if (!OFFSET_DATE_TIME_RE.test(trimmed)) {
    return localDateTimeToUtcIso(trimmed, timeZone)
  }
  const instant = new Date(trimmed)
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Invalid offset date-time: ${value}`)
  }
  return instant.toISOString()
}

export function currentDateTimeForInput(timeZone: string, now: Date = new Date()): string {
  return formatUtcForDateTimeLocal(now, timeZone)
}

import { getCurrentLocale } from '../i18n'

const formatterCache = new Map<string, Intl.NumberFormat>()
const compactFormatterCache = new Map<string, Intl.NumberFormat>()
const numberFormatterCache = new Map<string, Intl.NumberFormat>()
const relativeFormatterCache = new Map<string, Intl.RelativeTimeFormat>()

const getCurrencyFormatter = (currency?: string) => {
  const locale = getCurrentLocale()
  const key = currency && currency.trim() ? currency.toUpperCase() : 'USD'
  const cacheKey = `${locale}:${key}`
  if (!formatterCache.has(cacheKey)) {
    try {
      formatterCache.set(cacheKey, new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: key,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }))
    } catch (e) {
      const fallbackKey = `${locale}:USD`
      formatterCache.set(fallbackKey, new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }))
      return formatterCache.get(fallbackKey)!
    }
  }
  return formatterCache.get(cacheKey)!
}

const getCompactCurrencyFormatter = (currency?: string) => {
  const locale = getCurrentLocale()
  const key = currency && currency.trim() ? currency.toUpperCase() : 'USD'
  const cacheKey = `${locale}:${key}`
  if (!compactFormatterCache.has(cacheKey)) {
    try {
      compactFormatterCache.set(cacheKey, new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: key,
        currencyDisplay: 'narrowSymbol',
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }))
    } catch (e) {
      const fallbackKey = `${locale}:USD`
      compactFormatterCache.set(fallbackKey, new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }))
      return compactFormatterCache.get(fallbackKey)!
    }
  }
  return compactFormatterCache.get(cacheKey)!
}

const getNumberFormatter = (maximumFractionDigits = 2) => {
  const locale = getCurrentLocale()
  const cacheKey = `${locale}:${maximumFractionDigits}`
  if (!numberFormatterCache.has(cacheKey)) {
    numberFormatterCache.set(cacheKey, new Intl.NumberFormat(locale, { maximumFractionDigits }))
  }
  return numberFormatterCache.get(cacheKey)!
}

const getRelativeFormatter = () => {
  const locale = getCurrentLocale()
  if (!relativeFormatterCache.has(locale)) {
    relativeFormatterCache.set(locale, new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }))
  }
  return relativeFormatterCache.get(locale)!
}

export const formatCurrency = (value?: number | null, currency?: string) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return getCurrencyFormatter(currency).format(value)
}

export const formatSignedCurrency = (value?: number | null, currency?: string) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${getCurrencyFormatter(currency).format(value)}`
}

export const formatCompactCurrency = (value?: number | null, currency?: string) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return getCompactCurrencyFormatter(currency).format(value)
}

export const formatPercent = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return `${getNumberFormatter(2).format(value)}%`
}

export const formatNumber = (value?: number | null, maximumFractionDigits = 2) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return getNumberFormatter(maximumFractionDigits).format(value)
}

export const formatFileSize = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value) || value < 0) return '—'
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  const decimals = size >= 10 ? 1 : 2
  return `${size.toFixed(decimals)} ${units[index]}`
}

export const formatDateTime = (value?: string | null, timeZone?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(getCurrentLocale(), timeZone ? { timeZone } : undefined)
}

export const formatDate = (value?: string | null, timeZone?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(getCurrentLocale(), timeZone ? { timeZone } : undefined)
}

export const formatRelativeTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absSeconds = Math.abs(diffInSeconds)
  const formatter = getRelativeFormatter()

  if (absSeconds < 60) {
    return formatter.format(diffInSeconds, 'second')
  }
  if (absSeconds < 3600) {
    return formatter.format(Math.round(diffInSeconds / 60), 'minute')
  }
  if (absSeconds < 86400) {
    return formatter.format(Math.round(diffInSeconds / 3600), 'hour')
  }
  if (absSeconds < 604800) {
    return formatter.format(Math.round(diffInSeconds / 86400), 'day')
  }
  if (absSeconds < 2629800) {
    return formatter.format(Math.round(diffInSeconds / 604800), 'week')
  }
  if (absSeconds < 31557600) {
    return formatter.format(Math.round(diffInSeconds / 2629800), 'month')
  }
  return formatter.format(Math.round(diffInSeconds / 31557600), 'year')
}

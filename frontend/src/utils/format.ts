const formatterCache = new Map<string, Intl.NumberFormat>()

const getCurrencyFormatter = (currency?: string) => {
  const key = currency && currency.trim() ? currency.toUpperCase() : 'USD'
  if (!formatterCache.has(key)) {
    try {
      formatterCache.set(key, new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: key,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }))
    } catch (e) {
      formatterCache.set('USD', new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }))
      return formatterCache.get('USD')!
    }
  }
  return formatterCache.get(key)!
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

export const formatCurrency = (value?: number | null, currency?: string) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return getCurrencyFormatter(currency).format(value)
}

export const formatSignedCurrency = (value?: number | null, currency?: string) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${getCurrencyFormatter(currency).format(value)}`
}

export const formatPercent = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return `${numberFormatter.format(value)}%`
}

export const formatNumber = (value?: number | null, maximumFractionDigits = 2) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value)
}

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

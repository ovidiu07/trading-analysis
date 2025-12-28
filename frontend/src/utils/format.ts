const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

export const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  return currencyFormatter.format(value)
}

export const formatSignedCurrency = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${currencyFormatter.format(value)}`
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

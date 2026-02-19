import { getCurrentLocale } from '../i18n'

type NullableInput = number | string | null | undefined

const normalizeDecimalString = (value: string): string => {
  const compact = value.trim().replace(/\s+/g, '')
  if (!compact) return ''

  const hasComma = compact.includes(',')
  const hasDot = compact.includes('.')

  if (hasComma && hasDot) {
    const lastComma = compact.lastIndexOf(',')
    const lastDot = compact.lastIndexOf('.')

    if (lastComma > lastDot) {
      return compact.replace(/\./g, '').replace(',', '.')
    }

    return compact.replace(/,/g, '')
  }

  if (hasComma) {
    return compact.replace(',', '.')
  }

  return compact
}

export const parseLocalizedNumberInput = (value: NullableInput): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  const normalized = normalizeDecimalString(value)
  if (!normalized) return undefined

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

type FormatLocalizedNumberInputOptions = {
  locale?: string
  maximumFractionDigits?: number
}

export const formatLocalizedNumberInput = (
  value: number | null | undefined,
  options: FormatLocalizedNumberInputOptions = {}
): string => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return ''
  }

  const locale = options.locale || getCurrentLocale()
  const maximumFractionDigits = options.maximumFractionDigits ?? 8

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false
  }).format(value)
}


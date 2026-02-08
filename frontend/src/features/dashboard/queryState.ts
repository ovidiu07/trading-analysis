export type DashboardStatusFilter = 'ALL' | 'OPEN' | 'CLOSED'

export type DashboardQueryState = {
  from: string
  to: string
  status: DashboardStatusFilter
  market: string
  accountId: string
}

export const DASHBOARD_QUERY_KEYS = ['from', 'to', 'status', 'market', 'accountId'] as const
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_LOOKBACK_DAYS = 30

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const shiftDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const getDefaultDashboardRange = () => {
  const today = new Date()
  const to = formatDateInput(today)
  const from = formatDateInput(shiftDays(today, -(DEFAULT_LOOKBACK_DAYS - 1)))
  return { from, to }
}

export const getDefaultDashboardQueryState = (): DashboardQueryState => {
  const { from, to } = getDefaultDashboardRange()
  return {
    from,
    to,
    status: 'CLOSED',
    market: '',
    accountId: ''
  }
}

const normalizeDate = (value: string | null | undefined) => {
  if (!value || !DATE_PATTERN.test(value)) return ''
  return value
}

const normalizeStatus = (value: string | null | undefined): DashboardStatusFilter => {
  if (value === 'OPEN' || value === 'CLOSED' || value === 'ALL') {
    return value
  }
  return 'CLOSED'
}

const sortDateRange = (from: string, to: string) => {
  if (!from || !to || from <= to) return { from, to }
  return { from: to, to: from }
}

export const readDashboardQueryState = (params: URLSearchParams): DashboardQueryState => {
  const defaults = getDefaultDashboardQueryState()
  const rawFrom = normalizeDate(params.get('from'))
  const rawTo = normalizeDate(params.get('to'))
  const range = sortDateRange(rawFrom || defaults.from, rawTo || defaults.to)

  return {
    from: range.from,
    to: range.to,
    status: normalizeStatus(params.get('status')),
    market: (params.get('market') || '').trim(),
    accountId: (params.get('accountId') || '').trim()
  }
}

export const hasDashboardQueryParams = (params: URLSearchParams) => {
  return DASHBOARD_QUERY_KEYS.some((key) => params.has(key))
}

export const buildDashboardSearchParams = (
  state: DashboardQueryState,
  baseParams?: URLSearchParams
) => {
  const params = new URLSearchParams(baseParams)
  const stateParams = new URLSearchParams()
  stateParams.set('from', state.from)
  stateParams.set('to', state.to)
  stateParams.set('status', state.status)
  stateParams.set('market', state.market)
  stateParams.set('accountId', state.accountId)
  const normalized = readDashboardQueryState(stateParams)

  DASHBOARD_QUERY_KEYS.forEach((key) => params.delete(key))
  params.set('from', normalized.from)
  params.set('to', normalized.to)
  params.set('status', normalized.status)

  if (normalized.market) params.set('market', normalized.market)
  if (normalized.accountId) params.set('accountId', normalized.accountId)

  return params
}

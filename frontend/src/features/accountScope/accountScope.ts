export type AccountScopeValue =
  | { mode: 'all'; accountIds: [] }
  | { mode: 'selected'; accountIds: string[] }

export const ACCOUNT_SCOPE_QUERY_KEYS = ['accountScope', 'accountIds'] as const
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const allAccountsScope = (): AccountScopeValue => ({ mode: 'all', accountIds: [] })

export const selectedAccountsScope = (accountIds: string[]): AccountScopeValue => {
  const normalized = [...new Set(accountIds.map((value) => value.trim()).filter(Boolean))].sort()
  return normalized.length > 0
    ? { mode: 'selected', accountIds: normalized }
    : allAccountsScope()
}

export const readAccountScope = (params: URLSearchParams): AccountScopeValue => {
  const requested = (params.get('accountIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => UUID_PATTERN.test(value))

  if (requested.length > 0) {
    return selectedAccountsScope(requested)
  }

  const legacy = (params.get('accountId') || '').trim()
  if (UUID_PATTERN.test(legacy)) {
    return selectedAccountsScope([legacy])
  }

  return allAccountsScope()
}

export const writeAccountScope = (
  params: URLSearchParams,
  scope: AccountScopeValue
) => {
  const next = new URLSearchParams(params)
  ACCOUNT_SCOPE_QUERY_KEYS.forEach((key) => next.delete(key))
  const legacy = next.get('accountId')
  if (legacy && UUID_PATTERN.test(legacy)) {
    next.delete('accountId')
  }

  if (scope.mode === 'selected' && scope.accountIds.length > 0) {
    next.set('accountIds', [...scope.accountIds].sort().join(','))
  } else {
    next.set('accountScope', 'all')
  }
  return next
}

export const accountScopeApiParams = (scope: AccountScopeValue) => (
  scope.mode === 'selected'
    ? { accountIds: scope.accountIds.join(',') }
    : {}
)

export const accountScopeCacheKey = (scope: AccountScopeValue) => (
  scope.mode === 'selected' ? scope.accountIds.join(',') : 'all'
)

export const copyAccountScopeParams = (from: URLSearchParams, to: URLSearchParams) => {
  const scope = readAccountScope(from)
  return writeAccountScope(to, scope)
}

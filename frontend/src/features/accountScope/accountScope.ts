export type AccountScopeValue =
  | { mode: 'all'; accountIds: [] }
  | { mode: 'selected'; accountIds: string[] }

export const ACCOUNT_SCOPE_QUERY_KEYS = ['accountScope', 'accountIds'] as const

export const allAccountsScope = (): AccountScopeValue => ({ mode: 'all', accountIds: [] })

export const selectedAccountsScope = (accountIds: string[]): AccountScopeValue => {
  const normalized = [...new Set(accountIds.map((value) => value.trim()).filter(Boolean))].sort()
  return normalized.length > 0
    ? { mode: 'selected', accountIds: normalized }
    : allAccountsScope()
}

export const readAccountScope = (params: URLSearchParams): AccountScopeValue => {
  const explicitAccountIds = params.get('accountIds')
  const requested = (explicitAccountIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (explicitAccountIds !== null) {
    return selectedAccountsScope(requested)
  }

  const legacy = (params.get('accountId') || '').trim()
  if (legacy) {
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
  next.delete('accountId')

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

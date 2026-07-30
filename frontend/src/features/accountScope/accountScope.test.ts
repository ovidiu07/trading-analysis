import { describe, expect, it } from 'vitest'
import {
  accountScopeApiParams,
  accountScopeCacheKey,
  allAccountsScope,
  copyAccountScopeParams,
  readAccountScope,
  selectedAccountsScope,
  writeAccountScope
} from './accountScope'

const FIRST_ID = '00000000-0000-4000-8000-000000000001'
const SECOND_ID = '00000000-0000-4000-8000-000000000002'

describe('accountScope', () => {
  it('normalizes selected account IDs for URLs, APIs, and cache keys', () => {
    const scope = selectedAccountsScope([SECOND_ID, FIRST_ID, SECOND_ID])

    expect(scope).toEqual({ mode: 'selected', accountIds: [FIRST_ID, SECOND_ID] })
    expect(accountScopeApiParams(scope)).toEqual({ accountIds: `${FIRST_ID},${SECOND_ID}` })
    expect(accountScopeCacheKey(scope)).toBe(`${FIRST_ID},${SECOND_ID}`)
  })

  it('reads canonical multi-account and legacy internal UUID links', () => {
    expect(readAccountScope(new URLSearchParams(`accountIds=${SECOND_ID},${FIRST_ID}`)))
      .toEqual({ mode: 'selected', accountIds: [FIRST_ID, SECOND_ID] })
    expect(readAccountScope(new URLSearchParams(`accountId=${FIRST_ID}`)))
      .toEqual({ mode: 'selected', accountIds: [FIRST_ID] })
  })

  it('preserves invalid explicit selections so the backend can reject them without falling back to all accounts', () => {
    expect(readAccountScope(new URLSearchParams('accountId=MT5-123456')))
      .toEqual({ mode: 'selected', accountIds: ['MT5-123456'] })
    expect(readAccountScope(new URLSearchParams('accountIds=not-a-uuid')))
      .toEqual({ mode: 'selected', accountIds: ['not-a-uuid'] })
    expect(accountScopeApiParams(readAccountScope(new URLSearchParams('accountIds=not-a-uuid'))))
      .toEqual({ accountIds: 'not-a-uuid' })
  })

  it('gives explicit accountIds precedence over legacy and accountScope values', () => {
    const scope = readAccountScope(new URLSearchParams(
      `accountIds=${SECOND_ID}&accountId=${FIRST_ID}&accountScope=all`
    ))
    expect(scope).toEqual({ mode: 'selected', accountIds: [SECOND_ID] })
  })

  it('writes an explicit all default while preserving unrelated query state', () => {
    const params = writeAccountScope(
      new URLSearchParams(`from=2026-07-01&accountIds=${FIRST_ID}`),
      allAccountsScope()
    )

    expect(params.get('from')).toBe('2026-07-01')
    expect(params.get('accountIds')).toBeNull()
    expect(params.get('accountScope')).toBe('all')
    expect(accountScopeApiParams(allAccountsScope())).toEqual({})
    expect(accountScopeCacheKey(allAccountsScope())).toBe('all')
  })

  it('copies scope between navigation targets without dropping target parameters', () => {
    const target = copyAccountScopeParams(
      new URLSearchParams(`accountIds=${SECOND_ID},${FIRST_ID}`),
      new URLSearchParams('month=2026-07')
    )

    expect(target.get('month')).toBe('2026-07')
    expect(target.get('accountIds')).toBe(`${FIRST_ID},${SECOND_ID}`)
  })
})

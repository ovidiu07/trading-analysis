import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyticsDataChangedEvent } from './dataEvents'
import { tradingAccountsChangedEvent } from './accounts'
import { deleteAccountTrades } from './tradeData'

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }))

vi.mock('./client', () => ({
  apiPost: (...args: unknown[]) => apiPost(...args)
}))

describe('trade-data API', () => {
  beforeEach(() => {
    apiPost.mockReset()
  })

  it('announces account and analytics invalidation only after deletion succeeds', async () => {
    const accountsChanged = vi.fn()
    const analyticsChanged = vi.fn()
    window.addEventListener(tradingAccountsChangedEvent, accountsChanged)
    window.addEventListener(analyticsDataChangedEvent, analyticsChanged)
    apiPost.mockResolvedValue({
      accountId: 'account-1',
      accountName: 'Trading 212 EUR',
      deletedTrades: 15,
      deletedRealizedPnl: 94.01,
      deletedAt: '2026-07-30T18:00:00Z'
    })

    await deleteAccountTrades({
      accountId: 'account-1',
      scope: 'DATE_RANGE',
      startDate: '2026-07-13',
      endDate: '2026-07-16',
      timezone: 'Europe/Bucharest',
      confirmed: true,
      previewToken: 'fresh-token'
    })

    expect(accountsChanged).toHaveBeenCalledOnce()
    expect(analyticsChanged).toHaveBeenCalledOnce()

    window.removeEventListener(tradingAccountsChangedEvent, accountsChanged)
    window.removeEventListener(analyticsDataChangedEvent, analyticsChanged)
  })
})

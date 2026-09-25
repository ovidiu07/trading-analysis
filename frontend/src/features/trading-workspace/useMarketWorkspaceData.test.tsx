import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMarketWorkspaceData, marketPollInterval } from './useMarketWorkspaceData'
import { fetchMarketWorkspace, providerConnectionChanged, type MarketWorkspaceResponse } from '../../api/marketData'
import { ApiError } from '../../api/client'

const auth = vi.hoisted(() => ({ isAuthenticated: true, user: { id: 'user-a' } as { id: string } | null }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../../api/marketData', async importOriginal => ({ ...await importOriginal<typeof import('../../api/marketData')>(), fetchMarketWorkspace: vi.fn() }))
vi.mock('../../i18n', () => ({ getCurrentLanguage: () => 'en' }))
const response = (price = 1.25): MarketWorkspaceResponse => ({ retrievedAt: new Date().toISOString(), selectedInstrument: 'GBPUSD', quotes: [{
  canonicalInstrument: 'GBPUSD', provider: 'OANDA', providerSymbol: 'GBP_USD', instrumentType: 'FX', priceBasis: 'MID', mid: price,
  unit: 'USD', observedAt: new Date().toISOString(), retrievedAt: new Date().toISOString(), freshness: 'LIVE', provenance: 'USER_CONNECTED'
}], macroObservations: [] })
let client: QueryClient
function mount(active = true) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } }, logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } })
  return renderHook(({ enabled }) => useMarketWorkspaceData('account', 'GBPUSD', '2026-09-25', enabled), {
    initialProps: { enabled: active }, wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  })
}
beforeEach(() => {
  auth.isAuthenticated = true; auth.user = { id: 'user-a' }
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  vi.mocked(fetchMarketWorkspace).mockReset().mockResolvedValue(response())
})
afterEach(() => { cleanup(); client?.clear(); vi.restoreAllMocks() })

describe('native quote lifecycle', () => {
  it('does not fetch outside preparation, including visibility changes', async () => {
    mount(false)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(fetchMarketWorkspace).not.toHaveBeenCalled()
  })
  it('does not fetch while hidden, and reconnects when visible', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    const hook = mount()
    expect(fetchMarketWorkspace).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(hook.result.current.data?.quotes[0].mid).toBe(1.25))
  })
  it('never renders another user’s previous quote and discards it on logout', async () => {
    const hook = mount()
    await waitFor(() => expect(hook.result.current.data?.quotes[0].mid).toBe(1.25))
    vi.mocked(fetchMarketWorkspace).mockResolvedValue(response(2.5))
    auth.user = { id: 'user-b' }
    hook.rerender({ enabled: true })
    expect(hook.result.current.data?.quotes[0].mid).not.toBe(1.25)
    await waitFor(() => expect(hook.result.current.data?.quotes[0].mid).toBe(2.5))
    expect(client.getQueryCache().findAll({ queryKey: ['marketWorkspace', 'user-a'] })).toHaveLength(0)
    auth.user = null; auth.isAuthenticated = false
    hook.rerender({ enabled: true })
    expect(hook.result.current.data).toBeUndefined()
    expect(client.getQueryCache().findAll({ queryKey: ['marketWorkspace', 'user-b'] })).toHaveLength(0)
  })
  it('marks retained prices stale when the heartbeat fails and recovers on success', async () => {
    const hook = mount()
    await waitFor(() => expect(hook.result.current.data?.quotes[0].freshness).toBe('LIVE'))
    vi.mocked(fetchMarketWorkspace).mockRejectedValue(new Error('offline'))
    await act(async () => { await hook.result.current.refetch() })
    await waitFor(() => expect(hook.result.current.data?.quotes[0]).toMatchObject({ freshness: 'STALE', availabilityReason: 'CONNECTION_LOST' }))
    vi.mocked(fetchMarketWorkspace).mockResolvedValue(response(1.3))
    await act(async () => { await hook.result.current.refetch() })
    await waitFor(() => expect(hook.result.current.data?.quotes[0]).toMatchObject({ freshness: 'LIVE', mid: 1.3 }))
  })
  it('ages quotes even when no new response arrives', async () => {
    const hook = mount()
    await waitFor(() => expect(hook.result.current.data?.quotes[0].freshness).toBe('LIVE'))
    const future = Date.now() + 20_000
    vi.spyOn(Date, 'now').mockReturnValue(future)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(hook.result.current.data?.quotes[0].freshness).toBe('STALE'))
  })
  it('removes retained numeric prices when access is denied', async () => {
    const hook = mount()
    await waitFor(() => expect(hook.result.current.data?.quotes[0].mid).toBe(1.25))
    const denied = new ApiError('forbidden'); denied.status = 403
    vi.mocked(fetchMarketWorkspace).mockRejectedValue(denied)
    await act(async () => { await hook.result.current.refetch() })
    await waitFor(() => expect(hook.result.current.data?.quotes[0]).toMatchObject({
      mid: null, bid: null, ask: null, freshness: 'UNAVAILABLE', availabilityReason: 'PROVIDER_DISCONNECTED'
    }))
  })
  it('invalidates on provider disconnect and never retains the previous value', async () => {
    const hook = mount()
    await waitFor(() => expect(hook.result.current.data?.quotes[0].mid).toBe(1.25))
    const disconnected = response()
    disconnected.quotes[0] = { ...disconnected.quotes[0], mid: null, freshness: 'UNAVAILABLE', availabilityReason: 'NO_CREDENTIALS' }
    vi.mocked(fetchMarketWorkspace).mockResolvedValue(disconnected)
    act(() => window.dispatchEvent(new Event(providerConnectionChanged)))
    await waitFor(() => expect(hook.result.current.data?.quotes[0].availabilityReason).toBe('NO_CREDENTIALS'))
    expect(hook.result.current.data?.quotes[0].mid).toBeNull()
  })
  it('backs off errors and rate limits within a fixed upper bound', () => {
    expect(marketPollInterval(response())).toBe(5000)
    expect(marketPollInterval(response(), 1)).toBe(10000)
    expect(marketPollInterval(response(), 50)).toBe(60000)
    const limited = response(); limited.quotes[0].availabilityReason = 'RATE_LIMIT'
    expect(marketPollInterval(limited)).toBe(60000)
  })
  it('aborts in-flight requests on unmount', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(fetchMarketWorkspace).mockImplementation((_a, _i, _d, s) => { signal = s; return new Promise(() => {}) })
    const hook = mount()
    await waitFor(() => expect(signal).toBeDefined())
    hook.unmount()
    expect(signal?.aborted).toBe(true)
  })
})

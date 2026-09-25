import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TodayPage from './TodayPage'
import { I18nProvider } from '../i18n'
import { initialPreparation } from '../features/preparation/context'
import { fetchMarketWorkspace } from '../api/marketData'
import { getSessionReview, saveSessionReview } from '../api/sessionReviews'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1', timezone: 'Europe/Bucharest', baseCurrency: 'USD' } }) }))
vi.mock('../api/accounts', () => ({ fetchTradingAccounts: vi.fn().mockResolvedValue([{ id: 'a1', name: 'Synthetic account', currency: 'EUR', brokerTimezone: 'Europe/Bucharest' }]) }))
vi.mock('../api/growthCoach', () => ({ fetchGrowthCoach: vi.fn().mockResolvedValue({ detail: null }) }))
vi.mock('../api/analytics', () => ({ fetchAnalyticsCoach: vi.fn().mockResolvedValue({ advice: [] }) }))
vi.mock('../api/strategies', () => ({ listStrategies: vi.fn().mockResolvedValue({ myStrategies: [], mentorStrategies: [] }) }))
vi.mock('../api/trades', () => ({ searchTrades: vi.fn().mockResolvedValue({ content: [], totalPages: 0 }) }))
vi.mock('../api/notebook', () => ({ listNotebookNotes: vi.fn().mockResolvedValue([]) }))
vi.mock('../features/risk/TodayRiskPanel', () => ({ TodayRiskPanel: () => <span>Existing manual risk workflow</span> }))
vi.mock('../features/preparation/SessionJournal', () => ({ SessionJournal: () => null }))
vi.mock('../components/charts/TradingViewWidget', () => ({ default: () => <div>TradingView display only</div> }))
vi.mock('../api/marketData', async original => ({ ...await original<typeof import('../api/marketData')>(), fetchMarketWorkspace: vi.fn() }))
vi.mock('../api/sessionReviews', async original => ({ ...await original<typeof import('../api/sessionReviews')>(), getSessionReview: vi.fn(), saveSessionReview: vi.fn(async (_a, _d, revision, data) => ({ revision: revision + 1, data })) }))
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiGet: vi.fn(async (path: string) => {
  if (path === '/market-workspace/official-context') return []
  if (path.includes('withdrawals')) return []
  const time = new Date(Date.now() - 60000).toISOString()
  const selected = { id: path.includes('/today/briefing/version/') ? 'captured-publication' : 'new-publication', publishedAt: time, firstPublishedAt: time, revision: 1,
    document: { editorialDate: '2026-09-25', contentLanguage: 'en', coverage: 'COMPLETE', slot: 'ASIA', referenceTime: time, translations: { en: { title: 'Reviewed official context', summary: [], facts: [], news: [], macro: [], levels: [], scenarios: [],
      events: [{ id: 'event', name: 'Reviewed unemployment release', region: 'US', source: 'BLS', sourceUrl: 'https://www.bls.gov/', timezone: 'America/New_York', scheduledAt: time, publishedAt: time, status: 'RELEASED', actual: '4.1', unit: '%' }] } } } }
  return { id: 'capture', kind: 'EDITORIAL', selected, composition: [], capturedAt: time, requestedSlot: 'ASIA' }
}) }))
let client: QueryClient
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  const preparation = { ...initialPreparation(), chartSymbol: 'OANDA:DE30EUR', briefingId: 'capture', observing: true, contextAcknowledged: true, chartConfirmed: true, preparationConfirmed: true }
  vi.mocked(getSessionReview).mockResolvedValue({ revision: 0, data: { state: 'PREPARE', instruments: 'GER40', preparation } } as never)
  vi.mocked(fetchMarketWorkspace).mockResolvedValue({ retrievedAt: new Date().toISOString(), selectedInstrument: 'GER40', providerEnvironment: 'LIVE', macroObservations: [], quotes: [{
    canonicalInstrument: 'GER40', provider: 'OANDA', providerSymbol: 'DE30_EUR', instrumentType: 'CFD', priceBasis: 'MID', mid: 18765.4321,
    unit: 'EUR', observedAt: new Date().toISOString(), retrievedAt: new Date().toISOString(), freshness: 'LIVE', provenance: 'USER_CONNECTED', sourceUrl: 'https://developer.oanda.com/rest-live-v20/pricing-ep/'
  }] })
})
afterEach(() => { cleanup(); client?.clear() })
function show() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter initialEntries={['/today?accountIds=a1']}><QueryClientProvider client={client}><I18nProvider><TodayPage /></I18nProvider></QueryClientProvider></MemoryRouter>)
}
describe('authenticated Today Prepare market integration', () => {
  it('renders native data and reviewed released results and selects only the requested canonical instrument', async () => {
    show()
    expect(await screen.findByText('18,765.4321 EUR')).toBeInTheDocument()
    expect(await screen.findByText('Actual: 4.1 %')).toBeInTheDocument()
    expect(screen.getByText('TradingView display only')).toBeInTheDocument()
    expect(screen.getByText(/Forecast \/ consensus: Unavailable/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^GBPUSD\./ }))
    await waitFor(() => expect(fetchMarketWorkspace).toHaveBeenCalledWith('a1', 'GBPUSD', expect.any(String), expect.any(AbortSignal)))
    expect(screen.queryByText('18,765.4321 EUR')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Market context' })).toHaveAttribute('href', '#market-context')
  })
  it('keeps manual levels exact, saves them privately and carries them into Ready without a price connection', async () => {
    vi.mocked(fetchMarketWorkspace).mockResolvedValue({ retrievedAt: new Date().toISOString(), selectedInstrument: 'GER40', quotes: [], macroObservations: [] })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Add private level' }))
    fireEvent.change(screen.getByLabelText('Price level'), { target: { value: '18500.25' } })
    fireEvent.change(screen.getByLabelText('Unit / quote currency'), { target: { value: 'EUR' } })
    fireEvent.change(screen.getByLabelText('Your note'), { target: { value: 'Private thesis level' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply level' }))
    expect(screen.getByText('18,500.25 EUR')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^GBPUSD\./ }))
    expect(screen.queryByText('18,500.25 EUR')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ready — Start session' }))
    await waitFor(() => expect(saveSessionReview).toHaveBeenCalled())
    const request=vi.mocked(saveSessionReview).mock.calls.at(-1)![3]
    expect(request.preparation?.manualLevels?.[0]).toMatchObject({ instrument: 'OANDA:DE30EUR', value: 18500.25, unit: 'EUR', note: 'Private thesis level' })
    expect(request.preparation?.marketDataSnapshot?.instruments).toEqual([])
  })
  it('does not display expired numbers on the active route', async () => {
    const data = await vi.mocked(fetchMarketWorkspace).getMockImplementation()!('a1','GER40','2026-09-25')
    data.quotes[0].observedAt = new Date(Date.now() - 60000).toISOString()
    vi.mocked(fetchMarketWorkspace).mockResolvedValue(data)
    show()
    expect((await screen.findAllByText('Quote expired. Waiting for a fresh provider observation.')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/18,765.4321/)).not.toBeInTheDocument()
  })
  it('saves only provider metadata at Ready and stops native polling outside Prepare', async () => {
    show()
    await screen.findByText('18,765.4321 EUR')
    fireEvent.click(screen.getByRole('button', { name: 'Ready — Start session' }))
    await waitFor(() => expect(saveSessionReview).toHaveBeenCalled())
    const request = vi.mocked(saveSessionReview).mock.calls.find(call => call[3].state === 'TRADE')?.[3]
    expect(request?.preparation?.marketDataSnapshot?.instruments[0].providerSymbol).toBe('DE30_EUR')
    expect(JSON.stringify(request?.preparation?.marketDataSnapshot)).not.toMatch(/18765|"mid"|"bid"|"ask"|TradingView/)
    await waitFor(() => expect(screen.queryByText('Native instrument watchlist')).not.toBeInTheDocument())
  })
})

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewsEventsPanel from './NewsEventsPanel'
import { fetchNewsContext, forecastDifference, requestCompanyNews, type NewsContext } from '../../api/newsContext'
vi.mock('../../api/newsContext', async original => ({ ...await original<typeof import('../../api/newsContext')>(), fetchNewsContext: vi.fn(), refreshNewsContext: vi.fn(), requestCompanyNews: vi.fn().mockResolvedValue({ state: 'MAPPING_REQUIRED' }) }))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en-GB' }) }))
const result = (instrument = 'GER40'): NewsContext => ({ instrument, topic: 'GERMANY', date: '2026-10-01', timezone: 'Europe/Bucharest', window: 'SESSION', asOf: '2026-10-01T14:00:00Z', historical: false, lastSuccessAt: '2026-10-01T13:00:00Z', news: [{ id: 's1', headline: 'Euro-area policy announcement', publisher: 'ECB', url: 'https://www.ecb.europa.eu/', publishedAt: '2026-10-01T09:00:00Z', category: 'EURO_AREA_MACRO' }], events: [], observations: [], coverage: [{ source: 'ECB', capability: 'NEWS', state: 'OK', lastSuccessAt: '2026-10-01T13:00:00Z', lastAttemptAt: null, nextRefreshAt: null }] })
let client: QueryClient
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T12:00:00Z')); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); vi.mocked(fetchNewsContext).mockResolvedValue(result()); vi.mocked(requestCompanyNews).mockResolvedValue({ state: 'MAPPING_REQUIRED' }) })
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks() })
const panel = (instrument = 'GER40') => <QueryClientProvider client={client}><NewsEventsPanel instrument={instrument} date="2026-10-01" timezone="Europe/Bucharest" isCurrentDate /></QueryClientProvider>
describe('automatic news and events', () => {
  it('renders without briefing data and reports actual successful fetch time', async () => {
    render(panel())
    expect(await screen.findByRole('link', { name: 'Euro-area policy announcement' })).toHaveAttribute('href', 'https://www.ecb.europa.eu/')
    expect(screen.getByText(/news.updated/)).toHaveTextContent('16:00')
    expect(fetchNewsContext).toHaveBeenCalledWith(expect.objectContaining({ instrument: 'GER40', timezone: 'Europe/Bucharest', window: 'SESSION' }), expect.any(AbortSignal))
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })
  it('cancels a previous instrument response and never places it under the next instrument', async () => {
    let finish!: (data: NewsContext) => void
    let firstSignal: AbortSignal | undefined
    vi.mocked(fetchNewsContext).mockImplementation((request, signal) => request.instrument === 'GER40' ? new Promise(resolve => { finish = resolve; firstSignal = signal }) : Promise.resolve({ ...result('NQ'), news: [] }))
    const view = render(panel())
    await waitFor(() => expect(firstSignal).toBeDefined())
    view.rerender(panel('NQ'))
    await screen.findByText('news.emptyNews')
    await act(async () => finish(result()))
    expect(firstSignal?.aborted).toBe(true)
    expect(screen.queryByText('Euro-area policy announcement')).not.toBeInTheDocument()
    expect(screen.getByText('NQ')).toBeInTheDocument()
  })
  it('distinguishes failure, stale cache, unsupported history and successful empty results', async () => {
    vi.mocked(fetchNewsContext).mockResolvedValue({ ...result(), news: [], coverage: [{ ...result().coverage[0], state: 'FAILED' }] })
    const view = render(panel())
    await screen.findByText('news.fetchFailed')
    expect(screen.queryByText('news.emptyNews')).not.toBeInTheDocument()
    view.unmount(); client.clear()
    vi.mocked(fetchNewsContext).mockResolvedValue({ ...result(), coverage: [{ ...result().coverage[0], state: 'STALE' }] })
    render(panel())
    await screen.findByText('news.stale')
    expect(screen.getByText('Euro-area policy announcement')).toBeInTheDocument()
  })
  it('shows zero results, hides an absent forecast column and does not infer direction', async () => {
    vi.mocked(fetchNewsContext).mockResolvedValue({ ...result(), events: [{ id: 'e', name: 'Official released result', region: 'EU', scheduledAt: null, scheduledDate: '2026-10-01', sourceTimezone: 'Europe/Luxembourg', source: 'Eurostat', url: 'https://ec.europa.eu/', category: 'EURO_AREA_MACRO', status: 'RELEASED', referencePeriod: '2026-09', actual: { value: 0, series: 's', period: '2026-09', unit: '%', adjustment: 'NSA' }, forecast: null, previous: null, revisedPrevious: null, publishedAt: '2026-10-01T09:00:00Z', sourceUpdatedAt: null }] })
    render(panel()); await screen.findByText('Euro-area policy announcement')
    fireEvent.click(screen.getByText('news.officialReleases'))
    expect(screen.getByText('news.actual: 0 %')).toBeInTheDocument()
    expect(screen.queryByText(/news.forecast/)).not.toBeInTheDocument()
    expect(screen.queryByText(/bullish|bearish/i)).not.toBeInTheDocument()
    expect(forecastDifference({ value: 0, series: 's', period: '2026-09', unit: '%', adjustment: 'NSA' }, { value: 1, series: 's', period: '2026-08', unit: '%', adjustment: 'NSA' })).toBeNull()
  })
  it('uses an explicit last-24-hours request without silently widening the session', async () => {
    render(panel()); await screen.findByText('Euro-area policy announcement')
    fireEvent.click(screen.getByRole('button', { name: 'news.last24' }))
    await waitFor(() => expect(fetchNewsContext).toHaveBeenLastCalledWith(expect.objectContaining({ window: 'LAST_24_HOURS' }), expect.any(AbortSignal)))
  })
  it('keeps the calendar mounted across instrument switches and warnings above both tabs', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T12:00:00Z'))
    const view = render(panel()); await screen.findByText('Euro-area policy announcement')
    fireEvent.click(screen.getByRole('tab', { name: 'news.events' }))
    const frame = screen.getByTitle('news.tradays.title')
    expect(screen.getByText('news.tradays.warning.UNAVAILABLE')).toBeVisible()
    view.rerender(panel('UK100'))
    expect(screen.getByTitle('news.tradays.title')).toBe(frame)
    expect(screen.getByRole('tab', { name: 'news.events' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'news.latest' }))
    expect(screen.getByText('news.tradays.warning.UNAVAILABLE')).toBeVisible()
    vi.mocked(Date.now).mockRestore()
  })
  it('rejects old timezone responses and suppresses live embeds in as-of views', async () => {
    vi.mocked(fetchNewsContext).mockResolvedValue({ ...result(), timezone: 'America/New_York' })
    render(<QueryClientProvider client={client}><NewsEventsPanel instrument="GER40" date="2026-10-01" timezone="Europe/Bucharest" isCurrentDate asOf="2026-10-01T10:00:00Z" /></QueryClientProvider>)
    await waitFor(() => expect(fetchNewsContext).toHaveBeenCalled())
    expect(screen.queryByText('Euro-area policy announcement')).toBeNull()
    expect(screen.queryByTitle('news.tradays.title')).toBeNull()
    expect(screen.queryByText('news.tradays.warning.UNAVAILABLE')).toBeNull()
  })
  it('queues company demand separately without a refresh and keeps the qualified identity', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T12:00:00Z'))
    vi.mocked(fetchNewsContext).mockResolvedValue(result('NASDAQ:AAPL'))
    render(panel('NASDAQ:AAPL'))
    await waitFor(() => expect(requestCompanyNews).toHaveBeenCalledWith('NASDAQ:AAPL'))
    expect(screen.getByText('NASDAQ:AAPL')).toBeInTheDocument()
    expect(await screen.findByText('news.demand.MAPPING_REQUIRED')).toBeInTheDocument()
    vi.mocked(Date.now).mockRestore()
  })

})

import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '../../api/client'
import MarketIntelligenceGrid from './MarketIntelligenceGrid'

vi.mock('../../api/client', () => ({ apiGet: vi.fn() }))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, language: 'en', locale: 'en-GB' }) }))

const publication = {
  id: 'pub-1',
  publishedAt: '2026-09-24T07:00:00Z',
  document: { translations: { en: { events: [{ id: 'cpi', scheduledAt: '2026-09-24T12:30:00Z', timezone: 'America/New_York', region: 'US', name: 'CPI release', source: 'BLS', sourceUrl: 'https://www.bls.gov/', status: 'UPCOMING', impact: null, actual: null, forecast: null, previous: null }] } } }
}

afterEach(cleanup)
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiGet).mockResolvedValue({ selected: publication } as never) })

function show(analysis?: unknown, briefingId?: string, extra: Partial<ComponentProps<typeof MarketIntelligenceGrid>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MarketIntelligenceGrid
    preparation={{ bias: 'neutral', contextAcknowledged: false, briefingId } as never}
    thesis=""
    briefing={null}
    onAcknowledge={vi.fn()}
    acknowledgeLabel="acknowledge"
    date="2026-09-24"
    selectedInstrument="GER40"
    analysis={analysis as never}
    {...extra}
  /></QueryClientProvider>)
}

describe('Today market information', () => {
  it('shows newly published results in current Prepare without replacing captured levels or acknowledging context', async () => {
    const captured = { ...publication, document: { ...publication.document, translations: { en: { ...publication.document.translations.en,
      levels: [{ id: 'captured-level', instrument: 'GER40', label: 'SUPPORT', value: 18000, unit: 'EUR', source: 'Captured source', rationale: 'Acknowledged level' }] } } } }
    const released = { ...publication, id: 'pub-new', document: { referenceTime: '2026-09-24T14:00:00Z', translations: { en: {
      events: [{ ...publication.document.translations.en.events[0], status: 'RELEASED', actual: '4.1', unit: '%', publishedAt: '2026-09-24T12:30:00Z' }],
      levels: [{ id: 'new-level', instrument: 'GER40', label: 'SUPPORT', value: 19000, unit: 'EUR', source: 'New source', rationale: 'Unacknowledged level' }]
    } } } }
    vi.mocked(apiGet).mockImplementation(async path => ({ selected: path.includes('/today/briefing/version/') ? captured : released }) as never)
    const acknowledge = vi.fn()
    show(undefined, 'frozen-capture', { isCurrentDate: true, onAcknowledge: acknowledge })
    expect(await screen.findByText('workstation.eventActual: 4.1 %')).toBeInTheDocument()
    expect(await screen.findByText('Acknowledged level · Captured source')).toBeInTheDocument()
    expect(screen.queryByText('Unacknowledged level · New source')).not.toBeInTheDocument()
    expect(screen.getByText('workstation.eventUpdatesBoundary')).toBeInTheDocument()
    expect(screen.getByText(/workstation.eventsCheckedAt/)).toBeInTheDocument()
    expect(acknowledge).not.toHaveBeenCalled()
    expect(captured.document.translations.en.events[0].actual).toBeNull()
  })
  it('opens and focuses Market Context by keyboard instead of the realized-P&L calendar', async () => {
    const user = userEvent.setup()
    show(undefined, undefined, { briefing: <span>Published context details</span> })
    await screen.findByText('CPI release')
    const action = screen.getByRole('link', { name: 'workstation.marketContext' })
    expect(action).toHaveAttribute('href', '#market-context')
    await act(async () => { action.focus(); await user.keyboard('{Enter}') })
    expect(action).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('market-context-details')).toHaveAttribute('open')
    expect(document.getElementById('market-context')).toHaveFocus()
    expect(screen.getByText('Published context details')).toBeVisible()
  })
  it('hides an expired quote and quote-derived change while retaining separate completed references', async () => {
    const analysis = { canonicalInstrument: 'GER40', provider: 'OANDA', providerSymbol: 'DE30_EUR', priceBasis: 'MID', freshness: 'CLOSE', provenance: 'USER_CONNECTED',
      previousDayHigh: 18010, dailyAlignment: '17:00 America/New_York', retrievedAt: '2026-09-24T12:00:00Z', changePercent: 8.88 }
    const quote = { canonicalInstrument: 'GER40', provider: 'OANDA', providerSymbol: 'DE30_EUR', instrumentType: 'CFD', priceBasis: 'MID', freshness: 'LIVE', provenance: 'USER_CONNECTED',
      observedAt: new Date(Date.now() - 60000).toISOString(), retrievedAt: new Date().toISOString(), mid: 19099, unit: 'EUR' }
    show(analysis, undefined, { quotes: [quote as never] })
    await screen.findByText('CPI release')
    expect(screen.queryByText('19,099 EUR')).not.toBeInTheDocument()
    expect(screen.queryByText('8.88%')).not.toBeInTheDocument()
    expect(screen.getByText('18,010 EUR')).toBeInTheDocument()
    expect(screen.getByText('workstation.availability.STALE_QUOTE')).toBeInTheDocument()
  })
  it('rejects another provider symbol even if the canonical label matches', async () => {
    show({ canonicalInstrument: 'GER40', provider: 'OANDA', providerSymbol: 'SPX500_USD', priceBasis: 'MID', freshness: 'CLOSE', provenance: 'USER_CONNECTED', previousDayHigh: 9988 })
    await screen.findByText('CPI release')
    expect(screen.queryByText('9,988')).not.toBeInTheDocument()
  })
  it('keeps Treasury observations daily even if an upstream freshness flag is incorrect', async () => {
    show(undefined, undefined, { macroObservations: [{ canonicalInstrument: 'US2Y', provider: 'US_TREASURY', providerSymbol: 'BC_2YEAR', instrumentType: 'GOVERNMENT_YIELD',
      priceBasis: 'OFFICIAL_DAILY_CLOSE', value: 4.25, unit: '%', observationDate: '2026-09-24', retrievedAt: '2026-09-25T10:00:00Z', freshness: 'LIVE', provenance: 'OFFICIAL_PUBLIC' }] })
    await screen.findByText('CPI release')
    expect(screen.getByText('4.250%')).toBeInTheDocument()
    expect(screen.getByText(/workstation.officialDailyReference/)).toHaveTextContent('2026-09-24')
    expect(screen.queryByText(/workstation.freshness.LIVE/)).not.toBeInTheDocument()
  })
  it('uses the preparation capture for events instead of a newer publication', async () => {
    vi.mocked(apiGet).mockClear()
    show(undefined, 'frozen-capture')
    expect(await screen.findByText('CPI release')).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet).toHaveBeenCalledWith('/today/briefing/version/frozen-capture', expect.any(AbortSignal))
  })
  it('uses only the published briefing selection for events and leaves missing native values unavailable', async () => {
    show()
    expect(await screen.findByText('CPI release')).toBeInTheDocument()
    expect(screen.getByText(/America\/New_York/)).toBeInTheDocument()
    expect(screen.queryByText('Impact unavailable')).not.toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith('/session-briefings?date=2026-09-24', expect.any(AbortSignal))
    expect(screen.getByText('GER40 · workstation.exactInstrumentScope')).toBeInTheDocument()
    expect(screen.getAllByText('workstation.unavailable').length).toBeGreaterThan(1)
  })

  it('does not present a future actual value for a not-yet-released event', async () => {
    const futureActual = {
      ...publication,
      document: {
        translations: {
          en: { events: [{ ...publication.document.translations.en.events[0], actual: '3.7%' }] }
        }
      }
    }
    vi.mocked(apiGet).mockResolvedValue({ selected: futureActual } as never)
    show()
    await screen.findByText('CPI release')
    expect(screen.queryByText(/3.7%/)).not.toBeInTheDocument()
  })

  it('never renders another instrument analysis after the selection changes', async () => {
    show({ canonicalInstrument: 'GBPUSD', provider: 'OANDA', providerSymbol: 'GBP_USD', priceBasis: 'MID',
      previousDayHigh: 1.35, previousDayLow: 1.30, retrievedAt: '2026-09-24T12:00:00Z', freshness: 'CLOSE',
      provenance: 'USER_CONNECTED', dailyAlignment: '17:00 America/New_York' })
    await screen.findByText('CPI release')
    expect(screen.queryByText('1.35')).not.toBeInTheDocument()
    expect(screen.queryByText('1.30')).not.toBeInTheDocument()
  })

  it('shows only explicitly published levels for the selected canonical instrument', async () => {
    const withLevels = { ...publication, document: { translations: { en: { ...publication.document.translations.en, levels: [
      { id: 'ger-support', instrument: 'GER40', label: 'SUPPORT', value: 18000, unit: 'EUR points', source: 'Reviewed briefing', rationale: 'Published level' },
      { id: 'gbp-support', instrument: 'GBPUSD', label: 'SUPPORT', value: 1.25, unit: 'USD', source: 'Reviewed briefing', rationale: 'Other instrument' }
    ] } } } }
    vi.mocked(apiGet).mockResolvedValue({ selected: withLevels } as never)
    show()
    expect(await screen.findByText('Published level · Reviewed briefing')).toBeInTheDocument()
    expect(screen.queryByText('Other instrument · Reviewed briefing')).not.toBeInTheDocument()
    expect(screen.getByText('18,000 EUR points')).toBeInTheDocument()
  })
})

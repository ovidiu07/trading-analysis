import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
beforeEach(() => vi.mocked(apiGet).mockResolvedValue({ selected: publication } as never))

function show(analysis?: unknown, briefingId?: string) {
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
  /></QueryClientProvider>)
}

describe('Today market information', () => {
  it('uses the preparation capture for events instead of a newer publication', async () => {
    vi.mocked(apiGet).mockClear()
    show(undefined, 'frozen-capture')
    expect(await screen.findByText('CPI release')).toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet).toHaveBeenCalledWith('/today/briefing/version/frozen-capture')
  })
  it('uses only the published briefing selection for events and leaves missing native values unavailable', async () => {
    show()
    expect(await screen.findByText('CPI release')).toBeInTheDocument()
    expect(screen.getByText(/America\/New_York/)).toBeInTheDocument()
    expect(screen.queryByText('Impact unavailable')).not.toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledWith('/session-briefings?date=2026-09-24')
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

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

function show() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MarketIntelligenceGrid
    preparation={{ bias: 'neutral', contextAcknowledged: false } as never}
    thesis=""
    briefing={null}
    onAcknowledge={vi.fn()}
    acknowledgeLabel="acknowledge"
    date="2026-09-24"
    selectedInstrument="GER40"
  /></QueryClientProvider>)
}

describe('Today market information', () => {
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
    expect(screen.queryByText(/workstation.eventActual/)).not.toBeInTheDocument()
  })
})

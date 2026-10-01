import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarketIntelligenceGrid from './MarketIntelligenceGrid'
import { initialPreparation } from '../../features/preparation/context'

vi.mock('../../api/client', () => ({ apiGet: vi.fn(async () => ({ instrument: 'GER40', date: '2026-10-01', window: 'SESSION', news: [], events: [], observations: [], coverage: [] })), apiPost: vi.fn() }))
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, language: 'en', locale: 'en-GB' }) }))
afterEach(cleanup)
function show() {
  const acknowledge = vi.fn()
  const preparation = { ...initialPreparation(), contextAcknowledged: true, manualLevels: [{ id: 'saved', instrument: 'OANDA:DE30EUR', value: 18500, unit: 'EUR' }] }
  render(<QueryClientProvider client={new QueryClient()}><MarketIntelligenceGrid preparation={preparation as never} thesis="My own plan" briefing={<span>Editorial snapshot</span>} onAcknowledge={acknowledge} acknowledgeLabel="Acknowledge" date="2026-10-01" selectedInstrument="GER40" /></QueryClientProvider>)
  return { preparation, acknowledge }
}
describe('Today context layout', () => {
  it('removes optional empty cards, levels and diagnostics without modifying stored preparation', async () => {
    const { preparation, acknowledge } = show()
    await screen.findByText('news.emptyNews')
    for (const key of ['workstation.keyLevels', 'workstation.sessionRange', 'workstation.crossMarket', 'workstation.unavailable', 'prepare.neutral']) expect(screen.queryByText(key)).not.toBeInTheDocument()
    expect(screen.getByText('news.personalThesis')).toBeInTheDocument()
    expect(screen.getByText('My own plan')).toBeInTheDocument()
    expect(preparation.manualLevels).toHaveLength(1)
    expect(acknowledge).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(acknowledge).toHaveBeenCalledWith(false)
  })
})

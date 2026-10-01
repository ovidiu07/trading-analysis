import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MarketTickerStrip from './MarketTickerStrip'
vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key, locale: 'en-GB' }) }))
afterEach(cleanup)
describe('Today instrument selection', () => {
  it('keeps instruments selectable without quote diagnostics or fabricated numbers', () => {
    const onSelect = vi.fn()
    render(<MarketTickerStrip selectedSymbol="OANDA:DE30EUR" onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'GER40' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(/unavailable|providerRequired|noAuthorizedSource/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ES' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'ES', tradingViewSymbol: 'CME_MINI:ES1!' }))
  })
  it('hides expired quotes and leaves the selection name', () => {
    const observedAt = new Date(Date.now() - 60000).toISOString()
    const quote = { canonicalInstrument: 'GBPUSD', provider: 'OANDA', providerSymbol: 'GBP_USD', instrumentType: 'FX', priceBasis: 'MID' as const, unit: 'USD', retrievedAt: observedAt, observedAt, mid: 1.25, freshness: 'LIVE' as const, provenance: 'USER_CONNECTED' }
    render(<MarketTickerStrip selectedSymbol="OANDA:GBPUSD" onSelect={vi.fn()} quotes={[quote]} />)
    expect(screen.getByRole('button', { name: 'GBPUSD' })).toHaveTextContent('GBPUSD')
    expect(screen.queryByText(/1.25|STALE_QUOTE|OANDA/)).not.toBeInTheDocument()
  })
})

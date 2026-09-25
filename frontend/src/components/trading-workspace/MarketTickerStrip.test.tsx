import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MarketTickerStrip from './MarketTickerStrip'

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

afterEach(cleanup)

describe('Today instrument watchlist', () => {
  it('keeps unsupported instruments selectable and announces unavailable data', () => {
    const onSelect = vi.fn()
    render(<MemoryRouter><MarketTickerStrip selectedSymbol="OANDA:DE30EUR" onSelect={onSelect} /></MemoryRouter>)
    const ger40 = screen.getByRole('button', { name: /GER40/ })
    expect(ger40).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /DXY/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('workstation.providerRequired')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'workstation.connectProvider' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('button', { name: /DXY\. workstation\.freshness\.UNAVAILABLE/ })).toHaveAttribute('title', expect.stringContaining('workstation.availability.SYMBOL_NOT_SUPPORTED'))
    fireEvent.click(screen.getByRole('button', { name: /ES/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'ES', tradingViewSymbol: 'CME_MINI:ES1!' }))
  })
  it('shows an authorization reason on each native card and keeps settings available', () => {
    const quote = { canonicalInstrument: 'GBPUSD', provider: 'OANDA', providerSymbol: 'GBP_USD', instrumentType: 'FX', priceBasis: 'MID' as const, unit: 'USD', retrievedAt: new Date().toISOString(), freshness: 'UNAVAILABLE' as const, provenance: 'USER_CONNECTED', availabilityReason: 'LICENSE_REQUIRED' as const }
    render(<MemoryRouter><MarketTickerStrip selectedSymbol="OANDA:GBPUSD" onSelect={vi.fn()} quotes={[quote]} environment="PRACTICE" /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /GBPUSD/ })).toHaveTextContent('workstation.availability.LICENSE_REQUIRED')
    expect(screen.getByRole('link', { name: 'workstation.connectProvider' })).toBeInTheDocument()
    expect(screen.getByText(/workstation.nativeDisplayBoundary/)).toHaveTextContent('PRACTICE')
    expect(screen.getByRole('button', { name: /GBPUSD/ })).toHaveTextContent('FX · MID')
  })
  it('displays old quotes as stale with visible provenance and observation time', () => {
    const observedAt = new Date(Date.now() - 60_000).toISOString()
    const quote = { canonicalInstrument: 'GBPUSD', provider: 'OANDA', providerSymbol: 'GBP_USD', instrumentType: 'FX', priceBasis: 'MID' as const, unit: 'USD', retrievedAt: observedAt, observedAt, mid: 1.25, freshness: 'LIVE' as const, provenance: 'USER_CONNECTED' }
    render(<MemoryRouter><MarketTickerStrip selectedSymbol="OANDA:GBPUSD" onSelect={vi.fn()} quotes={[quote]} /></MemoryRouter>)
    const card = screen.getByRole('button', { name: /GBPUSD/ })
    expect(card).toHaveTextContent('workstation.freshness.STALE')
    expect(card).toHaveTextContent(observedAt)
    expect(card).toHaveTextContent('OANDA GBP_USD')
  })

})

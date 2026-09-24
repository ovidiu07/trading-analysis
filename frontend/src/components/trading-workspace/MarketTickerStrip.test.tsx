import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MarketTickerStrip from './MarketTickerStrip'

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('Today instrument watchlist', () => {
  it('keeps unsupported instruments selectable and announces unavailable data', () => {
    const onSelect = vi.fn()
    render(<MemoryRouter><MarketTickerStrip selectedSymbol="OANDA:DE30EUR" onSelect={onSelect} /></MemoryRouter>)
    const ger40 = screen.getByRole('button', { name: /GER40/ })
    expect(ger40).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /DXY/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText('workstation.noAuthorizedSource')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: /ES/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'ES', tradingViewSymbol: 'CME_MINI:ES1!' }))
  })
})

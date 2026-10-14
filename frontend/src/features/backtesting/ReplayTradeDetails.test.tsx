import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BacktestingTrade } from '../../api/backtesting'
import { I18nProvider } from '../../i18n'
import ReplayTradeDetails from './ReplayTradeDetails'

const trade = { id: 'one', date: '2025-10-03', entryTime: '18:00', exitDate: '2025-10-03', exitTime: '18:55', instrument: 'PEPPERSTONE:GER40F',
  entryPrice: 24490.7, exitPrice: 24527.1, priceCurrency: 'EUR', positionValue: 88166.52, netPnl: 153.53, currency: 'USD', tags: [] } as BacktestingTrade

describe('Replay trade price units', () => {
  it('keeps EUR execution prices separate from USD PnL and leaves unqualified source position value unlabelled', () => {
    render(<I18nProvider><ReplayTradeDetails trade={trade} onClose={vi.fn()} /></I18nProvider>)
    expect(screen.getByText('24490.7 EUR')).toBeInTheDocument()
    expect(screen.getByText('24527.1 EUR')).toBeInTheDocument()
    const position = screen.getByRole('row', { name: /position value/i })
    expect(within(position).getByText('88166.52')).toBeInTheDocument()
    expect(position.textContent).not.toContain('USD')
    expect(screen.getByText('$153.53')).toBeInTheDocument()
  })
  it('does not infer a missing price currency from the PnL currency', () => {
    render(<I18nProvider><ReplayTradeDetails trade={{ ...trade, priceCurrency: null }} onClose={vi.fn()} /></I18nProvider>)
    const entry = screen.getByRole('row', { name: /Entry price/ })
    expect(entry.textContent).toContain('24490.7')
    expect(entry.textContent).not.toContain('USD')
    expect(screen.getByRole('row', { name: 'Price currency Unspecified' })).toBeInTheDocument()
  })
})

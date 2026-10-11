import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BacktestingTrade } from '../../api/backtesting'
import { I18nProvider } from '../../i18n'
import BacktestingCalendar from './BacktestingCalendar'

const rows: BacktestingTrade[] = [
  { id: 'overnight', workspaceId: 'workspace', date: '2026-01-31', exitDate: '2026-02-01', entryTime: '23:30:00', exitTime: '01:00:00', instrument: 'NQ', direction: 'LONG', result: 'WIN', pnlR: 2, netPnl: 200, currency: 'USD', source: 'IMPORT', tradeScope: 'REPLAY', importFormat: 'TRADINGVIEW_REPLAY', tags: [] },
  { id: 'loss', workspaceId: 'workspace', date: '2026-02-02', entryTime: '09:00:00', instrument: 'NQ', direction: 'SHORT', result: 'LOSS', pnlR: -1, netPnl: -100, currency: 'USD', source: 'MANUAL', tradeScope: 'BACKTEST', tags: [] },
  { id: 'live', workspaceId: 'workspace', date: '2026-03-02', entryTime: '09:00:00', instrument: 'LIVE-ONLY', direction: 'LONG', result: 'WIN', pnlR: 50, source: 'LIVE', tradeScope: 'LIVE', tags: [] }
]

function calendar(trades = rows) {
  return <I18nProvider><BacktestingCalendar workspaceId="workspace" trades={trades} /></I18nProvider>
}

describe('BacktestingCalendar', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })))
  })

  it('starts on the latest tested month and opens exit-day trades with R and cash results', async () => {
    render(calendar())
    expect(screen.getAllByText('February 2026').length).toBeGreaterThan(0)
    const day = screen.getByRole('button', { name: 'View backtested trades for 2026-02-01. 1 trades. Result $200.00' })
    await userEvent.click(day)
    const dialog = screen.getByRole('dialog', { name: 'Backtested trades · Feb 1, 2026' })
    expect(within(dialog).getByText('NQ · Long')).toBeInTheDocument()
    expect(within(dialog).getAllByText('2R')).toHaveLength(2)
    expect(within(dialog).getAllByText('$200.00')).toHaveLength(2)
    expect(within(dialog).queryByText('LIVE-ONLY')).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replay details' }))
    expect(screen.getByRole('dialog', { name: 'Replay details' })).toBeInTheDocument()
  })

  it('switches between R and cash, drills into a week, and navigates months', async () => {
    render(calendar())
    await userEvent.click(screen.getByRole('combobox', { name: 'Performance unit' }))
    await userEvent.click(screen.getByRole('option', { name: 'R', exact: true }))
    expect(screen.getByRole('button', { name: /for 2026-02-02.*Result -1R/ })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Weekly performance' })
    const firstWeek = within(table).getAllByRole('row')[1]
    expect(within(firstWeek).getByText('2R')).toBeInTheDocument()
    expect(within(firstWeek).getByText('$200.00')).toBeInTheDocument()
    await userEvent.click(within(firstWeek).getByRole('button'))
    expect(screen.getByRole('dialog', { name: 'Backtested trades · Feb 1, 2026' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Previous month' }))
    expect(screen.getAllByText('January 2026').length).toBeGreaterThan(0)
    expect(screen.getByText('No backtested trades in this month')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Jump to month'), { target: { value: '2026-02' } })
    expect(screen.queryByText('No backtested trades in this month')).not.toBeInTheDocument()
  })

  it('updates an open day when workspace filters change and keeps missing R unavailable', async () => {
    const input = rows.map(row => ({ ...row, pnlR: null }))
    const view = render(calendar(input))
    await userEvent.click(screen.getByRole('button', { name: /for 2026-02-01.*Result \$200/ }))
    expect(within(screen.getByRole('dialog')).queryByText('0R')).not.toBeInTheDocument()
    view.rerender(calendar([input[1]]))
    expect(within(screen.getByRole('dialog')).getByText('No trades')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).queryByText('NQ · Long')).not.toBeInTheDocument()
  })

  it('uses day rows on compact screens with all weekly and ranking information available', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })))
    render(calendar())
    expect(screen.getAllByRole('button', { name: /^View backtested trades for/ })).toHaveLength(28)
    expect(screen.getByRole('heading', { name: 'Best weeks' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Best months' })).toBeInTheDocument()
    const firstWeek = within(screen.getByRole('list', { name: 'Weekly performance' })).getAllByRole('listitem')[0]
    expect(within(firstWeek).getByText('2R')).toBeInTheDocument()
    expect(within(firstWeek).getByText('$200.00')).toBeInTheDocument()
  })
})

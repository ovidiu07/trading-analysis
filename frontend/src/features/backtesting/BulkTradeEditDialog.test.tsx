import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import type { BacktestingTrade, BacktestingWorkspace } from '../../api/backtesting'
import BulkTradeEditDialog from './BulkTradeEditDialog'
import { ManualTradeDialog } from './BacktestingDialogs'
const api = vi.hoisted(() => ({ updateBacktestingTrades: vi.fn() }))
vi.mock('../../api/backtesting', () => api)
const trades = [{ id: 'winner', result: 'WIN', netPnl: 150 }, { id: 'loser', result: 'LOSS', netPnl: -100 }] as BacktestingTrade[]
function setup() {
  const onSaved = vi.fn().mockResolvedValue(undefined)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><I18nProvider><BulkTradeEditDialog workspaceId="workspace" trades={trades} onClose={vi.fn()} onSaved={onSaved} /></I18nProvider></QueryClientProvider>)
  return onSaved
}
describe('bulk backtesting edits', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('app.language', 'en') })
  it('sends only checked fields and an explicit outcome-based R operation', async () => {
    api.updateBacktestingTrades.mockResolvedValue([])
    const saved = setup()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Change Planned R:R' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Calculate R from/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Change Trade notes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Apply to 2 trades' }))
    expect(api.updateBacktestingTrades).toHaveBeenCalledWith('workspace', {
      tradeIds: ['winner', 'loser'], fields: ['plannedRR', 'notes'], changes: { plannedRR: 1.5, notes: null }, deriveRFromPlannedRR: true, recalculateSession: true
    })
    expect(saved).toHaveBeenCalledTimes(1)
  })
  it('rejects a positive realised R shared by winners and losers', async () => {
    setup()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Change R multiple' }))
    await userEvent.type(screen.getByRole('spinbutton', { name: 'R multiple' }), '1.5')
    expect(screen.getByRole('button', { name: 'Apply to 2 trades' })).toBeDisabled()
    expect(api.updateBacktestingTrades).not.toHaveBeenCalled()
  })
  it('keeps the selection and error visible when the atomic update fails', async () => {
    api.updateBacktestingTrades.mockRejectedValue(new Error('One or more trades were not found'))
    const saved = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Apply to 2 trades' }))
    expect(await screen.findByText('One or more trades were not found')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit 2 selected trades' })).toBeInTheDocument()
    expect(saved).not.toHaveBeenCalled()
  })
  it('updates the read-only session when entry date, time or source timezone changes', async () => {
    render(<I18nProvider><ManualTradeDialog open workspace={{ id: 'workspace', symbol: 'GER40' } as BacktestingWorkspace} trade={null} strategies={[]} saving={false} onClose={vi.fn()} onSave={vi.fn()} /></I18nProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'Show optional fields' }))
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '2025-10-24' } })
    const time = screen.getByLabelText('Entry time')
    const session = screen.getByLabelText('Session')
    expect(session).toHaveAttribute('readonly')
    for (const [value, expected] of [['10:30', 'London'], ['16:25', 'London'], ['16:26', ''], ['16:30', 'New York'], ['23:00', 'New York'], ['23:01', '']]) {
      fireEvent.change(time, { target: { value } })
      expect(session).toHaveValue(expected)
    }
    fireEvent.change(screen.getByLabelText('Export timezone (optional)'), { target: { value: 'UTC' } })
    fireEvent.change(time, { target: { value: '07:30' } })
    expect(session).toHaveValue('London')
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '2025-10-28' } })
    expect(session).toHaveValue('')
  })
})

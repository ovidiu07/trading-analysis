import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import ImportTradesDialog from './ImportTradesDialog'
import type { BacktestingWorkspace } from '../../api/backtesting'
const api = vi.hoisted(() => ({ importBacktestingTrades: vi.fn() }))
vi.mock('../../api/backtesting', () => api)
const workspace = { id: 'workspace-1', title: 'Five sessions', symbol: 'GER40U2026' } as BacktestingWorkspace
const result = { imported: 25, rowCount: 50, invalid: 1, duplicates: 2, format: 'TRADINGVIEW_REPLAY', errors: ['Row 55: entry has no matching exit'], trades: [] }
function setup() {
  const onImported = vi.fn().mockResolvedValue(undefined)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><I18nProvider><ImportTradesDialog workspace={workspace} onClose={vi.fn()} onImported={onImported} /></I18nProvider></QueryClientProvider>)
  return onImported
}
describe('backtesting replay import review', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('app.language', 'en') })
  it('previews before saving, keeps file symbol and surfaces validation and duplicate results', async () => {
    api.importBacktestingTrades.mockResolvedValueOnce({ ...result, preview: true }).mockResolvedValueOnce({ ...result, preview: false })
    const saved = setup()
    const file = new File(['csv'], 'Replay_Trading_PEPPERSTONE_GER40F_2025-10-06_to_2025-10-30_combined.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText(/Choose CSV/i), { target: { files: [file] } })
    expect(screen.getByRole('textbox', { name: 'CSV instrument' })).toHaveValue('PEPPERSTONE:GER40F')
    expect(screen.getByText(/differs from workspace/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(await screen.findByText(/25 closed trades ready/)).toBeInTheDocument()
    expect(api.importBacktestingTrades).toHaveBeenLastCalledWith('workspace-1', file, { instrument: 'PEPPERSTONE:GER40F', timezone: '', preview: true })
    expect(saved).not.toHaveBeenCalled(); expect(screen.getByText(/Row 55/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Import 25 trades' }))
    expect(await screen.findByText(/25 trades imported/)).toBeInTheDocument(); expect(saved).toHaveBeenCalledTimes(1)
    expect(api.importBacktestingTrades).toHaveBeenLastCalledWith('workspace-1', file, { instrument: 'PEPPERSTONE:GER40F', timezone: '', preview: false })
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })
  it('invalidates an old preview when metadata changes and disables an empty import', async () => {
    api.importBacktestingTrades.mockResolvedValue({ ...result, imported: 0, invalid: 0, duplicates: 25, errors: [], preview: true })
    setup()
    fireEvent.change(screen.getByLabelText(/Choose CSV/i), { target: { files: [new File(['csv'], 'renamed.csv')] } })
    expect(screen.getByText(/instrument could not be detected/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'CSV instrument' }), { target: { value: 'GER40F' } })
    await userEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(await screen.findByRole('button', { name: 'Import 0 trades' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'CSV instrument' }), { target: { value: 'PEPPERSTONE:GER40F' } })
    expect(screen.getByRole('button', { name: 'Preview import' })).toBeInTheDocument()
  })
  it.each([
    'Replay_Trading_PEPPERSTONE_GER40F_2026-10-09_0eb11.csv',
    'Replay_Trading_PEPPERSTONE_GER40F_2026-10-09.csv',
    'replay_trading_pepperstone_ger40f_2026-10-09_0eb11 (1).CSV'
  ])('detects the instrument in an original dated export: %s', async filename => {
    api.importBacktestingTrades.mockResolvedValue({ ...result, imported: 2, rowCount: 4, invalid: 0, duplicates: 0, errors: [], preview: true })
    setup()
    const file = new File(['csv'], filename, { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText(/Choose CSV/i), { target: { files: [file] } })
    expect(screen.getByRole('textbox', { name: 'CSV instrument' })).toHaveValue('PEPPERSTONE:GER40F')
    await userEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(await screen.findByText(/2 closed trades ready/)).toBeInTheDocument()
    expect(api.importBacktestingTrades).toHaveBeenLastCalledWith('workspace-1', file, { instrument: 'PEPPERSTONE:GER40F', timezone: '', preview: true })
  })
})

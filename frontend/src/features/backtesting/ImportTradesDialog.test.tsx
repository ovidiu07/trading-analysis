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
  it('applies a metadata-only reimport and refreshes existing trades without adding duplicates', async () => {
    const update = { ...result, imported: 0, invalid: 0, duplicates: 523, metadataUpdated: 523, errors: [], trades: [] }
    api.importBacktestingTrades.mockResolvedValueOnce({ ...update, preview: true }).mockResolvedValueOnce({ ...update, preview: false })
    const saved = setup()
    fireEvent.change(screen.getByLabelText(/Choose CSV/i), { target: { files: [new File(['csv'], 'Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_bb5c2.csv')] } })
    await userEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(await screen.findByText(/FVG details will be added to 523 existing trades/)).toBeInTheDocument()
    expect(saved).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Apply import' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Apply import' }))
    expect(await screen.findByText(/FVG details updated on 523 existing trades/)).toBeInTheDocument()
    expect(saved).toHaveBeenCalledOnce()
    expect(api.importBacktestingTrades).toHaveBeenLastCalledWith(workspace.id, expect.any(File), { instrument: 'PEPPERSTONE:GER40F', timezone: '', preview: false })
  })
  it.each([
    'Replay_Trading_PEPPERSTONE_GER40F_2026-10-09_0eb11.csv',
    'Replay_Trading_PEPPERSTONE_GER40F_2026-10-09.csv',
    'replay_trading_pepperstone_ger40f_2026-10-09_0eb11 (1).CSV',
    'Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv',
    'Another_strategy_PEPPERSTONE_GER40F_2025-01-01.csv'
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
  it('previews independent price/PnL currencies and imports the exact selected workspace', async () => {
    api.importBacktestingTrades.mockResolvedValue({ ...result, imported: 416, rowCount: 832, invalid: 0, duplicates: 0, errors: [], preview: true,
      trades: [{ instrument: 'PEPPERSTONE:GER40F', date: '2025-10-03', entryTime: '18:00', exitDate: '2025-10-03', exitTime: '18:55',
        entryPrice: 24490.7, exitPrice: 24527.1, priceCurrency: 'EUR', netPnl: 153.53, currency: 'USD', exitSignal: 'TP' }] })
    setup()
    const file = new File(['csv'], 'Five_Sessions_FVG_Windows_PEPPERSTONE_GER40F_2026-10-14_b1a3e.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText(/Choose CSV/i), { target: { files: [file] } })
    await userEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(await screen.findByText(/416 closed trades ready/)).toBeInTheDocument()
    expect(screen.getByText('24490.7 EUR')).toBeInTheDocument()
    expect(screen.getByText('24527.1 EUR')).toBeInTheDocument()
    expect(screen.getByText('153.53 USD')).toBeInTheDocument()
    expect(api.importBacktestingTrades).toHaveBeenLastCalledWith(workspace.id, file, { instrument: 'PEPPERSTONE:GER40F', timezone: '', preview: true })
  })
})

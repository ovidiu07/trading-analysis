import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BacktestingTrade, BacktestingWorkspace } from '../../api/backtesting'
import { I18nProvider, useI18n } from '../../i18n'
import ExportBacktestingDialog from './ExportBacktestingDialog'
import { prepareCompleteExport } from './completeExport'
vi.mock('./completeExport', () => ({ prepareCompleteExport: vi.fn(async () => ({ files: { 'trades.json': '[]' }, count: 1 })) }))
import { emptyResearchFilters } from './research'

const workspace = { id: 'one', title: 'Export test', symbol: 'GER40' } as BacktestingWorkspace
const trades: BacktestingTrade[] = [{ id: 'one', workspaceId: 'one', date: '2026-10-01', entryTime: '18:00:00', instrument: 'GER40', direction: 'LONG', result: 'WIN', pnlR: 1.5, tags: [], source: 'IMPORT', tradeScope: 'REPLAY', includedInAnalytics: true }]
function LanguageSwitch() {
  const { setLanguage } = useI18n()
  return <button onClick={() => setLanguage('ro')}>Switch to Romanian</button>
}
const click = (element: HTMLElement) => act(async () => { await userEvent.click(element) })
const renderDialog = (overrides = {}) => {
  const props = { workspace, trades, filters: emptyResearchFilters, lenses: [], screenshots: [], reportLoading: false, reportError: false, onRetry: vi.fn(), onClose: vi.fn(), onExported: vi.fn(), ...overrides }
  render(<I18nProvider><LanguageSwitch /><ExportBacktestingDialog {...props} /></I18nProvider>)
  return props
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('ExportBacktestingDialog', () => {
  it('previews counts, validates the custom period and blocks empty selection', async () => {
    localStorage.setItem('app.language', 'en')
    renderDialog()
    expect(screen.getByText('1 trades to export · 1 included in analytics · 0 excluded from analytics')).toBeInTheDocument()
    await click(screen.getByRole('checkbox', { name: 'Entire workspace (all dates)' }))
    fireEvent.change(screen.getByLabelText('Export from'), { target: { value: '2026-10-02' } })
    expect(screen.getByRole('button', { name: 'Download export' })).toBeDisabled()
    expect(screen.getByText(/Enter valid start and end/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Export to'), { target: { value: '2026-10-03' } })
    expect(screen.getByText(/No backtest\/replay trades match/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download export' })).toBeEnabled()
  })

  it('keeps incomplete report data visible and allows the trades-only CSV', async () => {
    localStorage.setItem('app.language', 'en')
    const props = renderDialog({ reportError: true })
    expect(screen.getByRole('button', { name: 'Download export' })).toBeDisabled()
    await click(screen.getByRole('button', { name: 'Retry' }))
    expect(props.onRetry).toHaveBeenCalledOnce()
    await click(screen.getByRole('combobox', { name: 'Export format' }))
    await click(screen.getByRole('option', { name: 'Trade details only (CSV)' }))
    expect(screen.getByRole('button', { name: 'Download export' })).toBeEnabled()
  })

  it('creates a complete report download and reports success only after preparing it', async () => {
    localStorage.setItem('app.language', 'en')
    const createObjectURL = vi.fn(() => 'blob:export-fixture')
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL; static revokeObjectURL = vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const props = renderDialog()
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Download export' })) })
    await vi.waitFor(() => expect(props.onExported).toHaveBeenCalledWith('Export downloaded for 1 trades.'))
    expect(prepareCompleteExport).toHaveBeenCalledWith('one', expect.objectContaining({ allDates: true }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('displays download errors without closing or reporting success', async () => {
    localStorage.setItem('app.language', 'en')
    vi.stubGlobal('URL', class extends URL { static createObjectURL = () => { throw new Error('browser failure') } })
    const props = renderDialog()
    await click(screen.getByRole('button', { name: 'Download export' }))
    expect(await screen.findByText(/The export could not be prepared/)).toBeInTheDocument()
    expect(props.onExported).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('renders Romanian labels and offers applying active filters explicitly', async () => {
    localStorage.setItem('app.language', 'ro')
    renderDialog({ filters: { ...emptyResearchFilters, direction: 'SHORT' } })
    // The provider keeps a module-level language; switch through its public API.
    await click(screen.getByText('Switch to Romanian'))
    expect(screen.getByRole('dialog', { name: 'Exportă datele de backtesting' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descarcă exportul' })).toBeEnabled()
    await click(screen.getByRole('checkbox', { name: 'Aplică celelalte filtre active ale spațiului (1)' }))
    expect(screen.getByRole('button', { name: 'Descarcă exportul' })).toBeEnabled()
  })
})

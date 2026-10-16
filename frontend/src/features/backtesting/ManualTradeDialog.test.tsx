import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BacktestingTrade, BacktestingWorkspace } from '../../api/backtesting'
import { I18nProvider } from '../../i18n'
import { ManualTradeDialog } from './BacktestingDialogs'
import { ictFields } from './ictMetadata'
import ReplayTradeDetails from './ReplayTradeDetails'

const workspace = { id: 'workspace', symbol: 'GER40', session: 'London', contextTimeframe: '4h' } as BacktestingWorkspace
const original = { id: 'imported', workspaceId: 'workspace', date: '2025-10-25', entryTime: '11:30:12', instrument: 'GER40', direction: 'SHORT', result: 'WIN', pnlR: null, tags: [], source: 'IMPORT', tradeScope: 'REPLAY', importFormat: 'TRADINGVIEW_REPLAY', entryPrice: 24000, netPnl: 45 } as BacktestingTrade
function setup(trade: BacktestingTrade | null = null, previousTrades: BacktestingTrade[] = []) {
  const save = vi.fn()
  render(<I18nProvider><ManualTradeDialog open workspace={workspace} trade={trade} previousTrades={previousTrades} strategies={[]} saving={false} onClose={vi.fn()} onSave={save} /></I18nProvider>)
  return save
}
const choose = async (name: string, option: string) => {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.click(screen.getByRole('option', { name: option, exact: true }))
}
beforeEach(() => localStorage.setItem('app.language', 'en'))
describe('Backtesting ICT forms', () => {
  it('creates a trade without metadata and does not inherit market context from workspace', async () => {
    const save = setup()
    expect(screen.getByRole('combobox', { name: 'HTF Trend' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save.mock.calls[0][0]).toMatchObject({ session: null, contextTimeframe: null, direction: 'LONG' })
  })
  it('saves all options and numeric measurements, preserving expanded values through toggles and setup changes', async () => {
    const save = setup(original)
    for (const group of ['Setup Classification', 'Higher-Timeframe Context', 'Liquidity Information', 'Fair Value Gap Information'])
      await userEvent.click(screen.getByRole('button', { name: `More ${group} fields` }))
    for (const field of ictFields.filter(f => f.kind === 'select')) await choose(field.label.en, field.options[0].label.en)
    for (const [label, value] of [['FVG Size (%)', '0.07'], ['FVG Size (Points)', '12.5'], ['FVG Age at Entry', '2']]) fireEvent.change(screen.getByRole('spinbutton', { name: label }), { target: { value } })
    await userEvent.click(screen.getByRole('button', { name: 'More Fair Value Gap Information fields' }))
    await choose('Setup Type', 'Continuation')
    await userEvent.click(screen.getByRole('button', { name: 'More Fair Value Gap Information fields' }))
    expect(screen.getByRole('spinbutton', { name: 'FVG Size (Points)' })).toHaveValue(12.5)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const payload = save.mock.calls[0][0]
    for (const field of ictFields.filter(f => f.kind === 'select' && f.key !== 'setupType')) expect(payload[field.key]).toBe(field.options[0].value)
    expect(payload).toMatchObject({ setupType: 'CONTINUATION', gapSizePercent: 0.07, gapSizePoints: 12.5, fvgAge: 2, entryPrice: 24000, netPnl: 45, entryTime: '11:30:12', direction: 'SHORT' })
    expect(screen.getByLabelText('Direction vs HTF')).toHaveValue('Against Trend')
  }, 25000)
  it('loads historical values and lets imported metadata be cleared while execution remains locked', async () => {
    const save = setup({ ...original, setupType: 'REVERSAL', htfTrend: 'BEARISH', gapTimeframe: '120', gapSizePercent: 0.07, fvgAge: 2 })
    expect(screen.getByRole('combobox', { name: 'Setup Type' })).toHaveValue('Reversal')
    expect(screen.getByRole('combobox', { name: 'FVG Timeframe' })).toHaveValue('120')
    expect(screen.getByLabelText(/^Date/)).toBeDisabled()
    const combo = screen.getByRole('combobox', { name: 'Setup Type' })
    fireEvent.click(within(combo.closest('.MuiAutocomplete-root')!).getByTitle('Clear'))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'FVG Size (%)' }), { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save.mock.calls[0][0]).toMatchObject({ setupType: null, gapSizePercent: null, gapTimeframe: '120' })
  })
  it('allows annotation enrichment when an unchanged historical R has legacy inconsistencies', () => {
    setup({ ...original, pnlR: -1, result: 'WIN' })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
  it('rejects negative measurements and fractional age, and allows zero', async () => {
    setup(original)
    const age = screen.getByRole('spinbutton', { name: 'FVG Age at Entry' })
    for (const value of ['-1', '1.5']) { fireEvent.change(age, { target: { value } }); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled() }
    fireEvent.change(age, { target: { value: '0' } }); expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'FVG Size (%)' }), { target: { value: '-0.07' } }); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
  it('copies prior context only after user action and leaves execution-specific annotations intact', async () => {
    const previous = { ...original, id: 'previous', date: '2025-10-24', contextTimeframe: '4h', htfTrend: 'BULLISH', marketStructure: 'HH_HL', marketCondition: 'TRENDING', session: 'Asia', gapSizePercent: 50, fvgAge: 7, sweepLevel: 'PDH' }
    const save = setup({ ...original, gapSizePercent: 0.07, fvgAge: 2, sweepLevel: 'PDL' }, [previous])
    expect(screen.getByRole('combobox', { name: 'HTF Trend' })).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Copy Context from Previous Trade' }))
    expect(screen.getByRole('combobox', { name: 'HTF Trend' })).toHaveValue('Bullish')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save.mock.calls[0][0]).toMatchObject({ contextTimeframe: '4h', htfTrend: 'BULLISH', session: 'Asia', gapSizePercent: 0.07, fvgAge: 2, sweepLevel: 'PDL' })
  })
  it('displays compact saved metadata with units and an edit action for any origin', () => {
    const edit = vi.fn()
    render(<I18nProvider><ReplayTradeDetails trade={{ ...original, setupType: 'REVERSAL', htfTrend: 'BEARISH', gapSizePercent: 0.07, fvgAge: 0, sweepConfirmation: 'NO_SWEEP' }} onClose={vi.fn()} onEdit={edit} /></I18nProvider>)
    expect(screen.getByText('Reversal')).toBeInTheDocument(); expect(screen.getByText('With Trend')).toBeInTheDocument()
    expect(screen.getByText('0.07%')).toBeInTheDocument(); expect(screen.getByText('0 bars')).toBeInTheDocument(); expect(screen.getByText('No Sweep')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' })); expect(edit).toHaveBeenCalledOnce()
  })
})

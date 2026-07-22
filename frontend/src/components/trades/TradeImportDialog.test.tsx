import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import TradeImportDialog from './TradeImportDialog'

const previewMt5Import = vi.fn()
const commitMt5Import = vi.fn()
const fetchAccounts = vi.fn()

vi.mock('../../api/tradeImports', async () => {
  const actual = await vi.importActual<typeof import('../../api/tradeImports')>('../../api/tradeImports')
  return { ...actual, previewMt5Import: (...args: unknown[]) => previewMt5Import(...args), commitMt5Import: (...args: unknown[]) => commitMt5Import(...args) }
})

vi.mock('../../api/calendar', async () => {
  const actual = await vi.importActual<typeof import('../../api/calendar')>('../../api/calendar')
  return { ...actual, fetchCalendarAccountOptions: (...args: unknown[]) => fetchAccounts(...args) }
})

describe('TradeImportDialog', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })
    fetchAccounts.mockResolvedValue([{ value: 'account-1', label: 'Main account', source: 'managed' }])
    previewMt5Import.mockResolvedValue({
      importBatchId: 'batch-1', status: 'PREVIEW', sourceTimezone: null, targetAccountId: null,
      account: { externalAccountId: '7785088', accountName: 'Ovidiu', currency: 'USD', broker: 'TRDX', server: 'TRDX-Server', accountType: 'real', accountMode: 'Netting', reportGeneratedAt: '2026.07.22 16:59' },
      summary: { positionsFound: 4, ordersFound: 9, dealsFound: 9, accountTransactionsFound: 1, tradesReady: 0, duplicates: 0, warnings: 1, grossPnl: -145.46, costs: 77.25, netPnl: -222.71 },
      unmappedSymbols: [{ externalSymbol: 'GECEUR' }], warnings: ['Timezone required'], errors: [],
      trades: [{ externalPositionId: '645906', externalSymbol: 'GECEUR', direction: 'SHORT', status: 'CLOSED', openedAt: '2026-07-13T12:20:32Z', closedAt: '2026-07-13T12:27:19Z', quantity: 7, entryPrice: 25098.93, exitPrice: 25134.45, grossPnl: -284.19, commission: 21, otherCosts: 0, netPnl: -305.19, accountCurrency: 'USD', duplicate: false, potentialManualMatches: [], warnings: [] }]
    })
    commitMt5Import.mockResolvedValue({ importBatchId: 'batch-1', status: 'IMPORTED', created: 1, updated: 0, duplicatesSkipped: 0, excluded: 0, grossPnl: -284.19, costs: 21, netPnl: -305.19, tradeIds: ['trade-1'], warnings: [], errors: [] })
  })

  it('runs provider selection, mapping, preview, confirmation, and commit', async () => {
    const committed = vi.fn()
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={committed} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose MetaTrader 5' }))
    await screen.findByRole('button', { name: 'Select report' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['<html>MT5</html>'], 'report.html', { type: 'text/html' })] } })
    await screen.findByText('7785088')

    await user.click(screen.getByLabelText('Target TradeJAudit account'))
    await user.click(await screen.findByRole('option', { name: 'Main account' }))
    await user.type(screen.getByLabelText('Broker source timezone'), 'Europe/London')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await user.type(screen.getByLabelText(/Internal symbol/), 'GER40')
    await user.type(screen.getByLabelText(/Trade currency/), 'EUR')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('GECEUR → GER40')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Total net P&L:/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import selected trades' }))

    await waitFor(() => expect(commitMt5Import).toHaveBeenCalledWith('batch-1', expect.objectContaining({ targetAccountId: 'account-1', sourceTimezone: 'Europe/London', selectedPositionIds: ['645906'] })))
    expect(await screen.findByText('MT5 import completed.')).toBeInTheDocument()
    expect(committed).toHaveBeenCalled()
  })

  it('shows duplicate state and commits only included trades', async () => {
    const base = await previewMt5Import()
    previewMt5Import.mockClear()
    previewMt5Import.mockResolvedValueOnce({
      ...base,
      trades: [
        base.trades[0],
        { ...base.trades[0], externalPositionId: '659613', duplicate: true, existingTradeId: 'trade-existing', netPnl: 10 }
      ]
    })
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={vi.fn()} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose MetaTrader 5' }))
    await screen.findByRole('button', { name: 'Select report' })
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['<html>MT5</html>'], 'report.html', { type: 'text/html' })] }
    })
    await screen.findByText('7785088')
    await user.click(screen.getByLabelText('Target TradeJAudit account'))
    await user.click(await screen.findByRole('option', { name: 'Main account' }))
    await user.type(screen.getByLabelText('Broker source timezone'), 'Europe/London')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.type(screen.getByLabelText(/Internal symbol/), 'GER40')
    await user.type(screen.getByLabelText(/Trade currency/), 'EUR')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Existing / update')).toBeInTheDocument()
    const include = screen.getAllByRole('checkbox')
    await user.click(include[1])
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Excluded')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import selected trades' }))

    await waitFor(() => expect(commitMt5Import).toHaveBeenCalledWith('batch-1', expect.objectContaining({ selectedPositionIds: ['645906'] })))
  })

  it('displays upload parsing errors without advancing the workflow', async () => {
    previewMt5Import.mockRejectedValueOnce(new Error('Invalid MT5 report'))
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={vi.fn()} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose MetaTrader 5' }))
    await screen.findByRole('button', { name: 'Select report' })
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['invalid'], 'report.html', { type: 'text/html' })] }
    })

    expect(await screen.findByText('Invalid MT5 report')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select report' })).toBeInTheDocument()
  })
})

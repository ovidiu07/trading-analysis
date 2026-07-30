import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import TradeImportDialog from './TradeImportDialog'

const previewMt5Import = vi.fn()
const commitMt5Import = vi.fn()
const previewTrading212Import = vi.fn()
const commitTrading212Import = vi.fn()
const fetchAccounts = vi.fn()
const createAccount = vi.fn()

vi.mock('../../api/tradeImports', async () => {
  const actual = await vi.importActual<typeof import('../../api/tradeImports')>('../../api/tradeImports')
  return {
    ...actual,
    previewMt5Import: (...args: unknown[]) => previewMt5Import(...args),
    commitMt5Import: (...args: unknown[]) => commitMt5Import(...args),
    previewTrading212Import: (...args: unknown[]) => previewTrading212Import(...args),
    commitTrading212Import: (...args: unknown[]) => commitTrading212Import(...args)
  }
})

vi.mock('../../api/accounts', async () => {
  const actual = await vi.importActual<typeof import('../../api/accounts')>('../../api/accounts')
  return {
    ...actual,
    fetchTradingAccounts: (...args: unknown[]) => fetchAccounts(...args),
    createTradingAccount: (...args: unknown[]) => createAccount(...args)
  }
})

const selectedTargetAccountName = () => {
  const select = screen.getByRole('combobox', { name: 'Trading account' }) as HTMLInputElement
  return select.value
}

describe('TradeImportDialog', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })
    fetchAccounts.mockReset()
    fetchAccounts.mockResolvedValue([{ id: 'account-1', name: 'Main account', broker: 'TRDX', currency: 'USD' }])
    createAccount.mockReset()
    previewMt5Import.mockResolvedValue({
      importBatchId: 'batch-1', status: 'PREVIEW', sourceTimezone: null, targetAccountId: null,
      account: { externalAccountId: '7785088', accountName: 'Ovidiu', currency: 'USD', broker: 'TRDX', server: 'TRDX-Server', accountType: 'real', accountMode: 'Netting', reportGeneratedAt: '2026.07.22 16:59' },
      summary: { positionsFound: 4, ordersFound: 9, dealsFound: 9, accountTransactionsFound: 1, tradesReady: 0, duplicates: 0, warnings: 1, grossPnl: -145.46, costs: 77.25, netPnl: -222.71 },
      unmappedSymbols: [{ externalSymbol: 'GECEUR' }], warnings: ['Timezone required'], errors: [],
      trades: [{ externalPositionId: '645906', externalSymbol: 'GECEUR', direction: 'SHORT', status: 'CLOSED', openedAt: '2026-07-13T12:20:32Z', closedAt: '2026-07-13T12:27:19Z', quantity: 7, entryPrice: 25098.93, exitPrice: 25134.45, grossPnl: -284.19, commission: 21, otherCosts: 0, netPnl: -305.19, accountCurrency: 'USD', duplicate: false, potentialManualMatches: [], warnings: [] }]
    })
    commitMt5Import.mockResolvedValue({ importBatchId: 'batch-1', status: 'IMPORTED', created: 1, updated: 0, duplicatesSkipped: 0, excluded: 0, grossPnl: -284.19, costs: 21, netPnl: -305.19, tradeIds: ['trade-1'], warnings: [], errors: [] })
    previewTrading212Import.mockReset()
    previewTrading212Import.mockResolvedValue({
      importBatchId: 't212-batch', status: 'PREVIEW', sourceTimezone: 'UTC', targetAccountId: 'account-1',
      account: { currency: 'EUR', broker: 'Trading 212' },
      summary: { positionsFound: 3, ordersFound: 0, dealsFound: 3, accountTransactionsFound: 0, tradesReady: 0,
        duplicates: 0, warnings: 3, grossPnl: -147.6, costs: 0, netPnl: -147.6,
        unsupportedRows: 0, reportedSpread: 9.6 },
      unmappedSymbols: [{ externalSymbol: 'GER40', suggestedInternalSymbol: 'GER40',
        externalInstrument: 'Germany 40', instrumentCurrency: 'EUR', suggestedMarket: 'CFD' }],
      warnings: ['Confirm symbol mapping'], errors: [], unsupportedRows: [],
      trades: [
        { externalPositionId: 'POS54611997543', externalOrderId: '54650150042', externalInstrument: 'Germany 40',
          externalSymbol: 'GER40', direction: 'SHORT', status: 'CLOSED', openedAt: '2026-07-24T08:02:29Z',
          closedAt: '2026-07-24T08:17:17Z', quantity: 4, entryPrice: 24966.9, exitPrice: 25002.1,
          grossPnl: -140.8, otherCosts: 0, netPnl: -140.8, accountCurrency: 'EUR', instrumentCurrency: 'EUR',
          sourceExchangeRate: 1, reportedSpread: 4.2, fxFee: 0, overnightInterest: 0, dividendAdjustment: 0,
          duplicate: false, potentialManualMatches: [], warnings: ['No stop-loss or take-profit was supplied'],
          rawSource: { Instrument: 'Germany 40', 'Position ID': 'POS54611997543' } },
        { externalPositionId: 'POS54650170715', externalOrderId: '54650179424', externalInstrument: 'Germany 40',
          externalSymbol: 'GER40', direction: 'SHORT', status: 'CLOSED', openedAt: '2026-07-24T10:07:25Z',
          closedAt: '2026-07-24T11:03:37Z', quantity: 2, entryPrice: 25072.9, exitPrice: 25074.1,
          grossPnl: -2.4, otherCosts: 0, netPnl: -2.4, accountCurrency: 'EUR', instrumentCurrency: 'EUR',
          sourceExchangeRate: 1, reportedSpread: 2.2, fxFee: 0, overnightInterest: 0, dividendAdjustment: 0,
          duplicate: false, potentialManualMatches: [], warnings: [] },
        { externalPositionId: 'POS54650174676', externalOrderId: '54650186134', externalInstrument: 'Germany 40',
          externalSymbol: 'GER40', direction: 'SHORT', status: 'CLOSED', openedAt: '2026-07-24T10:29:45Z',
          closedAt: '2026-07-24T11:58:54Z', quantity: 2, entryPrice: 25055.9, exitPrice: 25058.1,
          grossPnl: -4.4, otherCosts: 0, netPnl: -4.4, accountCurrency: 'EUR', instrumentCurrency: 'EUR',
          sourceExchangeRate: 1, reportedSpread: 3.2, fxFee: 0, overnightInterest: 0, dividendAdjustment: 0,
          duplicate: false, potentialManualMatches: [], warnings: [] }
      ]
    })
    commitTrading212Import.mockReset()
    commitTrading212Import.mockResolvedValue({
      importBatchId: 't212-batch', status: 'WARNING', created: 3, updated: 0, duplicatesSkipped: 0,
      excluded: 0, grossPnl: -147.6, costs: 0, netPnl: -147.6, tradeIds: ['1', '2', '3'], warnings: [], errors: []
    })
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

    expect(selectedTargetAccountName()).toBe('Main account')
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

  it('imports the supplied Trading 212 shape without deducting reported spread', async () => {
    fetchAccounts.mockResolvedValueOnce([{ id: 'account-1', name: 'Trading 212 EUR', broker: 'Trading 212', currency: 'EUR' }])
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={vi.fn()} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose Trading 212' }))
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['csv'], 'trading212.csv', { type: 'text/csv' })] }
    })
    expect(await screen.findByText('Provider: Trading 212. This export has no reliable external account ID, so select the destination TradeJAudit account. All source timestamps already include UTC offsets.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByDisplayValue('GER40')).toBeInTheDocument()
    expect(screen.getByText('GER40 — Germany 40')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('POS54611997543')).toBeInTheDocument()
    expect(screen.getByText('54650150042')).toBeInTheDocument()
    expect(screen.getAllByText('Inspect source row')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Total gross P&L:/)).toHaveTextContent('-€147.60')
    expect(screen.getByText(/Total net P&L:/)).toHaveTextContent('-€147.60')
    expect(screen.getByText(/Reported spread/)).toHaveTextContent('€9.60')
    await user.click(screen.getByRole('button', { name: 'Import selected trades' }))

    await waitFor(() => expect(commitTrading212Import).toHaveBeenCalledWith('t212-batch',
      expect.objectContaining({ targetAccountId: 'account-1', selectedExternalTradeIds: [
        '54650150042', '54650179424', '54650186134'
      ] })))
    expect(await screen.findByText('Trading 212 import completed.')).toBeInTheDocument()
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
    expect(selectedTargetAccountName()).toBe('Main account')
    await user.type(screen.getByLabelText('Broker source timezone'), 'Europe/London')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.type(screen.getByLabelText(/Internal symbol/), 'GER40')
    await user.type(screen.getByLabelText(/Trade currency/), 'EUR')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Already imported')).toBeInTheDocument()
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

  it('shows loading, error, retry, and empty account states without enabling Next', async () => {
    let rejectAccounts: (reason?: unknown) => void = () => undefined
    fetchAccounts.mockReturnValueOnce(new Promise((_, reject) => { rejectAccounts = reject }))
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={vi.fn()} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose MetaTrader 5' }))
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['<html>MT5</html>'], 'report.html', { type: 'text/html' })] }
    })
    expect(await screen.findByText('Loading trading accounts…')).toBeInTheDocument()

    rejectAccounts(new Error('offline'))
    expect(await screen.findByText('Trading accounts could not be loaded.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    fetchAccounts.mockResolvedValueOnce([])
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Create an account to link this trade.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('does not choose arbitrarily from multiple accounts and can explicitly create a destination', async () => {
    fetchAccounts.mockResolvedValueOnce([
      { id: 'account-1', name: 'First', currency: 'USD' },
      { id: 'account-2', name: 'Second', currency: 'USD' }
    ])
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={vi.fn()} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose MetaTrader 5' }))
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['<html>MT5</html>'], 'report.html', { type: 'text/html' })] }
    })
    await screen.findByText('7785088')
    expect(selectedTargetAccountName()).toBe('')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('preselects an existing mapped account and displays it in confirmation', async () => {
    previewMt5Import.mockResolvedValueOnce({
      ...(await previewMt5Import()),
      targetAccountId: 'account-2'
    })
    fetchAccounts.mockResolvedValueOnce([
      { id: 'account-1', name: 'First', currency: 'USD' },
      { id: 'account-2', name: 'Mapped account', broker: 'TRDX', currency: 'USD', externalAccountId: '7785088' }
    ])
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={vi.fn()} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose MetaTrader 5' }))
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['<html>MT5</html>'], 'report.html', { type: 'text/html' })] }
    })
    await screen.findByText('7785088')
    expect(selectedTargetAccountName()).toBe('Mapped account')
  })

  it('creates an internal account only after the explicit create action and selects it', async () => {
    fetchAccounts.mockResolvedValueOnce([])
    createAccount.mockResolvedValueOnce({ id: 'created-account', name: 'Ovidiu', broker: 'TRDX', currency: 'USD' })
    render(<I18nProvider><TradeImportDialog open userTimezone="Europe/Bucharest" onClose={vi.fn()} onTradovate={vi.fn()} onCommitted={vi.fn()} /></I18nProvider>)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Choose MetaTrader 5' }))
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['<html>MT5</html>'], 'report.html', { type: 'text/html' })] }
    })
    await screen.findByText('Create an account to link this trade.')
    expect(createAccount).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Create new account' }))
    await user.type(await screen.findByLabelText(/Account name/), 'Ovidiu')
    await user.type(await screen.findByLabelText('Broker'), 'TRDX')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(createAccount).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ovidiu', broker: 'TRDX', currency: 'USD' })))
    await waitFor(() => expect(selectedTargetAccountName()).toBe('Ovidiu'))
  })
})

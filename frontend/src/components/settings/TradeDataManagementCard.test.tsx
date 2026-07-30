import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import TradeDataManagementCard from './TradeDataManagementCard'

const fetchAccounts = vi.fn()
const previewDeletion = vi.fn()
const deleteTrades = vi.fn()

vi.mock('../../api/accounts', async () => {
  const actual = await vi.importActual<typeof import('../../api/accounts')>('../../api/accounts')
  return {
    ...actual,
    fetchTradingAccounts: (...args: unknown[]) => fetchAccounts(...args)
  }
})

vi.mock('../../api/tradeData', async () => {
  const actual = await vi.importActual<typeof import('../../api/tradeData')>('../../api/tradeData')
  return {
    ...actual,
    previewTradeDeletion: (...args: unknown[]) => previewDeletion(...args),
    deleteAccountTrades: (...args: unknown[]) => deleteTrades(...args)
  }
})

describe('TradeDataManagementCard', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    fetchAccounts.mockReset()
    fetchAccounts.mockResolvedValue([
      { id: 'account-1', name: 'Trading 212 EUR', broker: 'Trading 212', currency: 'EUR' }
    ])
    previewDeletion.mockReset()
    previewDeletion.mockResolvedValue({
      accountId: 'account-1',
      accountName: 'Trading 212 EUR',
      scope: 'DATE_RANGE',
      startDate: '2026-07-13',
      endDate: '2026-07-16',
      timezone: 'Europe/Bucharest',
      tradeCount: 15,
      earliestAffectedTrade: '2026-07-13T13:54:29Z',
      latestAffectedTrade: '2026-07-16T17:36:49Z',
      realizedPnl: 94.01,
      linkedJournalRecords: 1,
      sourceDistribution: { TRADING212_CSV: 15 },
      previewToken: 'fresh-token'
    })
    deleteTrades.mockReset()
    deleteTrades.mockResolvedValue({
      accountId: 'account-1',
      accountName: 'Trading 212 EUR',
      deletedTrades: 15,
      deletedRealizedPnl: 94.01,
      deletedAt: '2026-07-30T18:00:00Z'
    })
  })

  it('previews and confirms an inclusive date-range deletion', async () => {
    render(<I18nProvider><TradeDataManagementCard timezone="Europe/Bucharest" /></I18nProvider>)
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Trading account/ }))
      .toHaveTextContent('Trading 212 EUR — Trading 212 — EUR'))

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-13' } })
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-16' } })
    await user.click(screen.getByRole('button', { name: 'Preview deletion' }))

    await waitFor(() => expect(previewDeletion).toHaveBeenCalledWith({
      accountId: 'account-1',
      scope: 'DATE_RANGE',
      startDate: '2026-07-13',
      endDate: '2026-07-16',
      timezone: 'Europe/Bucharest'
    }))
    expect(await screen.findByText('Trades affected: 15')).toBeInTheDocument()
    expect(screen.getByText(/Realized P&L affected:/)).toHaveTextContent('€94.01')
    expect(screen.getByText('Linked journal records: 1')).toBeInTheDocument()
    expect(screen.getByText('TRADING212_CSV: 15')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(deleteTrades).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'account-1',
      confirmed: true,
      previewToken: 'fresh-token'
    })))
    expect(await screen.findByText('Deleted 15 trades. Realized P&L removed: €94.01.')).toBeInTheDocument()
  })

  it('requires the exact account name before entire-history deletion', async () => {
    previewDeletion.mockResolvedValueOnce({
      accountId: 'account-1',
      accountName: 'Trading 212 EUR',
      scope: 'ENTIRE_HISTORY',
      timezone: 'Europe/Bucharest',
      tradeCount: 109,
      realizedPnl: 705.16,
      linkedJournalRecords: 0,
      sourceDistribution: { TRADING212_CSV: 109 },
      previewToken: 'entire-token'
    })
    render(<I18nProvider><TradeDataManagementCard timezone="Europe/Bucharest" /></I18nProvider>)
    const user = userEvent.setup()
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Trading account/ }))
      .toHaveTextContent('Trading 212 EUR — Trading 212 — EUR'))

    await user.click(screen.getByLabelText('Delete the entire trade history'))
    await user.click(screen.getByRole('button', { name: 'Preview deletion' }))
    const deleteButton = await screen.findByRole('button', { name: 'Delete permanently' })
    expect(deleteButton).toBeDisabled()

    await user.type(screen.getByLabelText('Type the account name'), 'Trading 212 EUR')
    expect(deleteButton).toBeEnabled()
    await user.click(deleteButton)

    await waitFor(() => expect(deleteTrades).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'ENTIRE_HISTORY',
      confirmationText: 'Trading 212 EUR',
      previewToken: 'entire-token'
    })))
  })
})

import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, beforeAll, vi } from 'vitest'
import CalendarPage from './CalendarPage'
import { AuthProvider } from '../auth/AuthContext'
import { MonthlyPnlSummaryResponse } from '../api/trades'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import theme from '../theme'
import { formatSignedCurrency } from '../utils/format'
import { I18nProvider } from '../i18n'
import { format } from 'date-fns'

const mockFetchDailyPnl = vi.fn()
const mockFetchMonthlyPnlSummary = vi.fn()
const mockListClosedTradesForDate = vi.fn()
const mockListNotebookNotesByDate = vi.fn()
const mockFetchCalendarPlans = vi.fn()
const mockFetchCalendarAccountOptions = vi.fn()
const mockRemoveSessionPlan = vi.fn()

vi.mock('../api/trades', async () => {
  const actual = await vi.importActual<typeof import('../api/trades')>('../api/trades')
  return {
    ...actual,
    fetchDailyPnl: (...args: unknown[]) => mockFetchDailyPnl(...args),
    fetchMonthlyPnlSummary: (...args: unknown[]) => mockFetchMonthlyPnlSummary(...args),
    listClosedTradesForDate: (...args: unknown[]) => mockListClosedTradesForDate(...args)
  }
})

vi.mock('../api/notebook', async () => {
  const actual = await vi.importActual<typeof import('../api/notebook')>('../api/notebook')
  return {
    ...actual,
    listNotebookNotesByDate: (...args: unknown[]) => mockListNotebookNotesByDate(...args)
  }
})

vi.mock('../api/calendar', () => ({
  fetchCalendarPlans: (...args: unknown[]) => mockFetchCalendarPlans(...args),
  fetchCalendarAccountOptions: (...args: unknown[]) => mockFetchCalendarAccountOptions(...args)
}))

vi.mock('../api/liveWorkspace', () => ({
  removeSessionPlan: (...args: unknown[]) => mockRemoveSessionPlan(...args)
}))

const buildSummary = (month: number, netPnl: number): MonthlyPnlSummaryResponse => ({
  year: 2026,
  month,
  timezone: 'Europe/Bucharest',
  netPnl,
  grossPnl: netPnl + 200,
  tradeCount: 12,
  tradingDays: 6
})

describe('CalendarPage', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      })
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('app.language', 'en')
    mockFetchDailyPnl.mockResolvedValue([])
    mockFetchCalendarPlans.mockResolvedValue({ activeMonthlyPlan: null, activeWeeklyPlan: null, dailyPlans: [] })
    mockFetchCalendarAccountOptions.mockResolvedValue([
      { value: 'account-a', label: 'Account A', source: 'broker' },
      { value: 'account-b', label: 'Account B', source: 'broker' }
    ])
    mockRemoveSessionPlan.mockResolvedValue(undefined)
    mockListClosedTradesForDate.mockResolvedValue([])
    mockListNotebookNotesByDate.mockResolvedValue([])
  })

  it('renders monthly summary and updates on month navigation', async () => {
    mockFetchMonthlyPnlSummary
      .mockResolvedValueOnce(buildSummary(2, 1200))
      .mockResolvedValueOnce(buildSummary(3, -300))

    render(
      <MemoryRouter>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider theme={theme}>
              <CalendarPage />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockFetchMonthlyPnlSummary).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText(formatSignedCurrency(1200, 'USD'))).toBeInTheDocument()
    expect(mockFetchMonthlyPnlSummary).toHaveBeenCalledWith(expect.objectContaining({ tz: 'Europe/Bucharest', basis: 'close' }))

    const firstRequest = mockFetchMonthlyPnlSummary.mock.calls[0][0] as { year: number; month: number }
    const expectedNextMonth = new Date(firstRequest.year, firstRequest.month - 1, 1)
    expectedNextMonth.setMonth(expectedNextMonth.getMonth() + 1)

    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Next month'))

    expect(await screen.findByText(formatSignedCurrency(-300, 'USD'))).toBeInTheDocument()
    await waitFor(() => {
      expect(mockFetchMonthlyPnlSummary).toHaveBeenCalledTimes(2)
    })
    expect(mockFetchMonthlyPnlSummary).toHaveBeenLastCalledWith({
      year: expectedNextMonth.getFullYear(),
      month: expectedNextMonth.getMonth() + 1,
      tz: 'Europe/Bucharest',
      basis: 'close',
      accountId: undefined
    })
  })

  it('restores an account from the URL, filters every trade request, and preserves it across months', async () => {
    mockFetchMonthlyPnlSummary.mockResolvedValue(buildSummary(7, -100))
    mockFetchDailyPnl.mockResolvedValue([
      { date: '2026-07-16', netPnl: -100, tradeCount: 1, wins: 0, losses: 1 }
    ])

    render(
      <MemoryRouter initialEntries={['/calendar?month=2026-07&accountId=account-a']}>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider theme={theme}>
              <CalendarPage />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => expect(mockFetchMonthlyPnlSummary).toHaveBeenCalledWith(expect.objectContaining({
      year: 2026,
      month: 7,
      accountId: 'account-a'
    })))
    expect(mockFetchDailyPnl).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'account-a' }))
    expect(await screen.findByText(/July 2026 · Account A · Europe\/Bucharest/)).toBeInTheDocument()

    await userEvent.setup().click(screen.getByLabelText(/View realized P&L for 2026-07-16/))
    await waitFor(() => expect(mockListClosedTradesForDate).toHaveBeenCalledWith(
      '2026-07-16', 'Europe/Bucharest', 'account-a'
    ))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))

    await userEvent.setup().click(screen.getByLabelText('Next month'))
    await waitFor(() => expect(mockFetchMonthlyPnlSummary).toHaveBeenLastCalledWith(expect.objectContaining({
      month: 8,
      accountId: 'account-a'
    })))
  })

  it('uses the explicit unassigned filter and shows an account-specific empty state', async () => {
    mockFetchMonthlyPnlSummary.mockResolvedValue({ ...buildSummary(7, 0), tradeCount: 0, tradingDays: 0 })

    render(
      <MemoryRouter initialEntries={['/calendar?month=2026-07&accountId=unassigned']}>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider theme={theme}>
              <CalendarPage />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => expect(mockFetchDailyPnl).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'unassigned' })))
    expect(await screen.findByText('No closed trades for Unassigned trades')).toBeInTheDocument()
    expect(screen.getByText('No closed trades match this account in July 2026.')).toBeInTheDocument()
  })

  it('safely falls back to all accounts for an unknown URL account', async () => {
    mockFetchMonthlyPnlSummary.mockResolvedValue(buildSummary(7, 50))

    render(
      <MemoryRouter initialEntries={['/calendar?month=2026-07&accountId=not-owned']}>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider theme={theme}>
              <CalendarPage />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => expect(mockFetchDailyPnl).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: undefined })))
    expect(await screen.findByText(/July 2026 · All accounts · Europe\/Bucharest/)).toBeInTheDocument()
  })

  it('shows a per-account breakdown when opening a day', async () => {
    const activeDateKey = format(new Date(new Date().getFullYear(), new Date().getMonth(), 17), 'yyyy-MM-dd')
    const month = Number(activeDateKey.slice(5, 7))

    mockFetchMonthlyPnlSummary.mockResolvedValue(buildSummary(month, 1200))
    mockFetchDailyPnl.mockResolvedValue([
      { date: activeDateKey, netPnl: 430, tradeCount: 2, wins: 2, losses: 0 }
    ])
    mockListClosedTradesForDate.mockResolvedValue([
      {
        id: 'trade-1',
        symbol: 'MNQM6',
        market: 'FUTURES',
        direction: 'LONG',
        status: 'CLOSED',
        openedAt: '2026-04-17T13:44:42Z',
        closedAt: '2026-04-17T14:36:58Z',
        pnlNet: 306,
        pnlProfileCurrency: 306,
        profileCurrency: 'USD',
        tradeCurrency: 'USD',
        accountId: 'APEX4855840000003',
        quantity: 2,
        entryPrice: 26711.5
      },
      {
        id: 'trade-2',
        symbol: 'MNQM6',
        market: 'FUTURES',
        direction: 'LONG',
        status: 'CLOSED',
        openedAt: '2026-04-17T15:44:42Z',
        closedAt: '2026-04-17T16:12:58Z',
        pnlNet: 124,
        pnlProfileCurrency: 124,
        profileCurrency: 'USD',
        tradeCurrency: 'USD',
        accountId: 'APEX4855840000004',
        quantity: 1,
        entryPrice: 26750
      }
    ])

    render(
      <MemoryRouter>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider theme={theme}>
              <CalendarPage />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await waitFor(() => {
      expect(mockFetchDailyPnl).toHaveBeenCalled()
    })

    await user.click(screen.getByLabelText(new RegExp(`View realized P&L for ${activeDateKey}`)))

    expect(await screen.findByText('By account')).toBeInTheDocument()
    expect(screen.getByText('APEX4855840000003')).toBeInTheDocument()
    expect(screen.getByText('APEX4855840000004')).toBeInTheDocument()
  })

  it('removes a Today Plan badge while keeping realized P&L visible', async () => {
    const activeDateKey = format(new Date(new Date().getFullYear(), new Date().getMonth(), 17), 'yyyy-MM-dd')
    const month = Number(activeDateKey.slice(5, 7))
    const dailyPlan = {
      id: 'session-17',
      scope: 'DAILY',
      title: 'Today Plan',
      bias: 'LONG',
      objectives: 'A+ only',
      focusSymbols: [],
      periodStart: activeDateKey,
      periodEnd: activeDateKey,
      setupCount: 1,
      imageCount: 1,
      hasImages: true
    }

    mockFetchMonthlyPnlSummary.mockResolvedValue(buildSummary(month, 1200))
    mockFetchDailyPnl.mockResolvedValue([
      { date: activeDateKey, netPnl: 430, tradeCount: 2, wins: 2, losses: 0 }
    ])
    mockFetchCalendarPlans
      .mockResolvedValueOnce({ activeMonthlyPlan: null, activeWeeklyPlan: null, dailyPlans: [dailyPlan] })
      .mockResolvedValue({ activeMonthlyPlan: null, activeWeeklyPlan: null, dailyPlans: [] })

    render(
      <MemoryRouter>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider theme={theme}>
              <CalendarPage />
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await waitFor(() => {
      expect(mockFetchCalendarPlans).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByLabelText(new RegExp(`Today Plan saved in Calendar`))).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText(new RegExp(`View realized P&L for ${activeDateKey}`)))
    expect((await screen.findAllByText('Today Plan')).length).toBeGreaterThan(0)
    expect(screen.getByText(formatSignedCurrency(430, 'USD'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove plan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove plan' })
    expect(within(dialog).getByText('Remove this Today Plan? It will no longer appear on this calendar day or in Session Mode.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Remove plan' }))

    await waitFor(() => expect(mockRemoveSessionPlan).toHaveBeenCalledWith('DAILY', 'session-17'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove plan' })).not.toBeInTheDocument())
    expect(screen.getByText(formatSignedCurrency(430, 'USD'))).toBeInTheDocument()
  })
})

import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import CalendarPage from './CalendarPage'
import { AuthProvider } from '../auth/AuthContext'
import { MonthlyPnlSummaryResponse } from '../api/trades'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import theme from '../theme'
import { formatSignedCurrency } from '../utils/format'

const mockFetchDailyPnl = vi.fn()
const mockFetchMonthlyPnlSummary = vi.fn()

vi.mock('../api/trades', async () => {
  const actual = await vi.importActual<typeof import('../api/trades')>('../api/trades')
  return {
    ...actual,
    fetchDailyPnl: (...args: unknown[]) => mockFetchDailyPnl(...args),
    fetchMonthlyPnlSummary: (...args: unknown[]) => mockFetchMonthlyPnlSummary(...args)
  }
})

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
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-06T12:00:00Z'))
    mockFetchDailyPnl.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders monthly summary and updates on month navigation', async () => {
    mockFetchMonthlyPnlSummary
      .mockResolvedValueOnce(buildSummary(2, 1200))
      .mockResolvedValueOnce(buildSummary(3, -300))

    render(
      <MemoryRouter>
        <AuthProvider>
          <ThemeProvider theme={theme}>
            <CalendarPage />
          </ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText(formatSignedCurrency(1200, 'USD'))).toBeInTheDocument()
    await waitFor(() => {
      expect(mockFetchMonthlyPnlSummary).toHaveBeenCalledWith({ year: 2026, month: 2, tz: 'Europe/Bucharest', basis: 'close' })
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByLabelText('Next month'))

    expect(await screen.findByText(formatSignedCurrency(-300, 'USD'))).toBeInTheDocument()
    await waitFor(() => {
      expect(mockFetchMonthlyPnlSummary).toHaveBeenLastCalledWith({ year: 2026, month: 3, tz: 'Europe/Bucharest', basis: 'close' })
    })
  })
})

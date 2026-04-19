import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TradesPage from './TradesPage'
import { I18nProvider } from '../i18n'

const mockListTrades = vi.fn()
const mockSearchTrades = vi.fn()
const mockListPublishedContent = vi.fn()
const mockListMyPlans = vi.fn()

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: () => <div data-testid="trades-grid" />
}))

const setViewportSize = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const minMatch = query.match(/\(min-width:\s*(\d+(?:\.\d+)?)px\)/)
    const maxMatch = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/)
    const min = minMatch ? Number(minMatch[1]) : null
    const max = maxMatch ? Number(maxMatch[1]) : null
    const matches = (min === null || width >= min) && (max === null || width <= max)
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }
  }) as unknown as typeof window.matchMedia
}

vi.mock('../api/trades', async () => {
  const actual = await vi.importActual<typeof import('../api/trades')>('../api/trades')
  return {
    ...actual,
    listTrades: (...args: unknown[]) => mockListTrades(...args),
    searchTrades: (...args: unknown[]) => mockSearchTrades(...args),
    createTrade: vi.fn(),
    deleteTrade: vi.fn(),
    getTradeById: vi.fn(),
    importTradesCsv: vi.fn(),
    updateTrade: vi.fn()
  }
})

vi.mock('../api/content', async () => {
  const actual = await vi.importActual<typeof import('../api/content')>('../api/content')
  return {
    ...actual,
    listPublishedContent: (...args: unknown[]) => mockListPublishedContent(...args)
  }
})

vi.mock('../api/plans', async () => {
  const actual = await vi.importActual<typeof import('../api/plans')>('../api/plans')
  return {
    ...actual,
    listMyPlans: (...args: unknown[]) => mockListMyPlans(...args)
  }
})

vi.mock('../hooks/usePlans', () => ({
  useActivePlansForTradeQuery: () => ({
    data: { plans: [], suggestedPlanIds: [] },
    isFetching: false
  })
}))

vi.mock('../components/trades/SymbolAutocomplete', () => ({
  SymbolAutocomplete: ({
    value,
    onChange,
    error,
    helperText
  }: {
    value: string
    onChange: (value: string) => void
    error?: boolean
    helperText?: string
  }) => (
    <input
      aria-label="Symbol"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={error ? 'true' : 'false'}
      data-helper={helperText || ''}
    />
  ),
  saveRecentSymbol: vi.fn()
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    logout: vi.fn(),
    user: {
      baseCurrency: 'USD',
      timezone: 'Europe/Bucharest'
    }
  })
}))

vi.mock('../features/demo/DemoDataContext', () => ({
  useDemoData: () => ({
    refreshToken: 0
  })
}))

vi.mock('../utils/analytics/ga4', () => ({
  trackEvent: vi.fn()
}))

describe('TradesPage account display', () => {
  beforeEach(() => {
    setViewportSize(390)
    localStorage.setItem('app.language', 'en')
    mockListTrades.mockResolvedValue({
      content: [
        {
          id: 'trade-1',
          symbol: 'MNQM6',
          market: 'FUTURES',
          direction: 'LONG',
          status: 'CLOSED',
          openedAt: '2026-04-17T13:44:42Z',
          closedAt: '2026-04-17T14:36:58Z',
          quantity: 2,
          entryPrice: 26711.5,
          exitPrice: 26788,
          pnlNet: 306,
          pnlProfileCurrency: 306,
          profileCurrency: 'USD',
          tradeCurrency: 'USD',
          notes: 'Imported from Tradovate',
          accountId: 'APEX4855840000003'
        }
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10
    })
    mockSearchTrades.mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 10
    })
    mockListPublishedContent.mockResolvedValue([])
    mockListMyPlans.mockResolvedValue([])
  })

  it('shows the broker account on trade cards and uses the Tradovate import label', async () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <TradesPage />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockListTrades).toHaveBeenCalled()
    })

    expect(screen.getByRole('button', { name: 'Import from Tradovate' })).toBeInTheDocument()
    expect(screen.getByText('Account ID: APEX4855840000003')).toBeInTheDocument()
    expect(mockListPublishedContent).not.toHaveBeenCalled()
    expect(mockListMyPlans).not.toHaveBeenCalled()
  })
})

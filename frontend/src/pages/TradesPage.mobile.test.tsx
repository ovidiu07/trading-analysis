import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TradesPage from './TradesPage'
import { I18nProvider } from '../i18n'

const mockListTrades = vi.fn()
const mockSearchTrades = vi.fn()
const mockListPublishedContent = vi.fn()
const mockListMyPlans = vi.fn()
const mockCreateTrade = vi.fn()

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: () => <div data-testid="trades-grid" />
}))

vi.mock('../api/trades', async () => {
  const actual = await vi.importActual<typeof import('../api/trades')>('../api/trades')
  return {
    ...actual,
    listTrades: (...args: unknown[]) => mockListTrades(...args),
    searchTrades: (...args: unknown[]) => mockSearchTrades(...args),
    createTrade: (...args: unknown[]) => mockCreateTrade(...args),
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

const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
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

describe('TradesPage mobile create dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('app.language', 'en')
    mockListTrades.mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
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
    mockCreateTrade.mockResolvedValue(undefined)
  })

  it.each([
    { width: 430, height: 932, viewport: '430x932' },
    { width: 390, height: 844, viewport: '390x844' }
  ])('keeps create modal mobile-scrollable with sticky actions at $viewport', async ({ width, height }) => {
    setViewportSize(width, height)
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/trades?quickLog=1']}>
        <I18nProvider>
          <TradesPage />
        </I18nProvider>
      </MemoryRouter>
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeVisible()
    const dialogStyles = window.getComputedStyle(dialog)
    expect(dialogStyles.overflow).toBe('hidden')

    const advancedModeButton = await screen.findByRole('button', { name: 'Advanced' })
    await user.click(advancedModeButton)

    const symbolInput = (await within(dialog).findAllByLabelText('Symbol'))[0]
    await user.clear(symbolInput)
    await user.type(symbolInput, 'AAPL')
    const entryPriceInput = (await within(dialog).findAllByLabelText('Entry price'))[0]
    await user.clear(entryPriceInput)
    await user.type(entryPriceInput, '1')

    const scrollRegion = await screen.findByTestId('trade-create-scroll-region')
    Object.defineProperty(scrollRegion, 'scrollHeight', { configurable: true, value: 2400 })
    Object.defineProperty(scrollRegion, 'clientHeight', { configurable: true, value: 620 })
    scrollRegion.scrollTop = 0
    fireEvent.scroll(scrollRegion)
    scrollRegion.scrollTop = 1700
    fireEvent.scroll(scrollRegion)

    const saveTradeButton = await screen.findByRole('button', { name: 'Save trade' })
    const actionBar = await screen.findByTestId('trade-create-action-bar')

    await waitFor(() => {
      const styles = window.getComputedStyle(scrollRegion)
      const actionBarStyles = window.getComputedStyle(actionBar)
      expect(styles.overflowY).toBe('auto')
      expect(styles.overflowX).toBe('hidden')
      expect(styles.flexGrow).toBe('1')
      expect(styles.flexShrink).toBe('1')
      expect(actionBarStyles.position).toBe('sticky')
      expect(actionBarStyles.bottom).toBe('0px')
      expect(saveTradeButton).toBeVisible()
      expect(saveTradeButton).toBeEnabled()
    })

    await user.click(saveTradeButton)
    await waitFor(() => {
      expect(mockCreateTrade).toHaveBeenCalledTimes(1)
    })
  })
})

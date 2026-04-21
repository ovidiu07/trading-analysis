import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TradesPage from './TradesPage'
import { I18nProvider } from '../i18n'

const mockListTrades = vi.fn()
const mockSearchTrades = vi.fn()
const mockListStrategies = vi.fn()
const mockListMyPlans = vi.fn()
const mockListTradeAssets = vi.fn()

vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns, getRowId }: any) => (
    <div data-testid="trades-grid">
      {rows.map((row: any) => {
        const id = getRowId ? getRowId(row) : row.id
        return (
          <div key={id} data-testid={`row-${id}`}>
            {columns.map((column: any) => {
              const rawValue = row[column.field]
              const value = typeof column.valueGetter === 'function'
                ? column.valueGetter({ id, field: column.field, row, value: rawValue })
                : rawValue
              const formattedValue = typeof column.valueFormatter === 'function'
                ? column.valueFormatter({ id, field: column.field, row, value })
                : value
              const content = typeof column.renderCell === 'function'
                ? column.renderCell({ id, field: column.field, row, value, formattedValue })
                : <span>{formattedValue == null ? '' : String(formattedValue)}</span>

              return (
                <div key={column.field} data-testid={`cell-${id}-${column.field}`}>
                  {content}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}))

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

vi.mock('../api/assets', async () => {
  const actual = await vi.importActual<typeof import('../api/assets')>('../api/assets')
  return {
    ...actual,
    listTradeAssets: (...args: unknown[]) => mockListTradeAssets(...args)
  }
})

vi.mock('../api/strategies', async () => {
  const actual = await vi.importActual<typeof import('../api/strategies')>('../api/strategies')
  return {
    ...actual,
    listStrategies: (...args: unknown[]) => mockListStrategies(...args)
  }
})

vi.mock('../api/plans', async () => {
  const actual = await vi.importActual<typeof import('../api/plans')>('../api/plans')
  return {
    ...actual,
    listMyPlans: (...args: unknown[]) => mockListMyPlans(...args)
  }
})

vi.mock('../api/notebook', () => ({
  createNotebookNote: vi.fn()
}))

vi.mock('../components/assets/SecureAssetImage', () => ({
  default: ({ url, alt }: { url?: string | null; alt: string }) => <img src={url || ''} alt={alt} />
}))

vi.mock('../components/assets/AssetThumbnail', () => ({
  default: ({ url, alt }: { url?: string | null; alt?: string | null }) => <img src={url || ''} alt={alt || 'thumbnail'} />
}))

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

describe('TradesPage note previews and screenshot viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('app.language', 'en')
    setViewportSize(1280)
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
          notes: 'Manual note',
          latestTradeNotePreview: 'Notebook note preview',
          latestTradeNoteUpdatedAt: '2026-04-17T15:05:00Z',
          entryScreenshotAssetIds: ['asset-1', 'asset-2']
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
    mockListStrategies.mockResolvedValue({ myStrategies: [], mentorStrategies: [] })
    mockListMyPlans.mockResolvedValue([])
    mockListTradeAssets.mockResolvedValue([
      {
        id: 'asset-1',
        scope: 'TRADE',
        tradeId: 'trade-1',
        originalFileName: 'chart-a.png',
        contentType: 'image/png',
        image: true,
        viewUrl: 'https://cdn.example.com/chart-a.png'
      },
      {
        id: 'asset-2',
        scope: 'TRADE',
        tradeId: 'trade-1',
        originalFileName: 'chart-b.png',
        contentType: 'image/png',
        image: true,
        viewUrl: 'https://cdn.example.com/chart-b.png'
      }
    ])
  })

  it('renders the latest linked trade note preview and previews screenshots with carousel and zoom controls', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <I18nProvider>
          <TradesPage />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => expect(mockListTrades).toHaveBeenCalled())

    expect(screen.getByTestId('cell-trade-1-notes')).toHaveTextContent('Notebook note preview | Manual note')

    await user.click(screen.getByRole('button', { name: 'Preview screenshots' }))

    await waitFor(() => expect(mockListTradeAssets).toHaveBeenCalledWith('trade-1'))
    expect(await screen.findByText('MNQM6 screenshots (2)')).toBeInTheDocument()
    expect(screen.getByText('Screenshot 1 of 2')).toBeInTheDocument()
    expect(screen.getAllByAltText('chart-a.png')[0]).toHaveAttribute('src', 'https://cdn.example.com/chart-a.png')

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Next screenshot' }))
    await waitFor(() => {
      expect(screen.getAllByAltText('chart-b.png')[0]).toHaveAttribute('src', 'https://cdn.example.com/chart-b.png')
    })
  })
})

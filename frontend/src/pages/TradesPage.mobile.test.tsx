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

const toRect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height })
  } as DOMRect)

const applySyntheticHorizontalMetrics = ({
  viewportWidth,
  paper,
  tabsRow,
  chipsRow,
  summaryRow,
  hasOverflowRisk
}: {
  viewportWidth: number
  paper: HTMLElement
  tabsRow: HTMLElement
  chipsRow: HTMLElement
  summaryRow: HTMLElement
  hasOverflowRisk: boolean
}) => {
  const paperStyles = window.getComputedStyle(paper)
  const margin = Number.parseFloat(paperStyles.marginLeft || '0') || 0
  const paperX = Math.max(0, margin)
  const paperWidth = Math.max(0, viewportWidth - margin * 2)
  const spacingOverflow = hasOverflowRisk ? 20 : 0

  Object.defineProperty(document.documentElement, 'scrollWidth', {
    configurable: true,
    get: () => Math.ceil(viewportWidth + spacingOverflow)
  })

  vi.spyOn(paper, 'getBoundingClientRect').mockReturnValue(toRect(paperX, 24, paperWidth, 760))

  const tabsDirection = window.getComputedStyle(tabsRow).flexDirection
  const tabsFlexWrap = window.getComputedStyle(tabsRow).flexWrap
  const tabsWidth = tabsDirection === 'row' && tabsFlexWrap === 'nowrap' ? paperWidth + 8 : paperWidth - 24
  const chipsWidth = paperWidth - 24
  const summaryWidth = hasOverflowRisk ? paperWidth + 20 : paperWidth - 24

  vi.spyOn(tabsRow, 'getBoundingClientRect').mockReturnValue(toRect(paperX + 12, 92, tabsWidth, 44))
  vi.spyOn(chipsRow, 'getBoundingClientRect').mockReturnValue(toRect(paperX + 12, 142, chipsWidth, 28))
  vi.spyOn(summaryRow, 'getBoundingClientRect').mockReturnValue(toRect(paperX + 12, 218, summaryWidth, 26))
}

const assertNoHorizontalOverflow = ({
  paper,
  rows
}: {
  paper: HTMLElement
  rows: HTMLElement[]
}) => {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

  const paperRect = paper.getBoundingClientRect()
  expect(paperRect.x).toBeGreaterThanOrEqual(0)
  expect(paperRect.x + paperRect.width).toBeLessThanOrEqual(window.innerWidth)

  rows.forEach((row) => {
    const rowRect = row.getBoundingClientRect()
    expect(rowRect.left).toBeGreaterThanOrEqual(paperRect.left)
    expect(rowRect.right).toBeLessThanOrEqual(paperRect.right)
  })
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

  it.each([
    { width: 599, height: 814, viewport: '599x814', route: '/trades', entrypoint: 'manual create' },
    { width: 599, height: 814, viewport: '599x814', route: '/trades?quickLog=1', entrypoint: 'quickLog auto-open' },
    { width: 881, height: 935, viewport: '881x935', route: '/trades', entrypoint: 'manual create' },
    { width: 881, height: 935, viewport: '881x935', route: '/trades?quickLog=1', entrypoint: 'quickLog auto-open' }
  ])('keeps create modal horizontally responsive at $viewport via $entrypoint', async ({ width, height, route }) => {
    setViewportSize(width, height)
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={[route]}>
        <I18nProvider>
          <TradesPage />
        </I18nProvider>
      </MemoryRouter>
    )

    if (route === '/trades') {
      const createTradeCta = (await screen.findAllByRole('button', { name: 'Create trade' }))[0]
      await user.click(createTradeCta)
      const quickLogTab = await screen.findByRole('button', { name: 'Quick Log' })
      await user.click(quickLogTab)
      const advancedTab = await screen.findByRole('button', { name: 'Advanced' })
      await user.click(advancedTab)
    }

    const dialog = await screen.findByRole('dialog')
    const paper = document.querySelector('.MuiDialog-paper') as HTMLElement | null
    expect(paper).not.toBeNull()

    const modeGroup = within(dialog).getByRole('group', { name: 'Quick Log / Advanced' })
    const tabsRow = modeGroup.parentElement as HTMLElement | null
    expect(tabsRow).not.toBeNull()

    const chipsRow = tabsRow?.querySelector('.MuiChip-root')?.parentElement as HTMLElement | null
    expect(chipsRow).not.toBeNull()

    const summaryRow = within(dialog).getByText('Core execution').closest('.MuiStack-root') as HTMLElement | null
    expect(summaryRow).not.toBeNull()

    const paperMargin = Number.parseFloat(window.getComputedStyle(paper as HTMLElement).marginLeft || '0') || 0
    const tabsDirection = window.getComputedStyle(tabsRow as HTMLElement).flexDirection
    const tabsWrap = window.getComputedStyle(tabsRow as HTMLElement).flexWrap
    const hasUnsafePaperGutter = (width < 600 && paperMargin < 8) || (width >= 600 && width < 900 && paperMargin > 16)
    const hasUnsafeGridSpacing = Array.from(dialog.querySelectorAll('.MuiGrid-container')).some((node) => {
      const className = node.getAttribute('class') || ''
      const spacingClass = className.split(' ').find((token) => token.includes('MuiGrid-spacing-xs-'))
      return !!spacingClass && !spacingClass.endsWith('-0')
    })
    const hasOverflowRisk = hasUnsafePaperGutter || (tabsDirection === 'row' && tabsWrap === 'nowrap') || hasUnsafeGridSpacing

    applySyntheticHorizontalMetrics({
      viewportWidth: width,
      paper: paper as HTMLElement,
      tabsRow: tabsRow as HTMLElement,
      chipsRow: chipsRow as HTMLElement,
      summaryRow: summaryRow as HTMLElement,
      hasOverflowRisk
    })

    assertNoHorizontalOverflow({
      paper: paper as HTMLElement,
      rows: [tabsRow as HTMLElement, chipsRow as HTMLElement, summaryRow as HTMLElement]
    })
  })
})

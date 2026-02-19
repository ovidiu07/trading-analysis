import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, vi } from 'vitest'
import AnalyticsPage from './AnalyticsPage'
import { AuthProvider } from '../auth/AuthContext'
import { AnalyticsResponse, CoachResponse } from '../api/analytics'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'

const mockFetchAnalyticsSummary = vi.fn()
const mockFetchAnalyticsCoach = vi.fn()
const mockUseChecklistTemplateQuery = vi.fn()
const mockUseSaveChecklistTemplateMutation = vi.fn()

const setViewportWidth = (width: number) => {
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
      dispatchEvent: vi.fn(),
    }
  }) as unknown as typeof window.matchMedia
}

vi.mock('../api/analytics', async () => {
  const actual = await vi.importActual<typeof import('../api/analytics')>('../api/analytics')
  return {
    ...actual,
    fetchAnalyticsSummary: (...args: unknown[]) => mockFetchAnalyticsSummary(...args),
    fetchAnalyticsCoach: (...args: unknown[]) => mockFetchAnalyticsCoach(...args)
  }
})

vi.mock('../hooks/useChecklist', () => ({
  useChecklistTemplateQuery: (...args: unknown[]) => mockUseChecklistTemplateQuery(...args),
  useSaveChecklistTemplateMutation: (...args: unknown[]) => mockUseSaveChecklistTemplateMutation(...args)
}))

const buildResponse = (): AnalyticsResponse => ({
  kpi: {
    totalPnlGross: 1200,
    totalPnlNet: 1000,
    grossProfit: 1400,
    grossLoss: 400,
    winRate: 60,
    lossRate: 40,
    averageWin: 200,
    averageLoss: 100,
    medianPnl: 50,
    payoffRatio: 2,
    expectancy: 50,
    profitFactor: 3.5,
    totalTrades: 20,
    winningTrades: 12,
    losingTrades: 8,
    flatTrades: 0,
    openTrades: 2,
    closedTrades: 18,
  },
  costs: {
    totalFees: 10,
    totalCommission: 5,
    totalSlippage: 2,
    totalCosts: 17,
    avgFees: 0.5,
    avgCommission: 0.25,
    avgSlippage: 0.1,
    avgCosts: 0.85,
    netVsGrossDelta: 200,
  },
  drawdown: {
    maxDrawdown: 300,
    maxDrawdownPercent: 12.5,
    maxDrawdownDurationTrades: 4,
    maxDrawdownDurationDays: 6,
    recoveryFactor: 3.2,
    ulcerIndex: 1.1,
  },
  distribution: {
    standardDeviation: 20,
    p10: -50,
    p25: -20,
    p50: 10,
    p75: 40,
    p90: 80,
    pnlHistogram: [],
    outlierLower: -200,
    outlierUpper: 200,
    outlierCount: 1,
  },
  consistency: {
    greenWeeks: 2,
    redWeeks: 1,
    bestDay: { date: '2026-01-10', value: 150 },
    worstDay: { date: '2026-01-12', value: -80 },
    bestWeek: { date: '2026-01-08', value: 200 },
    worstWeek: { date: '2026-01-15', value: -150 },
    streaks: {
      maxWinStreak: 3,
      maxLossStreak: 2,
      currentStreakType: 'WIN',
      currentStreakCount: 2,
    },
  },
  timeEdge: {
    averageHoldingSeconds: 900,
    medianHoldingSeconds: 600,
    holdingBuckets: [],
    dayOfWeek: [],
    hourOfDay: [],
  },
  attribution: {
    symbols: [],
    strategies: [],
    setups: [],
    catalysts: [],
    bottomSymbols: [],
    bottomTags: [],
    concentration: {
      top1PnlShare: 40,
      top3PnlShare: 80,
      top1TradeShare: 30,
      top3TradeShare: 70,
    },
  },
  risk: {
    available: false,
    averageR: null,
    medianR: null,
    expectancyR: null,
    winRateR: 0,
    averageRiskAmount: null,
    averageRiskPercent: null,
    rDistribution: [],
    tradesWithRisk: 0,
  },
  dataQuality: {
    missingClosedAtCount: 0,
    inconsistentStatusCount: 0,
    missingStrategyCount: 0,
    missingSetupCount: 0,
    missingCatalystCount: 0,
    missingPnlPercentCount: 0,
    missingRiskCount: 0,
    timezoneNote: 'Stored in UTC, displayed in Europe/Bucharest',
  },
  traderRead: {
    insights: [{ text: 'Most P&L comes from AAPL (40% of net P&L, N=8).' }],
  },
  filterOptions: {
    symbols: ['AAPL', 'TSLA'],
    markets: ['STOCK'],
    strategies: ['Breakout'],
    setups: ['Trend'],
    catalysts: ['Earnings'],
  },
  equityCurve: [],
  groupedPnl: [],
  drawdownSeries: [],
  weeklyPnl: [],
  rolling20: [],
  rolling50: [],
  breakdown: {},
})

const buildCoachResponse = (): CoachResponse => ({
  dataQuality: {
    totalTrades: 20,
    closedTrades: 18,
    missingClosedAtCount: 0,
    missingPnlNetCount: 0,
    missingEntryExitCount: 0,
    inconsistentPnlCount: 0,
  },
  advice: [],
})

describe('AnalyticsPage', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    setViewportWidth(1280)
    mockUseChecklistTemplateQuery.mockReset()
    mockUseSaveChecklistTemplateMutation.mockReset()
    mockUseChecklistTemplateQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null
    })
    mockUseSaveChecklistTemplateMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: false,
      isError: false,
      error: null
    })
  })

  it('requests analytics summary on load and renders KPI', async () => {
    mockFetchAnalyticsSummary.mockResolvedValueOnce(buildResponse())
    mockFetchAnalyticsCoach.mockResolvedValueOnce(buildCoachResponse())
    render(
      <MemoryRouter>
        <AuthProvider>
          <I18nProvider>
            <AnalyticsPage />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => expect(mockFetchAnalyticsSummary).toHaveBeenCalled())
    expect(mockFetchAnalyticsSummary).toHaveBeenCalledWith({ status: 'CLOSED', dateMode: 'CLOSE' })
    expect(mockFetchAnalyticsCoach).toHaveBeenCalledWith({ status: 'CLOSED', dateMode: 'CLOSE' })
    expect(await screen.findByText('Net P&L')).toBeInTheDocument()
  })

  it('applies filters and triggers request', async () => {
    mockFetchAnalyticsSummary.mockResolvedValue(buildResponse())
    mockFetchAnalyticsCoach.mockResolvedValue(buildCoachResponse())
    render(
      <MemoryRouter>
        <AuthProvider>
          <I18nProvider>
            <AnalyticsPage />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Symbol'), 'AAPL')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(mockFetchAnalyticsSummary).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'AAPL' }))
      expect(mockFetchAnalyticsCoach).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'AAPL' }))
    })
  })

  it('switches to mobile-friendly controls on narrow screens', async () => {
    setViewportWidth(390)
    mockFetchAnalyticsSummary.mockResolvedValue(buildResponse())
    mockFetchAnalyticsCoach.mockResolvedValue(buildCoachResponse())
    render(
      <MemoryRouter>
        <AuthProvider>
          <I18nProvider>
            <AnalyticsPage />
          </I18nProvider>
        </AuthProvider>
      </MemoryRouter>
    )

    await waitFor(() => expect(mockFetchAnalyticsSummary).toHaveBeenCalled())
    expect(screen.getByLabelText('Analytics view')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
  })
})

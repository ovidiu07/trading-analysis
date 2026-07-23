import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AnalyticsPage from './AnalyticsPage'
import { AuthProvider } from '../auth/AuthContext'
import { I18nProvider, useI18n } from '../i18n'
import { AnalyticsResponse, CoachResponse } from '../api/analytics'

const mockFetchAnalyticsSummary = vi.fn()
const mockFetchAnalyticsCoach = vi.fn()
const mockFetchSignalAnalyticsSummary = vi.fn()
const mockFetchSignalRecommendations = vi.fn()
const mockFetchSignalBreakdownBySetup = vi.fn()
const mockFetchSignalBreakdownByRegime = vi.fn()
const mockFetchSignalBySymbolTimeframe = vi.fn()
const mockUseChecklistTemplateQuery = vi.fn()
const mockUseSaveChecklistTemplateMutation = vi.fn()

vi.mock('../features/accountScope/useAccountScope', () => ({
  useAccountScope: () => ({
    scope: { mode: 'all', accountIds: [] },
    setScope: vi.fn(),
    clearScope: vi.fn(),
    accounts: [],
    isLoading: false,
    isError: false,
    retry: vi.fn(),
    apiParams: {},
    cacheKey: 'all',
    selectionNotice: '',
    clearSelectionNotice: vi.fn()
  })
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

vi.mock('../api/signalIntel', () => ({
  fetchSignalAnalyticsSummary: (...args: unknown[]) => mockFetchSignalAnalyticsSummary(...args),
  fetchSignalRecommendations: (...args: unknown[]) => mockFetchSignalRecommendations(...args),
  fetchSignalBreakdownBySetup: (...args: unknown[]) => mockFetchSignalBreakdownBySetup(...args),
  fetchSignalBreakdownByRegime: (...args: unknown[]) => mockFetchSignalBreakdownByRegime(...args),
  fetchSignalBySymbolTimeframe: (...args: unknown[]) => mockFetchSignalBySymbolTimeframe(...args)
}))

vi.mock('../hooks/useChecklist', () => ({
  useChecklistTemplateQuery: (...args: unknown[]) => mockUseChecklistTemplateQuery(...args),
  useSaveChecklistTemplateMutation: (...args: unknown[]) => mockUseSaveChecklistTemplateMutation(...args)
}))

const buildSummary = (): AnalyticsResponse => ({
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
    markets: ['STOCK', 'FOREX'],
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

const buildCoach = (): CoachResponse => ({
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

function ForceLanguage({ language }: { language: 'en' | 'ro' }) {
  const { setLanguage } = useI18n()

  useEffect(() => {
    setLanguage(language)
  }, [language, setLanguage])

  return null
}

const findLabelForControl = (labelText: string) => {
  const control = screen.getByLabelText(labelText)
  const inputId = control.getAttribute('id')
  expect(inputId).toBeTruthy()
  const label = document.querySelector(`label[for="${inputId}"]`)
  expect(label).toBeTruthy()
  return label as HTMLLabelElement
}

describe('Analytics filters label/value overlap', () => {
  beforeEach(() => {
    mockUseChecklistTemplateQuery.mockReset()
    mockUseSaveChecklistTemplateMutation.mockReset()
    mockFetchAnalyticsSummary.mockReset()
    mockFetchAnalyticsCoach.mockReset()
    mockFetchSignalAnalyticsSummary.mockReset()
    mockFetchSignalRecommendations.mockReset()
    mockFetchSignalBreakdownBySetup.mockReset()
    mockFetchSignalBreakdownByRegime.mockReset()
    mockFetchSignalBySymbolTimeframe.mockReset()

    mockUseChecklistTemplateQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false
    })
    mockUseSaveChecklistTemplateMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: false
    })
    mockFetchAnalyticsSummary.mockResolvedValue(buildSummary())
    mockFetchAnalyticsCoach.mockResolvedValue(buildCoach())
    mockFetchSignalAnalyticsSummary.mockResolvedValue({
      overview: {
        totalSignals: 20,
        closedSignals: 16,
        openSignals: 4,
        winRate: 56,
        expectancyR: 0.32,
        avgPnlR: 0.32,
        avgConfidenceScore: 74,
        avgHoldBars: 5,
        avgHoldMinutes: 55
      },
      recentWindows: [],
      confidenceTrend: [],
      weakConditions: [],
      topRecommendation: null
    })
    mockFetchSignalRecommendations.mockResolvedValue({ recommendations: [] })
    mockFetchSignalBreakdownBySetup.mockResolvedValue({ rows: [] })
    mockFetchSignalBreakdownByRegime.mockResolvedValue({ rows: [] })
    mockFetchSignalBySymbolTimeframe.mockResolvedValue({ rows: [] })
  })

  it.each([
    { language: 'en', width: 599, height: 814, direction: 'Direction', market: 'Market', status: 'Status', any: 'Any' },
    { language: 'en', width: 881, height: 935, direction: 'Direction', market: 'Market', status: 'Status', any: 'Any' },
    { language: 'ro', width: 599, height: 814, direction: 'Direcție', market: 'Piață', status: 'Stare', any: 'Oricare' },
    { language: 'ro', width: 881, height: 935, direction: 'Direcție', market: 'Piață', status: 'Stare', any: 'Oricare' }
  ])(
    'keeps Direction/Market/Status labels separated from selected values at $width x $height in $language',
    async ({ language, width, height, direction, market, status, any }) => {
      localStorage.setItem('app.language', language)
      setViewportSize(width, height)

      render(
        <MemoryRouter initialEntries={['/analytics']}>
          <AuthProvider>
            <I18nProvider>
              <ForceLanguage language={language as 'en' | 'ro'} />
              <AnalyticsPage />
            </I18nProvider>
          </AuthProvider>
        </MemoryRouter>
      )

      await waitFor(() => expect(mockFetchAnalyticsSummary).toHaveBeenCalled())

      const directionControl = screen.getByLabelText(direction)
      const marketControl = screen.getByLabelText(market)
      const statusControl = screen.getByLabelText(status)

      expect(directionControl).toHaveDisplayValue(any)
      expect(marketControl).toHaveDisplayValue(any)
      expect(statusControl).toHaveDisplayValue(status === 'Status' ? 'Closed' : 'Închisă')

      const directionLabel = findLabelForControl(direction)
      const marketLabel = findLabelForControl(market)
      const statusLabel = findLabelForControl(status)

      expect(directionLabel).toHaveClass('MuiInputLabel-shrink')
      expect(marketLabel).toHaveClass('MuiInputLabel-shrink')
      expect(statusLabel).toHaveClass('MuiInputLabel-shrink')
    }
  )
})

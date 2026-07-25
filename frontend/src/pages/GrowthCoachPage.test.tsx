import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import type { GrowthCoachResponse } from '../api/growthCoach'
import GrowthCoachPage from './GrowthCoachPage'

const mockFetchGrowthCoach = vi.fn()
const mockSetScope = vi.fn()

vi.mock('../features/accountScope/useAccountScope', () => ({
  useAccountScope: () => ({
    scope: { mode: 'selected', accountIds: ['account-1'] },
    setScope: mockSetScope,
    clearScope: vi.fn(),
    accounts: [{ id: 'account-1', name: 'Primary', currency: 'USD', status: 'ACTIVE' }],
    isLoading: false,
    isError: false,
    retry: vi.fn(),
    apiParams: { accountIds: 'account-1' },
    cacheKey: 'account-1',
    selectionNotice: '',
    clearSelectionNotice: vi.fn()
  })
}))

vi.mock('../api/growthCoach', async () => {
  const actual = await vi.importActual<typeof import('../api/growthCoach')>('../api/growthCoach')
  return {
    ...actual,
    fetchGrowthCoach: (...args: unknown[]) => mockFetchGrowthCoach(...args)
  }
})

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const maxMatch = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)px\)/)
    const max = maxMatch ? Number(maxMatch[1]) : null
    return {
      matches: max === null ? false : width <= max,
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

const response = {
  mode: 'ACCOUNT',
  generatedAt: '2026-07-25T10:00:00Z',
  requiresAccountSelection: false,
  portfolioAccounts: [],
  detail: {
    account: { id: 'account-1', name: 'Primary', type: 'PERSONAL', currency: 'USD', timezone: 'Europe/Bucharest' },
    profile: {
      id: 'profile-1', accountType: 'PERSONAL', initialCapital: 10000, capitalSource: 'USER_ENTERED',
      defaultRiskPerTradePct: 0.5, preferredMaxRiskPerTradePct: 1, maxConcurrentRiskPct: 2,
      maxDailyRiskPct: 2, maxDailyLossAmount: 200, maxTotalDrawdownPct: 10, maxTotalDrawdownAmount: 1000,
      drawdownType: 'STATIC', monthlyTargetPct: 3, compoundsMonthly: false, trailingDrawdownEnabled: false
    },
    monthlyPlan: {
      id: 'plan-1', monthKey: '2026-07', timezone: 'Europe/Bucharest', monthStartBalance: 10000,
      monthStartEquity: 10000, targetType: 'PERCENTAGE', targetBasis: 'MONTH_START_BALANCE',
      targetPct: 3, targetAmount: 300, plannedRiskPerTradePct: 0.5, hardMaxRiskPerTradePct: 1,
      plannedMaxTradesPerDay: 3, plannedMaxTradesPerWeek: 12, plannedMinimumRr: 1.5,
      snapshotSource: 'CAPTURED'
    },
    capital: {
      initialCapital: 10000, ledgerNet: 0, lifetimeRealisedTradePnl: 150, currentRealisedBalance: 10150,
      currentFloatingPnl: 40, currentEquity: 10190, withdrawableProfit: 150, profitAfterSplit: 150,
      drawdownBuffer: 1190, dailyLossRemaining: 200, totalLossRemaining: 1190,
      floatingPnlAvailable: true, riskReference: 'CURRENT_REALISED_BALANCE'
    },
    target: {
      targetAmount: 300, realisedCurrentMonthPnl: 150, floatingPnl: 40, realisedProgressPct: 50,
      equityAdjustedProgressPct: 63.33, remainingTargetAmount: 150, equityAdjustedRemainingAmount: 110,
      requiredR: 3, tradingDaysRemaining: 5, targetReached: false
    },
    realisedPerformance: {},
    openExposure: {
      openTradeCount: 1, totalFloatingPnl: 40, floatingPnlAvailable: true, grossLongExposure: 11200,
      grossShortExposure: 0, netExposure: 11200, totalOpenRisk: null, openRiskKnown: false,
      tradesWithoutStop: 1, tradesWithoutQuantity: 0, tradesWithoutEntryPrice: 0,
      tradesWithoutReliablePrice: 0, trades: [{
        tradeId: 'trade-1', symbol: 'EUR_USD', direction: 'LONG', entryPrice: 1.1, currentPrice: 1.104,
        priceStale: false, quantity: 1, stopLoss: null, takeProfit: 1.12, floatingPnl: 40,
        openRisk: null, plannedRr: null, currentR: null, notionalExposure: 11000, ageMinutes: 60,
        strategy: 'Breakout', setup: 'London', warnings: ['MISSING_STOP', 'RISK_UNKNOWN']
      }]
    },
    riskPlan: {
      state: 'UNKNOWN', recommendedRiskAmount: null, recommendedRiskPct: null,
      maximumPermittedRiskAmount: null, maximumPermittedRiskPct: null, reasons: [], stopConditions: []
    },
    feasibility: { classification: 'NOT_ENOUGH_DATA', reasonKeys: ['growthCoach.feasibility.reasons.missingRisk'], reasonParams: {} },
    projection: {
      available: false, dataset: 'TRAILING_20', sampleSize: 20, expectancyR: 0.2,
      unavailableReasonKey: 'growthCoach.projection.unavailable.data'
    },
    confidence: {
      level: 'LOW', score: 45, reasonKeys: ['growthCoach.confidence.reasons.openRiskUnknown'],
      reasonParams: { tradeCount: 20, riskCoveragePct: 70, inconsistentCount: 0 }
    },
    coachMessages: [{
      key: 'OPEN_TRADE_WITHOUT_STOP', category: 'ACTIVE_TRADES', severity: 'CRITICAL', priority: 980,
      titleKey: 'growthCoach.messages.OPEN_TRADE_WITHOUT_STOP.title',
      messageKey: 'growthCoach.messages.OPEN_TRADE_WITHOUT_STOP.message',
      actionKeys: ['growthCoach.actions.addStops'], params: { count: 1 }, evidence: {}, blocking: true
    }],
    scenarios: [],
    performanceDrivers: {
      strongestStrategy: { name: 'Breakout', sampleSize: 12, expectancy: 20, expectancyR: 0.2, confidence: 'MEDIUM' },
      costPctOfGrossProfit: 5, costPerTrade: 1.5
    },
    dataQuality: {
      validClosedTrades: 20, missingCloseTime: 0, missingPnl: 0, inconsistentPnl: 0,
      missingRisk: 6, missingStop: 1, missingQuantity: 0, missingStrategy: 0, missingSetup: 0,
      reconstructedCapital: false, affectedTradeIds: ['trade-1']
    },
    ledgerEvents: [],
    progressSeries: [
      { date: '2026-07-01', realisedBalance: 10000, targetBalance: 10300, plannedBalance: 10010, drawdownBoundary: 9000 },
      { date: '2026-07-25', realisedBalance: 10150, targetBalance: 10300, plannedBalance: 10250, drawdownBoundary: 9000 }
    ],
    disclaimer: 'growthCoach.disclaimer'
  }
} as unknown as GrowthCoachResponse

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/coach?accountIds=account-1']}>
      <QueryClientProvider client={client}>
        <I18nProvider><GrowthCoachPage /></I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.setItem('app.language', 'en')
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  setViewportWidth(320)
  mockFetchGrowthCoach.mockResolvedValue(response)
})

test('separates realised and equity-adjusted progress and renders old open trades on mobile', async () => {
  renderPage()

  expect(await screen.findByText('Realised progress')).toBeInTheDocument()
  expect(screen.getByText('Equity-adjusted progress')).toBeInTheDocument()
  expect(screen.getByText('Open risk is unknown')).toBeInTheDocument()
  expect(screen.getByText(/EUR_USD/)).toBeInTheDocument()
  expect(screen.getAllByText('Missing stop').length).toBeGreaterThan(0)
  expect(screen.getByText('Not counted as completed target progress.')).toBeInTheDocument()
})

test('opens the monthly target editing flow', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Edit monthly plan' }))

  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('Edit monthly growth plan')).toBeInTheDocument()
  expect(screen.getByLabelText('Target (%)')).toHaveValue(3)
  await waitFor(() => expect(mockFetchGrowthCoach).toHaveBeenCalledWith('account-1', expect.any(String)))
})

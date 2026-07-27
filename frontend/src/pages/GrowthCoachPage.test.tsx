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

const operatingResponse = {
  ...response,
  detail: {
    ...response.detail!,
    openExposure: {
      ...response.detail!.openExposure,
      openTradeCount: 0,
      trades: [],
      totalFloatingPnl: 0,
      totalOpenRisk: 0,
      openRiskKnown: true,
      tradesWithoutStop: 0
    },
    operatingSystem: {
      selectedPeriod: {
        periodType: 'MONTH', periodKey: '2026-07', anchorDate: '2026-07-27',
        startsAt: '2026-07-01T00:00:00+03:00', endsAtExclusive: '2026-08-01T00:00:00+03:00',
        timezone: 'Europe/Bucharest'
      },
      plans: {
        day: { id: 'day-plan', periodType: 'DAY', periodKey: '2026-07-27', timezone: 'Europe/Bucharest',
          targetType: 'FIXED_AMOUNT', targetValue: 50, targetAmount: 50, maxLossType: 'FIXED_AMOUNT',
          maxLossValue: 100, maxLossAmount: 100, maxTrades: 4, maxRiskBudget: 100, maxConsecutiveLosses: 2,
          defaultRiskPerTrade: 0.5, minimumRr: 1.5, stopAfterTarget: false, reduceRiskAfterTarget: true,
          riskReductionPct: 50, stopAfterMaxLoss: true, stopAfterConsecutiveLosses: true,
          allocationMode: 'MANUAL', active: true, version: 1, effectiveFrom: '2026-07-27T00:00:00+03:00' },
        week: { id: 'week-plan', periodType: 'WEEK', periodKey: '2026-07-27', timezone: 'Europe/Bucharest',
          targetType: 'FIXED_AMOUNT', targetValue: 150, targetAmount: 150, maxLossType: 'FIXED_AMOUNT',
          maxLossValue: 300, maxLossAmount: 300, maxTrades: 12, maxRiskBudget: 300, maxConsecutiveLosses: 3,
          defaultRiskPerTrade: 0.5, minimumRr: 1.5, stopAfterTarget: false, reduceRiskAfterTarget: true,
          riskReductionPct: 50, stopAfterMaxLoss: true, stopAfterConsecutiveLosses: true,
          allocationMode: 'MANUAL', active: true, version: 1, effectiveFrom: '2026-07-27T00:00:00+03:00' },
        month: { id: 'month-plan', periodType: 'MONTH', periodKey: '2026-07', timezone: 'Europe/Bucharest',
          targetType: 'FIXED_AMOUNT', targetValue: 300, targetAmount: 300, maxLossType: 'FIXED_AMOUNT',
          maxLossValue: 800, maxLossAmount: 800, maxTrades: 40, maxRiskBudget: 800, maxConsecutiveLosses: 3,
          defaultRiskPerTrade: 0.5, minimumRr: 1.5, stopAfterTarget: false, reduceRiskAfterTarget: true,
          riskReductionPct: 50, stopAfterMaxLoss: true, stopAfterConsecutiveLosses: true,
          allocationMode: 'MANUAL', active: true, version: 1, effectiveFrom: '2026-07-01T00:00:00+03:00' }
      },
      selectedSummary: {
        periodType: 'MONTH', periodStartBalance: 10000, realisedTradingPnl: 150, realisedPnlPct: 1.5,
        realisedR: 3, netLedgerMovement: -100, netAccountChange: 50, currentRealisedBalance: 10050,
        currentEquity: 10050, floatingPnl: 0, targetAmount: 300, targetProgressPct: 50, targetRemaining: 150,
        lossAllowanceRemaining: 650, completedTrades: 2, winningTrades: 2, losingTrades: 0, winRate: 100,
        averageTrade: 75, grossProfit: 150, grossLoss: 0, riskUsed: 100, riskRemaining: 700,
        tradesRemaining: 38, currentConsecutiveLosses: 0, maximumDrawdown: 0, openRisk: 0
      },
      todayActivity: {
        summary: {
          periodType: 'DAY', periodStartBalance: 10000, realisedTradingPnl: 150, realisedPnlPct: 1.5,
          realisedR: 3, netLedgerMovement: -100, netAccountChange: 50, currentRealisedBalance: 10050,
          currentEquity: 10050, floatingPnl: 0, targetAmount: 50, targetProgressPct: 300, targetRemaining: 0,
          lossAllowanceRemaining: 100, completedTrades: 2, winningTrades: 2, losingTrades: 0, winRate: 100,
          averageTrade: 75, grossProfit: 150, grossLoss: 0, riskUsed: 100, riskRemaining: 0,
          tradesRemaining: 2, currentConsecutiveLosses: 0, maximumDrawdown: 0, openRisk: 0
        },
        currentlyOpenTrades: 0,
        tradingPermission: 'REDUCED_RISK_ONLY',
        closedTrades: [
          { tradeId: 'closed-1', symbol: 'EURUSD', direction: 'LONG', openedAt: '2026-07-27T08:00:00+03:00',
            closedAt: '2026-07-27T09:00:00+03:00', pnl: 100, realisedR: 2, initialRisk: 50 },
          { tradeId: 'closed-2', symbol: 'GBPUSD', direction: 'SHORT', openedAt: '2026-07-27T10:00:00+03:00',
            closedAt: '2026-07-27T11:00:00+03:00', pnl: 50, realisedR: 1, initialRisk: 50 }
        ]
      },
      tradingPermission: {
        state: 'REDUCED_RISK_ONLY', primaryReason: 'growthCoach.permission.reasons.targetReached',
        secondaryReasons: [], maximumPermittedRisk: 25, maximumPermittedRiskPct: 0.25,
        remainingTrades: 2, applicableLimit: 'DAY', recommendedAction: 'growthCoach.permission.actions.protectResult'
      },
      periodComparisons: ['DAY', 'WEEK', 'MONTH'].map((periodType) => ({
        periodType, realisedPnl: 150, realisedPct: 1.5, realisedR: 3, target: 300, targetProgress: 50,
        trades: 2, winRate: 100, averageTrade: 75, riskUsed: 100, riskRemaining: 100,
        drawdown: 0, adherenceScore: 100, tradingStatus: 'REDUCED_RISK_ONLY'
      })),
      planAdherence: {
        score: 100, passedRules: 5, failedRules: 0, unavailableRules: 0, confidence: 'HIGH',
        passed: [], failed: [], unavailable: []
      },
      metricConfidence: [
        { metric: 'BALANCE', status: 'HIGH', score: 95, reason: 'growthCoach.confidenceMetrics.balance',
          missingDataCount: 0, affectedMetrics: ['CURRENT_REALISED_BALANCE'], action: 'growthCoach.confidenceMetrics.action' }
      ],
      chartSeries: [
        { date: '2026-07-27', cumulativeTradingPnl: 150, dailyTradingPnl: 150, cumulativeR: 3, dailyR: 3,
          realisedBalance: 10050, equity: 10050, plannedProgress: 260, target: 300, maximumLoss: -800,
          drawdownLimit: 9200, cumulativeRisk: 100 }
      ],
      chartMarkers: [],
      planHistory: []
    }
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
  await waitFor(() => expect(mockFetchGrowthCoach).toHaveBeenCalledWith(
    'account-1', expect.any(String), 'MONTH', expect.any(String)
  ))
})

test('shows two closed trades in today activity while active exposure remains empty at 320px', async () => {
  mockFetchGrowthCoach.mockResolvedValueOnce(operatingResponse)
  renderPage()

  expect(await screen.findByText("Today's Trading Activity")).toBeInTheDocument()
  expect(screen.getByText(/EURUSD/)).toBeInTheDocument()
  expect(screen.getByText(/GBPUSD/)).toBeInTheDocument()
  expect(screen.getByText('No active trades')).toBeInTheDocument()
  expect(screen.getByText('Reduced risk only')).toBeInTheDocument()
  expect(screen.getAllByText('Today').length).toBeGreaterThan(0)
})

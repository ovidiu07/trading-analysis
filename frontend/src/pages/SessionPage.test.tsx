import '@testing-library/jest-dom/vitest'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, type AppLanguage, useI18n } from '../i18n'
import SessionPage from './SessionPage'

const sessionApiMock = vi.hoisted(() => ({
  getTodaySession: vi.fn(),
  saveTodaySessionConfig: vi.fn(),
  updateTodaySessionPlannedTickers: vi.fn(),
  updateTodaySessionChecklist: vi.fn(),
  updateTodaySessionLockIn: vi.fn(),
  listChecklistTemplates: vi.fn(),
  createChecklistTemplate: vi.fn(),
  updateChecklistTemplate: vi.fn(),
  deleteChecklistTemplate: vi.fn(),
  createSessionLevel: vi.fn(),
  updateSessionLevel: vi.fn(),
  deleteSessionLevel: vi.fn(),
  setSessionRoles: vi.fn(),
  suggestSessionLevels: vi.fn(),
  listSessionPools: vi.fn(),
  createSessionPool: vi.fn(),
  updateSessionPool: vi.fn(),
  deleteSessionPool: vi.fn(),
  getSessionNarrative: vi.fn(),
  updateSessionNarrative: vi.fn(),
  startTradeFromSession: vi.fn(),
  closeTradeFromSession: vi.fn(),
  saveTradeEntryJournal: vi.fn()
}))

const plansApiMock = vi.hoisted(() => ({
  listDailyPlans: vi.fn()
}))

const strategiesApiMock = vi.hoisted(() => ({
  listStrategies: vi.fn()
}))

const fxApiMock = vi.hoisted(() => ({
  fetchFxRate: vi.fn()
}))

const assetsApiMock = vi.hoisted(() => ({
  uploadAsset: vi.fn()
}))

const chartProfilesApiMock = vi.hoisted(() => ({
  listChartProfiles: vi.fn(),
  createChartProfile: vi.fn(),
  updateChartProfile: vi.fn(),
  deleteChartProfile: vi.fn(),
  setDefaultChartProfile: vi.fn()
}))

const backtestApiMock = vi.hoisted(() => ({
  createBacktestRun: vi.fn(),
  getBacktestCandles: vi.fn(),
  getBacktestDataset: vi.fn(),
  getBacktestDatasetSummary: vi.fn(),
  uploadBacktestCsv: vi.fn(),
  ingestBacktestCsv: vi.fn(),
  listBacktestDatasets: vi.fn(),
  loadDemoBacktestDatasets: vi.fn(),
  getOandaProviderStatus: vi.fn(),
  connectOandaProvider: vi.fn(),
  disconnectOandaProvider: vi.fn(),
  testOandaProvider: vi.fn(),
  listBacktestRuns: vi.fn(),
  getBacktestRun: vi.fn(),
  listBacktestTrades: vi.fn(),
  simulateBacktestTrade: vi.fn()
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'trader@example.com',
      timezone: 'Europe/Bucharest',
      baseCurrency: 'USD'
    }
  })
}))

vi.mock('../api/session', () => sessionApiMock)
vi.mock('../api/plans', () => plansApiMock)
vi.mock('../api/strategies', () => strategiesApiMock)
vi.mock('../api/fx', () => fxApiMock)
vi.mock('../api/chartProfiles', () => chartProfilesApiMock)
vi.mock('../api/backtest', () => backtestApiMock)
vi.mock('../api/assets', async () => {
  const actual = await vi.importActual('../api/assets')
  return {
    ...actual,
    uploadAsset: assetsApiMock.uploadAsset
  }
})

vi.mock('../components/charts/TradingViewWidget', () => ({
  default: ({ symbol, interval }: { symbol?: string; interval?: string }) => (
    <div data-testid="mock-chart">{`chart:${symbol || 'na'}:${interval || 'na'}`}</div>
  )
}))

vi.mock('../components/charts/ReplayCandlestickChart', () => ({
  default: ({ candles, cursorIndex }: { candles: unknown[]; cursorIndex: number }) => (
    <div data-testid="mock-replay-chart">{`replay:${candles.length}:${cursorIndex}`}</div>
  )
}))

const LanguageInitializer = ({ language }: { language: AppLanguage }) => {
  const { setLanguage } = useI18n()

  useEffect(() => {
    setLanguage(language)
  }, [language, setLanguage])

  return null
}

const prereqs = [
  {
    id: 'pr-news',
    text: 'News check done',
    required: true,
    hasNote: false,
    notePlaceholder: null,
    note: '',
    hasValue: false,
    valueLabel: null,
    valueType: 'TEXT',
    value: '',
    defaultChecked: false,
    completed: false
  },
  {
    id: 'pr-levels',
    text: 'Key levels marked',
    required: true,
    hasNote: true,
    notePlaceholder: 'Quick notes',
    note: '',
    hasValue: false,
    valueLabel: null,
    valueType: 'TEXT',
    value: '',
    defaultChecked: false,
    completed: false
  }
]

const triggers = [
  {
    id: 'tr-sweep',
    text: 'Liquidity sweep confirmed',
    required: true,
    hasNote: false,
    notePlaceholder: null,
    note: '',
    hasValue: false,
    valueLabel: null,
    valueType: 'TEXT',
    value: '',
    defaultChecked: false,
    completed: false
  },
  {
    id: 'tr-mss',
    text: 'MSS confirmed on close',
    required: true,
    hasNote: false,
    notePlaceholder: null,
    note: '',
    hasValue: false,
    valueLabel: null,
    valueType: 'TEXT',
    value: '',
    defaultChecked: false,
    completed: false
  }
]

let sessionState: any

const baseSession = () => ({
  id: 'session-1',
  sessionDate: '2026-02-21',
  profitTarget: 200,
  lossLimit: 100,
  maxTrades: 3,
  status: 'ACTIVE',
  realizedPnl: 0,
  closedTradesCount: 0,
  remainingTrades: 3,
  plannedTickers: ['EURUSD'],
  checklistItems: prereqs,
  checklistTemplateId: null,
  prereqsChecklistItems: prereqs,
  triggerChecklistItems: triggers,
  prereqsTemplateId: null,
  triggerTemplateId: null,
  lockInSession: null,
  lockInObjective: null,
  lockInBias: null,
  lockInBiasReason: null,
  lockInAt: null,
  activeSweepLevelId: 'lvl-1',
  activeEntryLevelId: 'lvl-1',
  activeSlLevelId: 'lvl-2',
  activeTpLevelId: 'lvl-1',
  activeSweepPoolId: null,
  levels: [
    {
      id: 'lvl-1',
      label: 'PDH',
      symbol: 'EURUSD',
      type: 'PDH',
      timeframe: 'M15',
      price: 1.0825,
      category: 'LIQUIDITY',
      notes: null,
      sweptAt: null,
      status: 'FRESH',
      strengthScore: 3,
      sweepRole: true,
      entryRole: true,
      slRole: false,
      tpRole: true
    },
    {
      id: 'lvl-2',
      label: 'PDL',
      symbol: 'EURUSD',
      type: 'PDL',
      timeframe: 'M15',
      price: 1.0795,
      category: 'LIQUIDITY',
      notes: null,
      sweptAt: null,
      status: 'FRESH',
      strengthScore: 3,
      sweepRole: false,
      entryRole: false,
      slRole: true,
      tpRole: false
    }
  ],
  pools: [],
  narrative: {
    sessionId: 'session-1',
    htfDraw: 'PDH',
    expectedManipulation: 'RAID_UP',
    deliveryModel: null,
    confirmationModel: 'DISPLACEMENT_M5_MSS_M5',
    notes: ''
  },
  activeTrade: null
})

const basePlan = {
  id: 'plan-1',
  title: 'Plan A',
  summary: 'Summary',
  biasSummary: 'Bullish above PDL',
  keyLevels: ['PDH', 'PDL'],
  executionRules: 'Wait for sweep\nMSS then entry',
  riskNote: "I'm wrong if M5 closes below sweep low.",
  context: 'Macro calm'
}

const renderSessionPage = (language: AppLanguage = 'en') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <MemoryRouter initialEntries={['/today/session']}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <LanguageInitializer language={language} />
          <SessionPage />
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

const getPlannerPanel = () => {
  const plannerTitle = screen.getByText('Trade Planner + Execution')
  const panel = plannerTitle.closest('.MuiCard-root') as HTMLElement | null
  if (!panel) {
    throw new Error('Trade planner panel not found')
  }
  return panel
}

const getAccordionByTitle = (title: RegExp | string) => {
  const heading = typeof title === 'string' ? screen.getByText(title) : screen.getByText(title)
  const accordion = heading.closest('.MuiAccordion-root') as HTMLElement | null
  if (!accordion) {
    throw new Error(`Accordion not found for ${String(title)}`)
  }
  return accordion
}

const getActionButton = (container: HTMLElement, name: RegExp | string) => {
  const button = within(container)
    .getAllByRole('button', { name, hidden: true })
    .find((element) => element.tagName.toLowerCase() === 'button')
  if (!button) {
    throw new Error(`Button not found: ${String(name)}`)
  }
  return button
}

const completeLockIn = async (user: ReturnType<typeof userEvent.setup>) => {
  const lockInCard = screen.getByText(/Session Lock-In/i).closest('.MuiBox-root') as HTMLElement

  await user.click(within(lockInCard).getByRole('combobox', { name: /^Session$/i }))
  await user.click(await screen.findByRole('option', { name: 'London' }))

  await user.click(within(lockInCard).getByRole('combobox', { name: /^Bias$/i }))
  await user.click(await screen.findByRole('option', { name: 'Long' }))

  await user.type(within(lockInCard).getByLabelText(/Bias reason/i), 'Trend continuation in London')
  await user.click(within(lockInCard).getByRole('button', { name: /Save lock-in/i }))

  await waitFor(() => {
    expect(sessionApiMock.updateTodaySessionLockIn).toHaveBeenCalled()
  })
}

const completeChecklistAndTicket = async (user: ReturnType<typeof userEvent.setup>) => {
  const plannerPanel = getPlannerPanel()

  await user.click(screen.getByLabelText(/News check done/i))
  await user.click(screen.getByLabelText(/Key levels marked/i))
  await user.click(screen.getByLabelText(/Liquidity sweep confirmed/i))
  await user.click(screen.getByLabelText(/MSS confirmed on close/i))

  await user.clear(within(plannerPanel).getByLabelText(/entry price/i))
  await user.type(within(plannerPanel).getByLabelText(/entry price/i), '10')

  await user.clear(within(plannerPanel).getByLabelText(/stop[-\s]?loss/i))
  await user.type(within(plannerPanel).getByLabelText(/stop[-\s]?loss/i), '9')

  await user.clear(within(plannerPanel).getByLabelText(/take[-\s]?profit/i))
  await user.type(within(plannerPanel).getByLabelText(/take[-\s]?profit/i), '12')

  await user.type(within(plannerPanel).getByLabelText(/I.?m wrong if/i), 'M5 closes below the sweep low')
}

describe('SessionPage execution funnel', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    localStorage.removeItem('today.session.selectedPlanId')
    localStorage.removeItem('sessionMode.layoutState.user-1')

    sessionState = baseSession()

    sessionApiMock.getTodaySession.mockImplementation(async () => sessionState)
    sessionApiMock.saveTodaySessionConfig.mockImplementation(async () => sessionState)
    sessionApiMock.updateTodaySessionPlannedTickers.mockImplementation(async () => sessionState)
    sessionApiMock.updateTodaySessionChecklist.mockImplementation(async (payload: any) => {
      if (payload.type === 'PREREQS' && payload.items) {
        sessionState = { ...sessionState, prereqsChecklistItems: payload.items, checklistItems: payload.items }
      }
      if (payload.type === 'TRIGGERS' && payload.items) {
        sessionState = { ...sessionState, triggerChecklistItems: payload.items }
      }
      return sessionState
    })
    sessionApiMock.updateTodaySessionLockIn.mockImplementation(async (payload: any) => {
      sessionState = {
        ...sessionState,
        lockInSession: payload.session,
        lockInBias: payload.bias,
        lockInObjective: payload.objective,
        lockInBiasReason: payload.biasReason,
        lockInAt: payload.session && payload.bias && payload.biasReason ? '2026-02-21T08:00:00Z' : null
      }
      return sessionState
    })
    sessionApiMock.listChecklistTemplates.mockResolvedValue([])
    sessionApiMock.createChecklistTemplate.mockResolvedValue({ id: 'tmpl-1', type: 'PREREQS', isDefault: false, name: 'Template', items: [] })
    sessionApiMock.updateChecklistTemplate.mockResolvedValue({ id: 'tmpl-1', type: 'PREREQS', isDefault: true, name: 'Template', items: [] })
    sessionApiMock.deleteChecklistTemplate.mockResolvedValue(undefined)
    sessionApiMock.createSessionLevel.mockImplementation(async (payload: any) => {
      sessionState = {
        ...sessionState,
        levels: [
          ...sessionState.levels,
          { id: `lvl-${sessionState.levels.length + 1}`, ...payload, sweptAt: null }
        ]
      }
      return sessionState
    })
    sessionApiMock.updateSessionLevel.mockImplementation(async ({ id, payload }: any) => {
      sessionState = {
        ...sessionState,
        levels: sessionState.levels.map((level: any) => (level.id === id ? { ...level, ...payload } : level))
      }
      return sessionState
    })
    sessionApiMock.deleteSessionLevel.mockResolvedValue(undefined)
    sessionApiMock.setSessionRoles.mockImplementation(async (_sessionId: any, payload: any) => {
      sessionState = {
        ...sessionState,
        activeSweepLevelId: payload?.sweepLevelId ?? sessionState.activeSweepLevelId,
        activeSweepPoolId: payload?.sweepPoolId ?? sessionState.activeSweepPoolId,
        activeEntryLevelId: payload?.entryLevelId ?? sessionState.activeEntryLevelId,
        activeSlLevelId: payload?.slLevelId ?? sessionState.activeSlLevelId,
        activeTpLevelId: payload?.tpLevelId ?? sessionState.activeTpLevelId
      }
      return sessionState
    })
    sessionApiMock.suggestSessionLevels.mockResolvedValue([])
    sessionApiMock.listSessionPools.mockResolvedValue([])
    sessionApiMock.createSessionPool.mockResolvedValue({})
    sessionApiMock.updateSessionPool.mockResolvedValue({})
    sessionApiMock.deleteSessionPool.mockResolvedValue(undefined)
    sessionApiMock.getSessionNarrative.mockResolvedValue(sessionState.narrative)
    sessionApiMock.updateSessionNarrative.mockImplementation(async (_sessionId: any, payload: any) => {
      sessionState = { ...sessionState, narrative: { ...sessionState.narrative, ...payload } }
      return sessionState.narrative
    })

    sessionApiMock.startTradeFromSession.mockResolvedValue({ id: 'trade-1' })
    sessionApiMock.closeTradeFromSession.mockResolvedValue({})
    sessionApiMock.saveTradeEntryJournal.mockResolvedValue({ id: 'trade-1' })

    plansApiMock.listDailyPlans.mockResolvedValue([basePlan])
    strategiesApiMock.listStrategies.mockResolvedValue({ myStrategies: [], mentorStrategies: [] })
    fxApiMock.fetchFxRate.mockResolvedValue({ rate: 1, source: 'AUTO' })
    assetsApiMock.uploadAsset.mockResolvedValue({
      id: 'asset-1',
      scope: 'TRADE',
      originalFileName: 'chart.png',
      url: '/api/assets/asset-1/view'
    })
    chartProfilesApiMock.listChartProfiles.mockResolvedValue([])
    chartProfilesApiMock.createChartProfile.mockResolvedValue({
      id: 'profile-new',
      name: 'New profile',
      isDefault: false,
      scope: 'SESSION_MODE',
      embedConfigJson: {},
      tjaPrefsJson: {}
    })
    chartProfilesApiMock.updateChartProfile.mockResolvedValue({
      id: 'profile-1',
      name: 'London profile',
      isDefault: true,
      scope: 'SESSION_MODE',
      embedConfigJson: { symbol: 'OANDA:GBPUSD', interval: '5' },
      tjaPrefsJson: { followPlanSymbol: false }
    })
    chartProfilesApiMock.deleteChartProfile.mockResolvedValue(undefined)
    chartProfilesApiMock.setDefaultChartProfile.mockResolvedValue({
      id: 'profile-1',
      name: 'London profile',
      isDefault: true,
      scope: 'SESSION_MODE',
      embedConfigJson: { symbol: 'OANDA:GBPUSD', interval: '5' },
      tjaPrefsJson: { followPlanSymbol: false }
    })
    backtestApiMock.createBacktestRun.mockResolvedValue({
      id: 'run-1',
      symbol: 'OANDA:EURUSD',
      timeframe: 'M1',
      from: '2026-02-01T00:00:00Z',
      to: '2026-02-14T23:59:59Z',
      sessionWindow: 'LONDON',
      spread: 0,
      slippage: 0,
      provider: 'OANDA',
      status: 'READY',
      candleCount: 3,
      candles: []
    })
    backtestApiMock.getBacktestCandles.mockResolvedValue({
      provider: 'OANDA',
      sourceId: 'source-1',
      symbol: 'OANDA:EURUSD',
      timeframe: 'M1',
      from: '2026-02-01T00:00:00Z',
      to: '2026-02-14T23:59:59Z',
      candleCount: 3,
      message: null,
      candles: [
        { timestamp: '2026-02-14T08:00:00Z', open: 1.1, high: 1.101, low: 1.099, close: 1.1005, volume: 100 },
        { timestamp: '2026-02-14T08:01:00Z', open: 1.1005, high: 1.1015, low: 1.0995, close: 1.101, volume: 120 },
        { timestamp: '2026-02-14T08:02:00Z', open: 1.101, high: 1.102, low: 1.1, close: 1.1018, volume: 130 }
      ]
    })
    backtestApiMock.uploadBacktestCsv.mockResolvedValue({
      fileId: 'upload-1',
      fileName: 'tv.csv',
      headers: ['time', 'open', 'high', 'low', 'close', 'volume'],
      mappingRequired: false,
      suggestedMapping: {
        timeColumn: 'time',
        openColumn: 'open',
        highColumn: 'high',
        lowColumn: 'low',
        closeColumn: 'close',
        volumeColumn: 'volume'
      },
      detectedSymbol: 'EURUSD',
      detectedTimeframe: 'M1',
      dataFrom: '2026-02-01T00:00:00Z',
      dataTo: '2026-02-01T01:00:00Z',
      warnings: []
    })
    backtestApiMock.getBacktestDataset.mockImplementation(async (id: string) => {
      if (id === 'dataset-1' || id === 'dataset-csv-1') {
        return {
          id,
          provider: 'CSV',
          sourceId: id === 'dataset-csv-1' ? 'csv-source-1' : 'source-1',
          name: 'tv.csv',
          symbolCanonical: 'EURUSD',
          symbolDisplay: 'EURUSD',
          timeframe: 'M1',
          dataFrom: '2026-02-01T00:00:00Z',
          dataTo: '2026-02-01T01:00:00Z',
          rowCount: 61,
          warnings: []
        }
      }
      return {
        id,
        provider: 'DEMO',
        sourceId: 'DEMO',
        name: 'Demo',
        symbolCanonical: 'EURUSD',
        symbolDisplay: 'DEMO:EURUSD',
        timeframe: 'M5',
        dataFrom: '2025-11-01T00:00:00Z',
        dataTo: '2025-12-31T23:55:00Z',
        rowCount: 1000,
        warnings: []
      }
    })
    backtestApiMock.getBacktestDatasetSummary.mockImplementation(async (id: string) => {
      if (id === 'dataset-1' || id === 'dataset-csv-1') {
        return {
          datasetId: id,
          provider: 'CSV',
          symbolDisplay: 'EURUSD',
          symbolCanonical: 'EURUSD',
          timeframe: 'M1',
          dataFromUtc: '2026-02-01T00:00:00Z',
          dataToUtc: '2026-02-01T01:00:00Z',
          defaultFromUtc: '2026-02-01T00:00:00Z',
          defaultToUtc: '2026-02-01T01:00:00Z',
          defaultWindowDays: 7,
          candleCount: 61,
          timezoneHint: 'UTC'
        }
      }
      return {
        datasetId: id,
        provider: 'DEMO',
        symbolDisplay: 'DEMO:EURUSD',
        symbolCanonical: 'EURUSD',
        timeframe: 'M5',
        dataFromUtc: '2025-11-01T00:00:00Z',
        dataToUtc: '2025-12-31T23:55:00Z',
        defaultFromUtc: '2025-12-24T23:55:00Z',
        defaultToUtc: '2025-12-31T23:55:00Z',
        defaultWindowDays: 7,
        candleCount: 1000,
        timezoneHint: 'UTC'
      }
    })
    backtestApiMock.ingestBacktestCsv.mockResolvedValue({
      dataset: {
        id: 'dataset-1',
        provider: 'CSV',
        sourceId: 'source-1',
        name: 'tv.csv',
        symbolCanonical: 'EURUSD',
        symbolDisplay: 'EURUSD',
        timeframe: 'M1',
        dataFrom: '2026-02-01T00:00:00Z',
        dataTo: '2026-02-01T01:00:00Z',
        rowCount: 61,
        warnings: []
      },
      warnings: []
    })
    backtestApiMock.listBacktestDatasets.mockResolvedValue([])
    backtestApiMock.loadDemoBacktestDatasets.mockResolvedValue([])
    backtestApiMock.getOandaProviderStatus.mockResolvedValue({
      provider: 'OANDA',
      connected: true
    })
    backtestApiMock.listBacktestRuns.mockResolvedValue([])
    backtestApiMock.getBacktestRun.mockResolvedValue(null)
    backtestApiMock.listBacktestTrades.mockResolvedValue([])
    backtestApiMock.simulateBacktestTrade.mockResolvedValue({
      id: 'bt-1',
      runId: 'run-1',
      symbol: 'OANDA:EURUSD',
      direction: 'LONG',
      orderType: 'MARKET',
      entryPrice: 1.1005,
      stopLossPrice: 1.099,
      takeProfitPrice: 1.102,
      requestedAt: '2026-02-14T08:00:30Z',
      entryTime: '2026-02-14T08:01:00Z',
      exitTime: '2026-02-14T08:02:00Z',
      filled: true,
      exitReason: 'TP',
      win: true,
      breakEven: false,
      rMultiple: 1.0,
      maeR: 0.2,
      mfeR: 1.1
    })
  })

  it('renders panels in execution order', async () => {
    renderSessionPage()

    const progressHeading = await screen.findByText('Session progress')
    const checklistHeading = screen.getByText('Session checklist')
    const chartHeading = screen.getByText('Live chart')
    const mentorHeading = screen.getByText('Mentor Plan')
    const plannerHeading = screen.getByText('Trade Planner + Execution')

    const comesBefore = (first: HTMLElement, second: HTMLElement) => (
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
    )

    expect(comesBefore(progressHeading, checklistHeading)).toBe(true)
    expect(comesBefore(checklistHeading, chartHeading)).toBe(true)
    expect(comesBefore(chartHeading, mentorHeading)).toBe(true)
    expect(comesBefore(chartHeading, plannerHeading)).toBe(true)
  })

  it('shows session settings as read-only in lock-in and allows editing in modal', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    const lockInCard = (await screen.findByText(/Session Lock-In/i)).closest('.MuiBox-root') as HTMLElement

    const maxLossField = within(lockInCard).getByLabelText(/Daily max loss/i)
    const maxTradesField = within(lockInCard).getByLabelText(/Max trades/i)
    expect(maxLossField).toHaveAttribute('readonly')
    expect(maxTradesField).toHaveAttribute('readonly')

    await user.click(within(lockInCard).getByRole('button', { name: /Edit settings/i }))
    await user.clear(await screen.findByLabelText(/Max number of trades/i))
    await user.type(screen.getByLabelText(/Max number of trades/i), '2')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(sessionApiMock.saveTodaySessionConfig).toHaveBeenCalled()
    })
  })

  it('keeps start disabled until lock-in and required checklist items are complete', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText(/Session Lock-In/i)).toBeInTheDocument()
    await completeChecklistAndTicket(user)
    expect(screen.getByRole('button', { name: 'Start trade' })).toBeDisabled()

    await completeLockIn(user)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start trade' })).toBeEnabled()
    })
  }, 20_000)

  it('can pick a session level to fill entry price', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    await screen.findByText('Live chart')
    await user.click(screen.getAllByRole('button', { name: /Pick from levels/i })[0])

    const picker = await screen.findByRole('dialog', { name: /Pick from levels/i })
    await user.click(within(picker).getByRole('button', { name: /PDH/i }))

    const plannerPanel = getPlannerPanel()
    expect(within(plannerPanel).getByLabelText(/entry price/i)).toHaveValue(1.0825)
  })

  it('renders pick-from-levels controls as input adornments', async () => {
    renderSessionPage()
    await screen.findByText('Trade Planner + Execution')

    expect(screen.getByTestId('entry-price-adornment')).toBeInTheDocument()
    expect(screen.getByTestId('sl-price-adornment')).toBeInTheDocument()
    expect(screen.getByTestId('tp-price-adornment')).toBeInTheDocument()
  })

  it('sets a sweep level and reflects it in triggers and chart strip', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    await screen.findByText('Live chart')
    await user.click(screen.getAllByRole('button', { name: /Set as Sweep Level/i })[0])

    expect(await screen.findAllByText(/Sweep:\s*PDH/i)).not.toHaveLength(0)
    expect(sessionApiMock.setSessionRoles).toHaveBeenCalledWith('session-1', expect.objectContaining({ sweepLevelId: 'lvl-1' }))
  })

  it('edits prereqs, saves a template, then imports a prereqs template', async () => {
    const user = userEvent.setup()
    const importedPrereq = {
      id: 'pr-imported',
      text: 'Imported prereq from template',
      order: 0,
      required: true,
      hasNote: false,
      notePlaceholder: null,
      hasValue: false,
      valueLabel: null,
      valueType: 'TEXT',
      defaultChecked: false
    }
    sessionApiMock.listChecklistTemplates.mockImplementation(async (type: string) => (
      type === 'PREREQS'
        ? [{ id: 'tmpl-pr', type: 'PREREQS', isDefault: false, name: 'London prereqs', items: [importedPrereq] }]
        : []
    ))
    sessionApiMock.updateTodaySessionChecklist.mockImplementation(async (payload: any) => {
      if (payload.type === 'PREREQS' && payload.templateId === 'tmpl-pr') {
        sessionState = {
          ...sessionState,
          prereqsChecklistItems: [{ ...importedPrereq, note: '', value: '', completed: false }],
          checklistItems: [{ ...importedPrereq, note: '', value: '', completed: false }],
          prereqsTemplateId: 'tmpl-pr'
        }
        return sessionState
      }
      if (payload.type === 'PREREQS' && payload.items) {
        sessionState = { ...sessionState, prereqsChecklistItems: payload.items, checklistItems: payload.items }
      }
      if (payload.type === 'TRIGGERS' && payload.items) {
        sessionState = { ...sessionState, triggerChecklistItems: payload.items }
      }
      return sessionState
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderSessionPage()
    await screen.findByText('Session checklist')

    const prereqsAccordion = getAccordionByTitle(/Pre-trade prerequisites/i)
    await user.click(getActionButton(prereqsAccordion, /Edit prereqs/i))

    const editDialog = await screen.findByRole('dialog', { name: /Edit prereqs/i })
    await user.clear(within(editDialog).getAllByLabelText(/Checklist item/i)[0])
    await user.type(within(editDialog).getAllByLabelText(/Checklist item/i)[0], 'News check complete')
    await user.click(within(editDialog).getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(sessionApiMock.updateTodaySessionChecklist).toHaveBeenCalled()
    })

    await user.click(getActionButton(prereqsAccordion, /Save template/i))
    const saveDialog = await screen.findByRole('dialog', { name: /Save template/i })
    await user.type(within(saveDialog).getByLabelText(/Template name/i), 'My prereq template')
    await user.click(within(saveDialog).getByRole('button', { name: /Save template/i }))

    await waitFor(() => {
      expect(sessionApiMock.createChecklistTemplate).toHaveBeenCalledWith(expect.objectContaining({
        type: 'PREREQS',
        name: 'My prereq template'
      }))
    })

    await user.click(getActionButton(prereqsAccordion, /Import template/i))
    const importDialog = await screen.findByRole('dialog', { name: /Import template/i })
    await user.click(within(importDialog).getByLabelText(/Import template/i))
    await user.click(await screen.findByRole('option', { name: /London prereqs/i }))
    await user.click(within(importDialog).getByRole('button', { name: /^Import$/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(await screen.findByLabelText(/Imported prereq from template/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
  }, 20_000)

  it('saves and imports trigger templates', async () => {
    const user = userEvent.setup()
    const importedTrigger = {
      id: 'tr-imported',
      text: 'Imported trigger template item',
      order: 0,
      required: true,
      hasNote: false,
      notePlaceholder: null,
      hasValue: false,
      valueLabel: null,
      valueType: 'TEXT',
      defaultChecked: false
    }
    sessionApiMock.listChecklistTemplates.mockImplementation(async (type: string) => (
      type === 'TRIGGERS'
        ? [{ id: 'tmpl-tr', type: 'TRIGGERS', isDefault: false, name: 'London trigger model', items: [importedTrigger] }]
        : []
    ))
    sessionApiMock.updateTodaySessionChecklist.mockImplementation(async (payload: any) => {
      if (payload.type === 'TRIGGERS' && payload.templateId === 'tmpl-tr') {
        sessionState = {
          ...sessionState,
          triggerChecklistItems: [{ ...importedTrigger, note: '', value: '', completed: false }],
          triggerTemplateId: 'tmpl-tr'
        }
        return sessionState
      }
      if (payload.type === 'PREREQS' && payload.items) {
        sessionState = { ...sessionState, prereqsChecklistItems: payload.items, checklistItems: payload.items }
      }
      if (payload.type === 'TRIGGERS' && payload.items) {
        sessionState = { ...sessionState, triggerChecklistItems: payload.items }
      }
      return sessionState
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderSessionPage()
    await screen.findByText('Session checklist')

    const triggersAccordion = getAccordionByTitle(/Setup triggers/i)
    await user.click(getActionButton(triggersAccordion, /Save template/i))
    const saveDialog = await screen.findByRole('dialog', { name: /Save template/i })
    await user.type(within(saveDialog).getByLabelText(/Template name/i), 'My trigger template')
    await user.click(within(saveDialog).getByRole('button', { name: /Save template/i }))

    await waitFor(() => {
      expect(sessionApiMock.createChecklistTemplate).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TRIGGERS',
        name: 'My trigger template'
      }))
    })

    await user.click(getActionButton(triggersAccordion, /Import template/i))
    const importDialog = await screen.findByRole('dialog', { name: /Import template/i })
    await user.click(within(importDialog).getByLabelText(/Import template/i))
    await user.click(await screen.findByRole('option', { name: /London trigger model/i }))
    await user.click(within(importDialog).getByRole('button', { name: /^Import$/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(await screen.findByLabelText(/Imported trigger template item/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
  }, 20_000)

  it('updates labels when switching to romanian (smoke)', async () => {
    renderSessionPage('ro')

    expect(await screen.findByText('Checklist sesiune')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Focus execuție/i }).length).toBeGreaterThan(0)
  })

  it('supports screenshot attach via file upload and paste', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    await screen.findByText('Live chart')
    await user.click(screen.getByRole('button', { name: /Attach screenshot/i }))

    const dialog = await screen.findByRole('dialog', { name: /Attach screenshot/i })
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['img'], 'chart.png', { type: 'image/png' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(assetsApiMock.uploadAsset).toHaveBeenCalledWith(expect.objectContaining({
        scope: 'TRADE'
      }))
    })

    const pasteZone = within(dialog).getByRole('textbox', { name: /paste screenshot/i })
    fireEvent.paste(pasteZone, {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => file
          }
        ]
      }
    })

    await waitFor(() => {
      expect(assetsApiMock.uploadAsset).toHaveBeenCalledTimes(2)
    })
  })

  it('applies default chart profile to live embed and saves profile config', async () => {
    const user = userEvent.setup()
    chartProfilesApiMock.listChartProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        name: 'London profile',
        isDefault: true,
        scope: 'SESSION_MODE',
        embedConfigJson: { symbol: 'OANDA:GBPUSD', interval: '5' },
        tjaPrefsJson: { followPlanSymbol: false }
      }
    ])

    renderSessionPage()

    await waitFor(() => {
      expect(screen.getByTestId('mock-chart')).toHaveTextContent('chart:OANDA:GBPUSD:5')
    })

    const chartPanel = screen.getByText('Live chart').closest('.MuiCard-root') as HTMLElement
    await user.click(within(chartPanel).getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(chartProfilesApiMock.updateChartProfile).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({
          embedConfigJson: expect.objectContaining({
            symbol: 'OANDA:GBPUSD',
            interval: '5'
          })
        })
      )
    })
  })

  it('switches to backtest mode, loads replay data, and simulates a backtest trade', async () => {
    const user = userEvent.setup()
    backtestApiMock.listBacktestTrades
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'bt-1',
          runId: 'run-1',
          symbol: 'OANDA:EURUSD',
          direction: 'LONG',
          orderType: 'MARKET',
          entryPrice: 1.1005,
          stopLossPrice: 1.099,
          takeProfitPrice: 1.102,
          requestedAt: '2026-02-14T08:00:30Z',
          entryTime: '2026-02-14T08:01:00Z',
          exitTime: '2026-02-14T08:02:00Z',
          filled: true,
          exitReason: 'TP',
          win: true,
          breakEven: false,
          rMultiple: 1.0,
          maeR: 0.2,
          mfeR: 1.1
        }
      ])

    renderSessionPage()
    await screen.findByText('Session Lock-In')

    await completeChecklistAndTicket(user)
    await completeLockIn(user)

    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))

    await user.click(screen.getByRole('button', { name: /Load data/i }))

    await waitFor(() => {
      expect(backtestApiMock.getBacktestCandles).toHaveBeenCalled()
      expect(backtestApiMock.createBacktestRun).toHaveBeenCalled()
    })
    const candleRequest = backtestApiMock.getBacktestCandles.mock.calls.at(-1)?.[0] as Record<string, string | undefined>
    expect(candleRequest.fromUtc).toMatch(/T00:00:00/)
    expect(candleRequest.toUtc).toMatch(/T23:59:59\.999/)
    expect(screen.getByTestId('mock-replay-chart')).toHaveTextContent('replay:3:0')
    expect(screen.getByTestId('backtest-replay-state')).toHaveTextContent('State: READY')
    expect(screen.getByRole('button', { name: /^Play$/i })).toBeEnabled()

    const plannerPanel = getPlannerPanel()
    await user.click(within(plannerPanel).getByRole('button', { name: 'Start trade' }))

    await waitFor(() => {
      expect(backtestApiMock.simulateBacktestTrade).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          direction: 'LONG',
          replayCursorTime: expect.stringMatching(/^2026-02-14T08:00:00(?:\.000)?Z$/)
        })
      )
    })
    expect(await screen.findByText(/Result:\s*TP/i)).toBeInTheDocument()
  }, 30_000)

  it('keeps replay in ERROR when candle conversion fails', async () => {
    const user = userEvent.setup()
    const createRunCallsBefore = backtestApiMock.createBacktestRun.mock.calls.length
    backtestApiMock.getBacktestCandles.mockResolvedValueOnce({
      provider: 'OANDA',
      sourceId: 'source-1',
      symbol: 'OANDA:EURUSD',
      timeframe: 'M1',
      from: '2026-02-01T00:00:00Z',
      to: '2026-02-14T23:59:59Z',
      candleCount: 2,
      message: null,
      candles: [
        { timestamp: '2026-02-14T08:00:00Z', open: 1.1, high: 1.101, low: 1.099, close: 1.1005, volume: 100 },
        { timestamp: 'invalid-ts', open: 1.1005, high: 1.1015, low: 1.0995, close: 1.101, volume: 120 }
      ]
    })

    renderSessionPage()
    await screen.findByText('Session Lock-In')

    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))
    await user.click(screen.getByRole('button', { name: /Load data/i }))

    expect(await screen.findByText(/Candle data invalid for chart rendering/i)).toBeInTheDocument()
    expect(screen.getByTestId('backtest-replay-state')).toHaveTextContent('State: ERROR')
    expect(backtestApiMock.createBacktestRun.mock.calls).toHaveLength(createRunCallsBefore)
  })

  it('shows provider guidance when OANDA is not connected', async () => {
    const user = userEvent.setup()
    backtestApiMock.getOandaProviderStatus.mockResolvedValue({ provider: 'OANDA', connected: false })

    renderSessionPage()
    await screen.findByText('Session Lock-In')

    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))

    expect(await screen.findByText(/OANDA is not connected/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Settings/i })).toHaveAttribute('href', '/settings')
  })

  it('uploads and ingests CSV in backtest setup', async () => {
    const user = userEvent.setup()
    const csvDataset = {
      id: 'dataset-csv-1',
      provider: 'CSV',
      sourceId: 'csv-source-1',
      name: 'tv.csv',
      symbolCanonical: 'EURUSD',
      symbolDisplay: 'EURUSD',
      timeframe: 'M1',
      dataFrom: '2026-02-01T00:00:00Z',
      dataTo: '2026-02-01T01:00:00Z',
      rowCount: 61,
      warnings: []
    }
    let datasets: any[] = []
    backtestApiMock.listBacktestDatasets.mockImplementation(async () => datasets)
    backtestApiMock.ingestBacktestCsv.mockImplementation(async () => {
      datasets = [csvDataset]
      return { dataset: csvDataset, warnings: [] }
    })

    renderSessionPage()
    await screen.findByText('Session Lock-In')

    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))

    await user.click(screen.getByRole('combobox', { name: /Data source/i }))
    await user.click(await screen.findByRole('option', { name: /CSV upload/i }))

    const fileInput = document.querySelector('input[type=\"file\"][accept=\".csv,text/csv\"]') as HTMLInputElement
    const file = new File(['time,open,high,low,close,volume\\n2026-02-01T00:00:00Z,1,2,0.5,1.5,100'], 'tv.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(backtestApiMock.uploadBacktestCsv).toHaveBeenCalledWith(file)
    })

    await user.click(await screen.findByRole('button', { name: /Ingest dataset/i }))
    await waitFor(() => {
      expect(backtestApiMock.ingestBacktestCsv).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(backtestApiMock.getBacktestCandles).toHaveBeenCalledWith(expect.objectContaining({
        datasetId: 'dataset-csv-1',
        fromUtc: expect.stringMatching(/T00:00:00/),
        toUtc: expect.stringMatching(/T23:59:59\.999/)
      }))
      expect(backtestApiMock.createBacktestRun).toHaveBeenCalledWith(expect.objectContaining({
        dataSource: 'CSV',
        datasetId: 'dataset-csv-1'
      }))
    })
    expect((screen.getByLabelText(/^From$/i) as HTMLInputElement).value).not.toBe('')
    expect((screen.getByLabelText(/^To$/i) as HTMLInputElement).value).not.toBe('')
    expect(screen.getByTestId('mock-replay-chart')).not.toHaveTextContent('replay:0:0')
    expect(screen.getByTestId('backtest-replay-state')).toHaveTextContent('State: READY')
    expect(screen.getByRole('table', { name: /Loaded candle stats/i })).toBeInTheDocument()
  }, 30_000)

  it('autofills backtest date inputs from dataset summary defaults', async () => {
    const user = userEvent.setup()
    const csvDataset = {
      id: 'dataset-csv-1',
      provider: 'CSV',
      sourceId: 'csv-source-1',
      name: 'tv.csv',
      symbolCanonical: 'EURUSD',
      symbolDisplay: 'EURUSD',
      timeframe: 'M1',
      dataFrom: '2026-02-01T00:00:00Z',
      dataTo: '2026-02-28T23:59:59Z',
      rowCount: 3000,
      warnings: []
    }
    backtestApiMock.listBacktestDatasets.mockResolvedValue([csvDataset])
    backtestApiMock.getBacktestDatasetSummary.mockResolvedValue({
      datasetId: 'dataset-csv-1',
      provider: 'CSV',
      symbolDisplay: 'EURUSD',
      symbolCanonical: 'EURUSD',
      timeframe: 'M1',
      dataFromUtc: '2026-02-01T00:00:00Z',
      dataToUtc: '2026-02-28T23:59:59Z',
      defaultFromUtc: '2026-02-10T00:00:00Z',
      defaultToUtc: '2026-02-17T23:59:59Z',
      defaultWindowDays: 7,
      candleCount: 3000,
      timezoneHint: 'UTC'
    })

    renderSessionPage()
    await screen.findByText('Session Lock-In')

    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))
    await user.click(screen.getByRole('combobox', { name: /Data source/i }))
    await user.click(await screen.findByRole('option', { name: /CSV upload/i }))
    await user.click(screen.getByRole('combobox', { name: /Dataset/i }))
    await user.click(await screen.findByRole('option', { name: /tv.csv/i }))

    await waitFor(() => {
      expect(backtestApiMock.getBacktestDatasetSummary).toHaveBeenCalledWith('dataset-csv-1')
    })

    expect((screen.getByLabelText(/^From$/i) as HTMLInputElement).value).toBe('2026-02-10')
    expect((screen.getByLabelText(/^To$/i) as HTMLInputElement).value).toBe('2026-02-17')
  })

  it('applies Last 7d preset and auto-reloads candles', async () => {
    const user = userEvent.setup()
    const csvDataset = {
      id: 'dataset-csv-1',
      provider: 'CSV',
      sourceId: 'csv-source-1',
      name: 'tv.csv',
      symbolCanonical: 'EURUSD',
      symbolDisplay: 'EURUSD',
      timeframe: 'M5',
      dataFrom: '2026-02-01T00:00:00Z',
      dataTo: '2026-02-28T23:59:59Z',
      rowCount: 3000,
      warnings: []
    }
    backtestApiMock.listBacktestDatasets.mockResolvedValue([csvDataset])
    backtestApiMock.getBacktestDatasetSummary.mockResolvedValue({
      datasetId: 'dataset-csv-1',
      provider: 'CSV',
      symbolDisplay: 'EURUSD',
      symbolCanonical: 'EURUSD',
      timeframe: 'M5',
      dataFromUtc: '2026-02-01T00:00:00Z',
      dataToUtc: '2026-02-28T23:59:59Z',
      defaultFromUtc: '2026-02-22T00:00:00Z',
      defaultToUtc: '2026-02-28T23:59:59Z',
      defaultWindowDays: 7,
      candleCount: 3000,
      timezoneHint: 'UTC'
    })

    renderSessionPage()
    await screen.findByText('Session Lock-In')
    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))
    await user.click(screen.getByRole('combobox', { name: /Data source/i }))
    await user.click(await screen.findByRole('option', { name: /CSV upload/i }))
    await user.click(screen.getByRole('combobox', { name: /Dataset/i }))
    await user.click(await screen.findByRole('option', { name: /tv.csv/i }))

    await waitFor(() => {
      expect(backtestApiMock.getBacktestDatasetSummary).toHaveBeenCalledWith('dataset-csv-1')
    })

    await user.click(screen.getByRole('button', { name: /Last 7d/i }))
    const fromAfterPreset = (screen.getByLabelText(/^From$/i) as HTMLInputElement).value
    const toAfterPreset = (screen.getByLabelText(/^To$/i) as HTMLInputElement).value
    expect(fromAfterPreset).not.toBe('')
    expect(toAfterPreset).not.toBe('')
    await waitFor(() => {
      expect(backtestApiMock.getBacktestCandles).toHaveBeenCalledWith(expect.objectContaining({
        datasetId: 'dataset-csv-1',
        fromUtc: expect.stringMatching(/T00:00:00/),
        toUtc: expect.stringMatching(/T23:59:59\.999/)
      }))
    })
    expect(screen.getByTestId('backtest-replay-state')).toHaveTextContent('State: READY')
  })

  it('transitions to EMPTY and clears replay data when candles response is empty', async () => {
    const user = userEvent.setup()
    backtestApiMock.getBacktestCandles.mockResolvedValueOnce({
      provider: 'OANDA',
      sourceId: 'source-1',
      symbol: 'OANDA:EURUSD',
      timeframe: 'M1',
      from: '2026-02-01T00:00:00Z',
      to: '2026-02-14T23:59:59Z',
      candleCount: 0,
      count: 0,
      effectiveFromUtc: '2026-02-01T00:00:00Z',
      effectiveToUtc: '2026-02-14T23:59:59Z',
      message: 'No candles returned for selected range.',
      candles: []
    })

    renderSessionPage()
    await screen.findByText('Session Lock-In')
    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))
    await user.click(screen.getByRole('button', { name: /Load data/i }))

    await waitFor(() => {
      expect(backtestApiMock.getBacktestCandles).toHaveBeenCalled()
    })

    expect(screen.getByTestId('backtest-replay-state')).toHaveTextContent('State: EMPTY')
    expect(screen.getByTestId('mock-replay-chart')).toHaveTextContent('replay:0:0')
  })

  it('does not call scrollIntoView while replay is playing', async () => {
    const user = userEvent.setup()
    renderSessionPage()
    await screen.findByText('Session Lock-In')
    await user.click(screen.getByRole('combobox', { name: /^Mode$/i }))
    await user.click(await screen.findByRole('option', { name: 'Backtest' }))
    await user.click(screen.getByRole('button', { name: /Load data/i }))
    await waitFor(() => {
      expect(screen.getByTestId('backtest-replay-state')).toHaveTextContent('State: READY')
    })

    const originalScrollIntoView = Element.prototype.scrollIntoView
    const scrollSpy = vi.fn()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollSpy,
      configurable: true
    })
    await user.click(screen.getByRole('button', { name: /^Play$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-replay-chart')).toHaveTextContent('replay:3:1')
    }, { timeout: 2500 })
    expect(scrollSpy).not.toHaveBeenCalled()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: originalScrollIntoView,
      configurable: true
    })
  }, 30_000)
})

import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LiveWorkspaceResponse, SetupItem } from '../api/liveWorkspace'
import type { DailyPlan } from '../api/plans'
import type { StrategyListResponse } from '../api/strategies'
import { I18nProvider } from '../i18n'
import SessionPage from './SessionPage'

const workspaceApiMock = vi.hoisted(() => ({
  getSessionWorkspace: vi.fn(),
  updateSessionWorkspace: vi.fn(),
  createSetupCandidate: vi.fn(),
  updateSetupCandidate: vi.fn(),
  duplicateSetupCandidate: vi.fn(),
  reorderSetupCandidates: vi.fn(),
  updateSetupCandidateStatus: vi.fn(),
  selectActiveSetupCandidate: vi.fn(),
  startTradeFromSetupCandidate: vi.fn(),
  saveSetupAnalysisNote: vi.fn(),
  upsertSessionPeriodPlan: vi.fn(),
  removeSessionPlan: vi.fn(),
  uploadSessionPlanImages: vi.fn(),
  deleteSessionPlanImage: vi.fn(),
  listSessionPlanImages: vi.fn()
}))

const plansApiMock = vi.hoisted(() => ({
  fetchTodayMentorPlan: vi.fn()
}))

const strategiesApiMock = vi.hoisted(() => ({
  listStrategies: vi.fn()
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      timezone: 'Europe/Bucharest',
      baseCurrency: 'USD'
    }
  })
}))

vi.mock('../api/liveWorkspace', () => workspaceApiMock)
vi.mock('../api/plans', () => plansApiMock)
vi.mock('../api/strategies', () => strategiesApiMock)
vi.mock('../components/charts/TradingViewWidget', () => ({
  default: ({ symbol, interval }: { symbol?: string; interval?: string }) => (
    <div data-testid="mock-chart">{`chart:${symbol || 'none'}:${interval || 'none'}`}</div>
  )
}))

let workspaceState: LiveWorkspaceResponse
let setupSequence = 0

const mentorPlan: DailyPlan = {
  id: 'mentor-1',
  title: 'London model',
  summary: 'Wait for sweep and displacement before execution.',
  biasSummary: 'London long bias',
  keyLevels: ['PDH 1.0825'],
  executionRules: 'Only execute after displacement.',
  alternativeScenario: 'Stand down if reclaim fails.',
  riskNote: 'No red news trades.',
  liquidityNarrative: 'PDH draw into London.',
  tradingViewSymbol: 'OANDA:EURUSD',
  tradingViewInterval: '15'
}

const strategiesList: StrategyListResponse = {
  myStrategies: [
    {
      id: 'strategy-1',
      source: 'MY',
      name: 'London sweep',
      model: 'Sweep into M5 displacement',
      entryConditionsRich: '<ul><li>Sweep PDH</li><li>M5 displacement</li></ul>',
      entryConditions: ['Sweep PDH', 'M5 displacement'],
      invalidationLogic: 'Accepts below PDH.',
      tpFramework: 'Scale at 1R.',
      noTradeRules: 'Skip red news.',
      sessionSuitability: ['London'],
      tags: ['SMC'],
      archived: false
    }
  ],
  mentorStrategies: []
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function makeReadiness(blockers: string[] = []) {
  return {
    score: blockers.length ? 50 : 100,
    state: blockers.length ? 'INCOMPLETE' as const : 'READY' as const,
    summary: blockers.length ? `Missing: ${blockers.join(', ')}` : 'Ready',
    missingItems: blockers,
    blockers,
    steps: [
      { key: 'setup', label: 'Setup', state: blockers.some((item) => ['symbol', 'direction'].includes(item)) ? 'INCOMPLETE' as const : 'READY' as const, summary: 'Setup', missingItems: blockers.filter((item) => ['symbol', 'direction'].includes(item)) },
      { key: 'risk', label: 'Risk', state: blockers.includes('risk configured') ? 'INCOMPLETE' as const : 'READY' as const, summary: 'Risk', missingItems: blockers.filter((item) => item === 'risk configured') },
      { key: 'confluences', label: 'Confluences', state: blockers.some((item) => item !== 'risk configured') ? 'INCOMPLETE' as const : 'READY' as const, summary: 'Confluences', missingItems: blockers.filter((item) => item !== 'risk configured') },
      { key: 'lock', label: 'Lock', state: 'INCOMPLETE' as const, summary: 'Lock', missingItems: ['lock session'] }
    ]
  }
}

function recalcWorkspace() {
  workspaceState.setups = workspaceState.setups.map((setup, index) => {
    const blockers: string[] = []
    if (!setup.symbol) blockers.push('symbol')
    if (setup.direction === 'UNDECIDED') blockers.push('direction')
    ;(setup.confluences || []).forEach((item) => {
      if (item.required && !item.checked && item.label !== 'Risk configured') blockers.push(item.label)
    })
    return {
      ...setup,
      sortOrder: index,
      readiness: makeReadiness(blockers)
    }
  })
  const riskConfigured = Boolean(
    (workspaceState.session.dailyMaxLoss || 0) > 0
    && (workspaceState.session.profitTarget || 0) > 0
    && (workspaceState.session.riskPerTrade || 0) > 0
    && (workspaceState.session.maxTrades || 0) > 0
    && (workspaceState.session.maxConsecutiveLosses || 0) > 0
  )
  const active = workspaceState.setups.find((setup) => setup.id === workspaceState.activeSetupId) || workspaceState.setups[0]
  const sessionBlockers: string[] = []
  if (!active) sessionBlockers.push('at least one setup')
  if (!riskConfigured) sessionBlockers.push('risk configured')
  if (active?.direction === 'UNDECIDED') sessionBlockers.push('direction')
  ;(active?.confluences || []).forEach((item) => {
    if (item.required && !item.checked && item.label !== 'Risk configured') sessionBlockers.push(item.label)
  })
  if (!workspaceState.session.lockedInAt) sessionBlockers.push('lock session')
  workspaceState.session.quickStats = {
    maxLoss: workspaceState.session.dailyMaxLoss,
    profitTarget: workspaceState.session.profitTarget,
    riskUsed: 0,
    realizedPnl: 0,
    remainingRisk: workspaceState.session.dailyMaxLoss || 0,
    tradesTaken: workspaceState.activity.length,
    remainingTrades: workspaceState.session.maxTrades || 0,
    activeSetupCount: workspaceState.setups.length,
    riskConfigured,
    tradingAllowed: riskConfigured,
    maxLossReached: false,
    profitTargetReached: false
  }
  workspaceState.session.readiness = makeReadiness(workspaceState.session.lockedInAt ? [] : sessionBlockers)
}

function buildSetup(symbol: string, direction: SetupItem['direction'], title: string): SetupItem {
  setupSequence += 1
  return {
    id: `setup-${setupSequence}`,
    symbol,
    direction,
    market: 'FOREX',
    tradeSession: null,
    strategyId: null,
    strategyLabel: '',
    setupTitle: title,
    biasAlignment: '',
    status: 'DRAFT',
    linkedTradeId: null,
    analysisNoteId: null,
    readiness: makeReadiness(['direction']),
    context: { narrative: '', liquidityNotes: '', invalidationIdea: '', newsSafety: '', notes: '' },
    strategySnapshot: null,
    trigger: {
      sweepIdentified: false,
      displacementConfirmed: false,
      structureConfirmed: false,
      confirmationModel: '',
      sweepType: '',
      liquiditySource: '',
      confirmationTimeframe: '',
      displacementRule: '',
      structureRule: '',
      fvgRequirement: '',
      entryModel: '',
      entryZone: '',
      rrEstimate: null,
      rrMinimum: null,
      confluenceRequirement: '',
      newsRestriction: '',
      sessionRestriction: '',
      invalidationThreshold: '',
      notes: ''
    },
    execution: {
      activeExecutionId: 'exec-1',
      entryPrice: null,
      stopLossPrice: null,
      takeProfitPrice: null,
      riskAmount: null,
      quantity: null,
      invalidation: '',
      whyWrong: '',
      initialNotes: '',
      tickets: []
    },
    executions: {
      activeExecutionId: 'exec-1',
      tickets: [{
        id: 'exec-1',
        label: 'Execution 1',
        status: 'DRAFT',
        createdAt: '2026-04-06T07:00:00.000Z'
      }]
    },
    review: { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] },
    levels: [],
    mentorReference: null,
    confluences: [
      { id: 'c1', label: 'Sweep confirmed', checked: false, required: true, source: 'CUSTOM' },
      { id: 'c2', label: 'Risk configured', checked: false, required: true, source: 'DEFAULT' }
    ],
    manualSetupMode: true,
    sortOrder: setupSequence - 1,
    createdAt: '2026-04-06T07:00:00.000Z',
    updatedAt: '2026-04-06T07:00:00.000Z'
  }
}

function resetWorkspaceState() {
  setupSequence = 0
  workspaceState = {
    session: {
      id: 'session-1',
      tradingDate: '2026-04-06',
      sessionName: null,
      objective: null,
      bias: null,
      biasReason: null,
      narrative: null,
      dailyMaxLoss: null,
      profitTarget: null,
      riskPerTrade: null,
      maxTrades: null,
      maxConsecutiveLosses: null,
      stopAfterTargetReached: false,
      stopAfterMaxLossReached: true,
      liveModeOnly: true,
      lockedInAt: null,
      status: 'ACTIVE',
      quickStats: {
        maxLoss: null,
        profitTarget: null,
        riskUsed: 0,
        realizedPnl: 0,
        remainingRisk: 0,
        tradesTaken: 0,
        remainingTrades: 0,
        activeSetupCount: 0,
        riskConfigured: false,
        tradingAllowed: false,
        maxLossReached: false,
        profitTargetReached: false
      },
      readiness: makeReadiness(['at least one setup', 'risk configured', 'lock session']),
      warnings: []
    },
    planningContext: {
      monthly: {
        id: 'monthly-1',
        scope: 'MONTHLY',
        title: 'April Plan',
        bias: 'Risk-on month',
        focusSymbols: ['EURUSD'],
        objectives: 'Protect consistency',
        target: 1200,
        maxLoss: 500,
        notes: 'Monthly prep notes',
        reviewIntentions: 'Review execution quality.',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        activeFrom: '2026-04-01T00:00:00+03:00',
        activeTo: '2026-04-30T23:59:59+03:00',
        exists: true
      },
      weekly: {
        id: 'weekly-1',
        scope: 'WEEKLY',
        title: 'Week Plan',
        bias: 'Long EUR',
        focusSymbols: ['EURUSD'],
        objectives: 'Wait for London sweep',
        target: 400,
        maxLoss: 250,
        notes: 'Weekly prep notes',
        reviewIntentions: null,
        periodStart: '2026-04-06',
        periodEnd: '2026-04-12',
        activeFrom: '2026-04-06T00:00:00+03:00',
        activeTo: '2026-04-12T23:59:59+03:00',
        exists: true
      },
      today: {
        id: 'session-1',
        scope: 'DAILY',
        title: 'Today Plan',
        bias: null,
        focusSymbols: [],
        objectives: null,
        target: null,
        maxLoss: null,
        notes: null,
        reviewIntentions: null,
        periodStart: '2026-04-06',
        periodEnd: '2026-04-06',
        exists: true
      }
    },
    activeSetupId: null,
    setups: [],
    activity: []
  }
}

function setupMocks() {
  workspaceApiMock.getSessionWorkspace.mockImplementation(async () => clone(workspaceState))
  plansApiMock.fetchTodayMentorPlan.mockResolvedValue(mentorPlan)
  strategiesApiMock.listStrategies.mockResolvedValue(strategiesList)

  workspaceApiMock.createSetupCandidate.mockImplementation(async (_sessionId: string, payload: Partial<SetupItem>) => {
    const next = buildSetup(payload.symbol || 'EURUSD', payload.direction || 'UNDECIDED', payload.setupTitle || 'Draft setup')
    next.strategySnapshot = payload.strategySnapshot || null
    next.strategyLabel = payload.strategyLabel || next.strategySnapshot?.name || ''
    next.strategyId = payload.strategyId || next.strategySnapshot?.strategyId || null
    next.confluences = payload.confluences || next.confluences
    next.manualSetupMode = payload.manualSetupMode ?? !next.strategySnapshot?.name
    workspaceState.setups.push(next)
    workspaceState.activeSetupId = next.id
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.updateSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string, payload: Partial<SetupItem>) => {
    workspaceState.setups = workspaceState.setups.map((setup) => setup.id === setupId ? {
      ...setup,
      ...payload,
      context: { ...setup.context, ...payload.context },
      trigger: { ...setup.trigger, ...payload.trigger },
      execution: { ...setup.execution, ...payload.execution },
      executions: payload.execution?.tickets ? {
        activeExecutionId: payload.execution.activeExecutionId || setup.executions.activeExecutionId,
        tickets: payload.execution.tickets
      } : setup.executions,
      confluences: payload.confluences || setup.confluences,
      review: payload.review || setup.review
    } : setup)
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.updateSessionWorkspace.mockImplementation(async (_sessionId: string, payload: Partial<LiveWorkspaceResponse['session']> & { lockSession?: boolean | null }) => {
    workspaceState.session = {
      ...workspaceState.session,
      ...payload,
      lockedInAt: payload.lockSession === true ? '2026-04-06T08:00:00.000Z' : payload.lockSession === false ? null : workspaceState.session.lockedInAt
    }
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.selectActiveSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string | null) => {
    workspaceState.activeSetupId = setupId
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.duplicateSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string) => {
    const source = workspaceState.setups.find((setup) => setup.id === setupId)
    if (source) {
      const copy = buildSetup(source.symbol, source.direction, `${source.setupTitle} Copy`)
      workspaceState.setups.push(copy)
      workspaceState.activeSetupId = copy.id
    }
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.updateSetupCandidateStatus.mockImplementation(async () => clone(workspaceState))
  workspaceApiMock.startTradeFromSetupCandidate.mockImplementation(async () => clone(workspaceState))
  workspaceApiMock.saveSetupAnalysisNote.mockImplementation(async (_sessionId: string, setupId: string) => {
    workspaceState.setups = workspaceState.setups.map((setup) => setup.id === setupId ? {
      ...setup,
      analysisNoteId: setup.analysisNoteId || 'note-1',
      review: {
        ...(setup.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }),
        timeline: [
          ...(setup.review?.timeline || []),
          {
            id: 'timeline-note-1',
            type: 'analysis_saved',
            title: 'Analysis saved to Notebook',
            body: 'Session analysis note updated',
            occurredAt: '2026-04-06T08:30:00.000Z'
          }
        ]
      }
    } : setup)
    recalcWorkspace()
    return clone(workspaceState)
  })
  workspaceApiMock.uploadSessionPlanImages.mockResolvedValue([])
  workspaceApiMock.deleteSessionPlanImage.mockResolvedValue(undefined)
  workspaceApiMock.listSessionPlanImages.mockResolvedValue([])
  workspaceApiMock.removeSessionPlan.mockImplementation(async (scope: 'DAILY' | 'WEEKLY' | 'MONTHLY', planId: string) => {
    if (scope === 'DAILY') {
      workspaceState.planningContext!.today = {
        ...workspaceState.planningContext!.today,
        exists: false,
        images: [],
        imageCount: 0
      }
      workspaceState.setups = []
      workspaceState.activeSetupId = null
    }
    if (scope === 'WEEKLY' && workspaceState.planningContext!.weekly.id === planId) {
      workspaceState.planningContext!.weekly = {
        ...workspaceState.planningContext!.weekly,
        id: null,
        exists: false,
        images: [],
        imageCount: 0
      }
    }
    if (scope === 'MONTHLY' && workspaceState.planningContext!.monthly.id === planId) {
      workspaceState.planningContext!.monthly = {
        ...workspaceState.planningContext!.monthly,
        id: null,
        exists: false,
        images: [],
        imageCount: 0
      }
    }
    return clone(workspaceState)
  })
  workspaceApiMock.upsertSessionPeriodPlan.mockImplementation(async (scope: 'DAILY' | 'WEEKLY' | 'MONTHLY', payload: Partial<LiveWorkspaceResponse['planningContext']['weekly']>) => {
    if (scope === 'DAILY') {
      workspaceState.planningContext!.today = {
        ...workspaceState.planningContext!.today,
        exists: true
      }
      if (!workspaceState.setups.length) {
        const restored = buildSetup('EURUSD', 'LONG', 'London reclaim')
        workspaceState.setups.push(restored)
        workspaceState.activeSetupId = restored.id
      }
      recalcWorkspace()
      return clone(workspaceState)
    }
    const key = scope === 'WEEKLY' ? 'weekly' : 'monthly'
    workspaceState.planningContext = {
      ...workspaceState.planningContext!,
      [key]: {
        ...workspaceState.planningContext![key],
        ...payload,
        exists: true
      }
    }
    return clone(workspaceState)
  })
}

function renderWithProviders(ui: JSX.Element) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          {ui}
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SessionPage trader plan workstation', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
  })

  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    resetWorkspaceState()
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders the active planning hierarchy and scope tabs', async () => {
    renderWithProviders(<SessionPage />)

    expect(await screen.findByText('Trader Plan Workstation')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Today Plan' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Weekly Plan' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Monthly Plan' })).toBeInTheDocument()
    expect(screen.getByText('Risk-on month')).toBeInTheDocument()
    expect(screen.getByText('Wait for London sweep')).toBeInTheDocument()
  })

  it('renders the desktop execution workspace with chart left and controls right', async () => {
    workspaceState.setups.push(buildSetup('EURUSD', 'LONG', 'London reclaim'))
    workspaceState.activeSetupId = workspaceState.setups[0].id
    recalcWorkspace()

    renderWithProviders(<SessionPage />)

    expect(await screen.findByTestId('execution-workspace')).toBeInTheDocument()
    expect(within(screen.getByTestId('chart-workspace-column')).getByText('Chart Workspace')).toBeInTheDocument()
    expect(await within(screen.getByTestId('chart-workspace-column')).findByTestId('mock-chart')).toHaveTextContent('chart:OANDA:EURUSD:15')
    expect(within(screen.getByTestId('execution-control-panel')).getByRole('tab', { name: 'Setups' })).toBeInTheDocument()
    expect(within(screen.getByTestId('execution-control-panel')).getByText('London reclaim')).toBeInTheDocument()
  })

  it('creates a setup as undecided, switches setup direction, and drives the chart symbol', async () => {
    renderWithProviders(<SessionPage />)

    fireEvent.click((await screen.findAllByRole('button', { name: /Add setup/i }))[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Symbol'), { target: { value: 'EURUSD' } })
    fireEvent.change(within(dialog).getByLabelText('Setup title'), { target: { value: 'London reclaim' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(workspaceApiMock.createSetupCandidate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ symbol: 'EURUSD', direction: 'UNDECIDED', setupTitle: 'London reclaim' })
    ))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getAllByText(/Not decided yet/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('mock-chart')).toHaveTextContent('chart:OANDA:EURUSD:15')

    fireEvent.click(screen.getByRole('tab', { name: 'Setup' }))
    fireEvent.mouseDown(screen.getByLabelText('Direction'))
    fireEvent.click(await screen.findByRole('option', { name: 'Long' }))

    await waitFor(() => expect(workspaceApiMock.updateSetupCandidate).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ direction: 'LONG' })
    ))
  })

  it('saves non-executed setup analysis into Notebook from the journal tab', async () => {
    workspaceState.setups.push(buildSetup('EURUSD', 'LONG', 'London reclaim'))
    workspaceState.activeSetupId = workspaceState.setups[0].id
    recalcWorkspace()

    renderWithProviders(<SessionPage />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Journal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save analysis note' }))
    await waitFor(() => expect(workspaceApiMock.saveSetupAnalysisNote).toHaveBeenCalledWith('session-1', workspaceState.setups[0].id))
    expect(await screen.findByText('Saved in Notebook')).toBeInTheDocument()
  })

  it('imports a strategy and shows its focused checklist details', async () => {
    workspaceState.setups.push(buildSetup('EURUSD', 'LONG', 'London reclaim'))
    workspaceState.activeSetupId = workspaceState.setups[0].id
    recalcWorkspace()

    renderWithProviders(<SessionPage />)

    fireEvent.click((await screen.findAllByRole('button', { name: 'Import strategy' }))[0])
    expect(await screen.findByText('London sweep')).toBeInTheDocument()
    fireEvent.click(screen.getByText('London sweep'))
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'Strategy' }))
    expect(screen.getAllByText('London sweep').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Confluences' }))
    expect((await screen.findAllByText('Sweep PDH')).length).toBeGreaterThan(0)
    expect(screen.getByText('M5 displacement')).toBeInTheDocument()
  })

  it('configures risk, checks confluences, and enables locking', async () => {
    workspaceState.setups.push(buildSetup('EURUSD', 'LONG', 'London reclaim'))
    workspaceState.activeSetupId = workspaceState.setups[0].id
    recalcWorkspace()

    renderWithProviders(<SessionPage />)

    const lockButton = await screen.findByRole('button', { name: 'Lock session' })
    expect(lockButton).toBeDisabled()

    fireEvent.click(screen.getByRole('tab', { name: 'Risk' }))
    fireEvent.change(screen.getByLabelText('Max loss'), { target: { value: '150' } })
    fireEvent.change(screen.getByLabelText('Profit target'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('Risk per trade'), { target: { value: '75' } })
    fireEvent.change(screen.getByLabelText('Max trades'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Max consecutive losses'), { target: { value: '2' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Confluences' }))
    const sweepRow = screen.getByText('Sweep confirmed').closest('.ws-subpanel') as HTMLElement
    fireEvent.click(within(sweepRow).getAllByRole('checkbox')[0])

    await waitFor(() => expect(workspaceApiMock.updateSessionWorkspace).toHaveBeenCalled())
    await waitFor(() => expect(workspaceApiMock.updateSetupCandidate).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lock session' })).not.toBeDisabled(), { timeout: 5000 })

    fireEvent.click(screen.getByRole('button', { name: 'Lock session' }))
    await waitFor(() => expect(workspaceApiMock.updateSessionWorkspace).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ lockSession: true })
    ))
  })

  it('saves weekly and monthly plans from their active tabs', async () => {
    renderWithProviders(<SessionPage />)

    fireEvent.click(await screen.findByRole('tab', { name: 'Weekly Plan' }))
    fireEvent.change(screen.getByLabelText('Weekly bias'), { target: { value: 'Short dollar week' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() => expect(workspaceApiMock.upsertSessionPeriodPlan).toHaveBeenCalledWith(
      'WEEKLY',
      expect.objectContaining({ bias: 'Short dollar week' })
    ))

    fireEvent.click(screen.getByRole('tab', { name: 'Monthly Plan' }))
    fireEvent.change(screen.getByLabelText('Monthly bias/context'), { target: { value: 'April continuation context' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }))

    await waitFor(() => expect(workspaceApiMock.upsertSessionPeriodPlan).toHaveBeenCalledWith(
      'MONTHLY',
      expect.objectContaining({ bias: 'April continuation context' })
    ))
  })

  it('confirms and removes the active Today Plan from Session Mode', async () => {
    workspaceState.setups.push(buildSetup('EURUSD', 'LONG', 'London reclaim'))
    workspaceState.activeSetupId = workspaceState.setups[0].id
    recalcWorkspace()

    renderWithProviders(<SessionPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove plan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove plan' })
    expect(within(dialog).getByText('Remove this Today Plan? It will no longer appear on this calendar day or in Session Mode.')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove plan' }))

    await waitFor(() => expect(workspaceApiMock.removeSessionPlan).toHaveBeenCalledWith('DAILY', 'session-1'))
    expect((await screen.findAllByText('No active Today Plan')).length).toBeGreaterThan(0)
    expect(screen.queryByText('London reclaim')).not.toBeInTheDocument()
  })

  it('shows and restores a removed Today Plan from Session Mode', async () => {
    workspaceState.planningContext!.today = {
      ...workspaceState.planningContext!.today,
      exists: false,
      images: [],
      imageCount: 0
    }
    workspaceState.setups = []
    workspaceState.activeSetupId = null

    renderWithProviders(<SessionPage />)

    expect((await screen.findAllByText('No active Today Plan')).length).toBeGreaterThan(0)
    expect(screen.getByText('The removed plan is hidden from Session Mode and Calendar. Restore it to continue planning today.')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Restore Today Plan' })[0])

    await waitFor(() => expect(workspaceApiMock.upsertSessionPeriodPlan).toHaveBeenCalledWith('DAILY', {}))
    expect((await screen.findAllByText('London reclaim')).length).toBeGreaterThan(0)
    expect(screen.getByText('Active today plan')).toBeInTheDocument()
  })

  it('shows create Today Plan when no active daily plan id is present', async () => {
    workspaceState.planningContext!.today = {
      ...workspaceState.planningContext!.today,
      id: null,
      exists: false,
      images: [],
      imageCount: 0
    }
    workspaceState.setups = []
    workspaceState.activeSetupId = null

    renderWithProviders(<SessionPage />)

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Create Today Plan' }).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: 'Create Today Plan' })[0])

    await waitFor(() => expect(workspaceApiMock.upsertSessionPeriodPlan).toHaveBeenCalledWith('DAILY', {}))
    expect(await screen.findByText('Active today plan')).toBeInTheDocument()
  })
})

import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyPlan } from '../api/plans'
import type {
  ExecutionTicket,
  LiveWorkspaceResponse,
  SetupItem,
  SetupStatus,
  SetupStrategySnapshot
} from '../api/liveWorkspace'
import type { StrategyListResponse } from '../api/strategies'
import SessionPage from './SessionPage'
import { I18nProvider, useI18n } from '../i18n'

const workspaceApiMock = vi.hoisted(() => ({
  getSessionWorkspace: vi.fn(),
  updateSessionWorkspace: vi.fn(),
  createSetupCandidate: vi.fn(),
  updateSetupCandidate: vi.fn(),
  duplicateSetupCandidate: vi.fn(),
  reorderSetupCandidates: vi.fn(),
  updateSetupCandidateStatus: vi.fn(),
  selectActiveSetupCandidate: vi.fn(),
  startTradeFromSetupCandidate: vi.fn()
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
  keyLevels: ['PDH 1.0825', 'Asia low 1.0790'],
  executionRules: 'Only execute after displacement and structure confirmation.',
  alternativeScenario: 'Stand down if the sweep does not reclaim.',
  riskNote: 'No trade inside major news.',
  liquidityNarrative: 'PDH draw into London reversal window.',
  tradingViewSymbol: 'OANDA:EURUSD',
  tradingViewInterval: '15',
  updatedAt: '2026-03-06T07:00:00.000Z'
}

const strategiesList: StrategyListResponse = {
  myStrategies: [
    {
      id: 'strategy-1',
      source: 'MY',
      name: 'London sweep',
      model: 'Sweep into M5 displacement',
      entryConditionsRich: '<ul><li>Sweep PDH</li><li>M5 displacement</li><li>M1 FVG reclaim</li></ul>',
      entryConditions: ['Sweep PDH', 'M5 displacement', 'M1 FVG reclaim'],
      invalidationLogic: 'Accepts back below PDH.',
      tpFramework: 'Scale at 1R, runner to ADR midpoint.',
      noTradeRules: 'Skip during red news.',
      sessionSuitability: ['London'],
      tags: ['SMC', 'London'],
      snapshotAssetId: null,
      snapshotAsset: null,
      archived: false,
      updatedAt: '2026-03-05T10:00:00.000Z'
    }
  ],
  mentorStrategies: []
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function makeReadiness(score: number, blockers: string[] = []) {
  return {
    score,
    state: blockers.length ? 'INCOMPLETE' as const : 'READY' as const,
    summary: blockers.length ? `Missing: ${blockers.join(', ')}` : 'Ready to execute.',
    missingItems: blockers,
    blockers,
    steps: [
      { key: 'context', label: 'Context', state: blockers.some((item) => ['key liquidity idea', 'invalidation concept'].includes(item)) ? 'INCOMPLETE' : 'READY', summary: blockers.length ? blockers.join(', ') : 'Ready', missingItems: blockers },
      { key: 'trigger', label: 'Trigger', state: blockers.some((item) => ['sweep', 'displacement', 'structure confirmation', 'confirmation model', 'entry zone', 'RR >= 1.5'].includes(item)) ? 'INCOMPLETE' : 'READY', summary: blockers.length ? blockers.join(', ') : 'Ready', missingItems: blockers },
      { key: 'execution', label: 'Execution', state: blockers.some((item) => ['entry', 'stop loss', 'take profit', 'risk amount or quantity', 'invalidation', 'session lock-in'].includes(item)) ? 'INCOMPLETE' : 'READY', summary: blockers.length ? blockers.join(', ') : 'Ready', missingItems: blockers }
    ]
  }
}

function makeTicket(index = 0): ExecutionTicket {
  return {
    id: `exec-${setupSequence + 1}-${index + 1}`,
    label: `Execution ${index + 1}`,
    status: 'DRAFT',
    entryPrice: null,
    stopLossPrice: null,
    takeProfitPrice: null,
    riskAmount: null,
    quantity: null,
    invalidation: '',
    whyWrong: '',
    initialNotes: '',
    notes: '',
    linkedTradeId: null,
    createdAt: '2026-03-06T07:00:00.000Z',
    updatedAt: null,
    startedAt: null,
    closedAt: null
  }
}

function ensureSetupShape(setup: SetupItem): SetupItem {
  const tickets = setup.executions?.tickets?.length
    ? setup.executions.tickets
    : setup.execution?.tickets?.length
      ? setup.execution.tickets
      : [makeTicket(0)]
  const activeExecutionId = setup.executions?.activeExecutionId || setup.execution.activeExecutionId || tickets[0].id
  const active = tickets.find((ticket) => ticket.id === activeExecutionId) || tickets[0]
  return {
    ...setup,
    strategySnapshot: setup.strategySnapshot || null,
    review: setup.review || {
      liveNotes: '',
      mistakes: '',
      lessons: '',
      outcomeSummary: '',
      tags: [],
      timeline: []
    },
    execution: {
      activeExecutionId,
      entryPrice: active.entryPrice,
      stopLossPrice: active.stopLossPrice,
      takeProfitPrice: active.takeProfitPrice,
      riskAmount: active.riskAmount,
      quantity: active.quantity,
      invalidation: active.invalidation,
      whyWrong: active.whyWrong,
      initialNotes: active.initialNotes,
      tickets
    },
    executions: {
      activeExecutionId,
      tickets
    }
  }
}

function recalcSetup(setup: SetupItem, locked: boolean): SetupItem {
  const normalized = ensureSetupShape(setup)
  const active = normalized.executions.tickets.find((ticket) => ticket.id === normalized.executions.activeExecutionId) || normalized.executions.tickets[0]
  const blockers: string[] = []
  if (!normalized.context.liquidityNotes && normalized.levels.length === 0) blockers.push('key liquidity idea')
  if (!normalized.context.invalidationIdea && !active.invalidation) blockers.push('invalidation concept')
  if (!normalized.trigger.sweepIdentified) blockers.push('sweep')
  if (!normalized.trigger.displacementConfirmed) blockers.push('displacement')
  if (!normalized.trigger.structureConfirmed) blockers.push('structure confirmation')
  if (!normalized.trigger.confirmationModel) blockers.push('confirmation model')
  if (!normalized.trigger.entryZone) blockers.push('entry zone')
  if ((normalized.trigger.rrEstimate ?? 0) < 1.5) blockers.push('RR >= 1.5')
  if (active.entryPrice == null) blockers.push('entry')
  if (active.stopLossPrice == null) blockers.push('stop loss')
  if (active.takeProfitPrice == null) blockers.push('take profit')
  if (active.riskAmount == null && active.quantity == null) blockers.push('risk amount or quantity')
  if (!active.invalidation && !normalized.context.invalidationIdea) blockers.push('invalidation')
  if (!locked) blockers.push('session lock-in')

  const score = Math.max(12, 100 - blockers.length * 7)
  return {
    ...normalized,
    readiness: makeReadiness(score, blockers)
  }
}

function buildSetup(symbol: string, direction: 'LONG' | 'SHORT', setupTitle: string): SetupItem {
  setupSequence += 1
  return recalcSetup({
    id: `setup-${setupSequence}`,
    symbol,
    direction,
    market: 'FOREX',
    tradeSession: 'LONDON',
    strategyId: null,
    strategyLabel: '',
    setupTitle,
    biasAlignment: '',
    status: 'DRAFT',
    linkedTradeId: null,
    readiness: makeReadiness(20, ['key liquidity idea']),
    context: {
      narrative: '',
      liquidityNotes: '',
      invalidationIdea: '',
      newsSafety: '',
      notes: ''
    },
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
      activeExecutionId: null,
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
      activeExecutionId: null,
      tickets: []
    },
    review: {
      liveNotes: '',
      mistakes: '',
      lessons: '',
      outcomeSummary: '',
      tags: [],
      timeline: []
    },
    levels: [],
    mentorReference: null,
    sortOrder: setupSequence - 1,
    createdAt: '2026-03-06T07:00:00.000Z',
    updatedAt: '2026-03-06T07:00:00.000Z'
  }, Boolean(workspaceState?.session?.lockedInAt))
}

function recalcWorkspace() {
  workspaceState.setups = workspaceState.setups.map((setup, index) => ({
    ...recalcSetup(setup, Boolean(workspaceState.session.lockedInAt)),
    sortOrder: index
  }))
  workspaceState.session.quickStats = {
    maxLoss: workspaceState.session.dailyMaxLoss,
    riskUsed: workspaceState.activity.reduce((total, trade) => total + (trade.riskAmount || 0), 0),
    tradesTaken: workspaceState.activity.length,
    activeSetupCount: workspaceState.setups.filter((setup) => !['SKIPPED', 'ARCHIVED', 'INVALIDATED', 'EXECUTED', 'CLOSED'].includes(setup.status)).length,
    realizedPnl: workspaceState.activity.reduce((total, trade) => total + (trade.pnlNet || 0), 0)
  }
  const sessionBlockers = workspaceState.session.lockedInAt ? [] : ['lock session']
  workspaceState.session.readiness = {
    score: workspaceState.session.lockedInAt ? 100 : 75,
    state: workspaceState.session.lockedInAt ? 'READY' : 'INCOMPLETE',
    summary: sessionBlockers.length ? 'Missing: lock session' : 'Session is locked and ready for live execution.',
    missingItems: sessionBlockers,
    blockers: sessionBlockers,
    steps: [
      { key: 'plan', label: 'Plan', state: 'READY', summary: 'Ready', missingItems: [] },
      { key: 'risk', label: 'Risk', state: 'READY', summary: 'Ready', missingItems: [] },
      { key: 'narrative', label: 'Narrative', state: 'READY', summary: 'Ready', missingItems: [] },
      { key: 'lock', label: 'Lock-in', state: workspaceState.session.lockedInAt ? 'READY' : 'INCOMPLETE', summary: sessionBlockers.length ? 'Missing: lock session' : 'Ready', missingItems: sessionBlockers }
    ]
  }
  workspaceState.session.warnings = workspaceState.session.lockedInAt ? [] : ['Session is not locked']
}

function resetWorkspaceState() {
  setupSequence = 0
  workspaceState = {
    session: {
      id: 'session-1',
      tradingDate: '2026-03-06',
      sessionName: 'LONDON',
      objective: 'A_PLUS_ONLY',
      bias: 'LONG',
      biasReason: 'PDH draw is intact',
      narrative: 'London wants the sweep and reclaim.',
      dailyMaxLoss: 150,
      maxTrades: 2,
      liveModeOnly: true,
      lockedInAt: null,
      status: 'ACTIVE',
      quickStats: {
        maxLoss: 150,
        riskUsed: 0,
        tradesTaken: 0,
        activeSetupCount: 0,
        realizedPnl: 0
      },
      readiness: {
        score: 75,
        state: 'INCOMPLETE',
        summary: 'Missing: lock session',
        missingItems: ['lock session'],
        blockers: ['lock session'],
        steps: [
          { key: 'plan', label: 'Plan', state: 'READY', summary: 'Ready', missingItems: [] },
          { key: 'risk', label: 'Risk', state: 'READY', summary: 'Ready', missingItems: [] },
          { key: 'narrative', label: 'Narrative', state: 'READY', summary: 'Ready', missingItems: [] },
          { key: 'lock', label: 'Lock-in', state: 'INCOMPLETE', summary: 'Missing: lock session', missingItems: ['lock session'] }
        ]
      },
      warnings: ['Session is not locked']
    },
    activeSetupId: null,
    setups: [],
    activity: []
  }
}

function setupMocks() {
  workspaceApiMock.getSessionWorkspace.mockImplementation(async () => clone(workspaceState))
  strategiesApiMock.listStrategies.mockResolvedValue(strategiesList)
  plansApiMock.fetchTodayMentorPlan.mockResolvedValue(mentorPlan)

  workspaceApiMock.createSetupCandidate.mockImplementation(async (_sessionId: string, payload: { symbol?: string; direction?: 'LONG' | 'SHORT'; setupTitle?: string; strategySnapshot?: SetupStrategySnapshot | null }) => {
    const nextSetup = buildSetup(payload.symbol || 'EURUSD', payload.direction || 'LONG', payload.setupTitle || 'Draft setup')
    if (payload.strategySnapshot) {
      nextSetup.strategySnapshot = payload.strategySnapshot
      nextSetup.strategyLabel = payload.strategySnapshot.name || ''
      nextSetup.strategyId = payload.strategySnapshot.strategyId || null
    }
    workspaceState.setups.push(nextSetup)
    workspaceState.activeSetupId = nextSetup.id
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.selectActiveSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string | null) => {
    workspaceState.activeSetupId = setupId
    return clone(workspaceState)
  })

  workspaceApiMock.updateSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string, payload: Partial<SetupItem> & { execution?: { tickets?: ExecutionTicket[] } }) => {
    workspaceState.setups = workspaceState.setups.map((setup) => {
      if (setup.id !== setupId) return setup
      const next = ensureSetupShape({
        ...setup,
        ...payload,
        context: { ...setup.context, ...payload.context },
        strategySnapshot: payload.strategySnapshot ?? setup.strategySnapshot,
        trigger: { ...setup.trigger, ...payload.trigger },
        execution: {
          ...setup.execution,
          ...payload.execution,
          tickets: payload.execution?.tickets || setup.executions.tickets
        },
        executions: {
          activeExecutionId: payload.execution?.activeExecutionId || setup.executions.activeExecutionId,
          tickets: payload.execution?.tickets || setup.executions.tickets
        },
        review: payload.review ? {
          ...setup.review,
          ...payload.review,
          timeline: payload.review.timeline || setup.review?.timeline || []
        } : setup.review,
        levels: payload.levels || setup.levels,
        mentorReference: payload.mentorReference ?? setup.mentorReference
      })
      return recalcSetup(next, Boolean(workspaceState.session.lockedInAt))
    })
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.duplicateSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string) => {
    const source = workspaceState.setups.find((setup) => setup.id === setupId)
    if (!source) return clone(workspaceState)
    const nextSetup = buildSetup(source.symbol, source.direction, `${source.setupTitle} Copy`)
    nextSetup.strategySnapshot = source.strategySnapshot
    nextSetup.strategyId = source.strategyId
    nextSetup.strategyLabel = source.strategyLabel
    workspaceState.setups.push(nextSetup)
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.updateSetupCandidateStatus.mockImplementation(async (_sessionId: string, setupId: string, status: SetupStatus) => {
    workspaceState.setups = workspaceState.setups.map((setup) => (
      setup.id === setupId ? { ...setup, status } : setup
    ))
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.updateSessionWorkspace.mockImplementation(async (_sessionId: string, payload: { lockSession?: boolean | null }) => {
    if (payload.lockSession === true) {
      workspaceState.session.lockedInAt = '2026-03-06T07:05:00.000Z'
    } else if (payload.lockSession === false) {
      workspaceState.session.lockedInAt = null
    }
    recalcWorkspace()
    return clone(workspaceState)
  })

  workspaceApiMock.startTradeFromSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string, executionId?: string | null) => {
    const setup = workspaceState.setups.find((item) => item.id === setupId)
    if (!setup) return clone(workspaceState)
    const activeExecutionId = executionId || setup.executions.activeExecutionId || setup.executions.tickets[0].id
    const activeTicket = setup.executions.tickets.find((item) => item.id === activeExecutionId) || setup.executions.tickets[0]
    workspaceState.setups = workspaceState.setups.map((item) => {
      if (item.id !== setupId) return item
      const tickets = item.executions.tickets.map((ticket) => (
        ticket.id === activeExecutionId
          ? {
            ...ticket,
            status: 'ACTIVE' as const,
            linkedTradeId: 'trade-1',
            startedAt: '2026-03-06T07:10:00.000Z'
          }
          : ticket
      ))
      return ensureSetupShape({
        ...item,
        status: 'EXECUTED',
        linkedTradeId: 'trade-1',
        review: {
          ...(item.review || { tags: [], timeline: [] }),
          timeline: [
            ...((item.review?.timeline || [])),
            {
              id: 'timeline-started',
              type: 'execution_started',
              title: 'Execution started',
              body: activeTicket.label,
              executionId: activeExecutionId,
              tradeId: 'trade-1',
              occurredAt: '2026-03-06T07:10:00.000Z'
            }
          ]
        },
        executions: {
          activeExecutionId,
          tickets
        },
        execution: {
          ...item.execution,
          activeExecutionId,
          tickets
        }
      })
    })
    workspaceState.activity = [{
      tradeId: 'trade-1',
      setupId,
      setupTitle: setup.setupTitle,
      symbol: setup.symbol,
      direction: setup.direction,
      tradeSession: setup.tradeSession,
      status: 'OPEN',
      entryPrice: activeTicket.entryPrice,
      exitPrice: null,
      riskAmount: activeTicket.riskAmount,
      rMultiple: null,
      pnlNet: 0,
      openedAt: '2026-03-06T07:10:00.000Z',
      closedAt: null
    }]
    recalcWorkspace()
    return clone(workspaceState)
  })
}

function LanguageSetter({ language }: { language: 'en' | 'ro' }) {
  const { setLanguage } = useI18n()

  useEffect(() => {
    setLanguage(language)
  }, [language, setLanguage])

  return null
}

function renderWithProviders(ui: JSX.Element, language?: 'en' | 'ro') {
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
          {language ? <LanguageSetter language={language} /> : null}
          {ui}
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SessionPage workstation', () => {
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

  it('handles strategy import, multi-setup navigation, execution cloning, and trade start', async () => {
    renderWithProviders(<SessionPage />)

    expect(await screen.findByText('Persistent chart')).toBeInTheDocument()

    for (const draft of [
      { symbol: 'GBPUSD', direction: 'SHORT' as const, setupTitle: 'Cable fade' },
      { symbol: 'DAX', direction: 'LONG' as const, setupTitle: 'DAX continuation' },
      { symbol: 'EURUSD', direction: 'LONG' as const, setupTitle: 'London sweep reclaim' }
    ]) {
      fireEvent.click(screen.getAllByRole('button', { name: /Add setup/i })[0])
      const dialog = await screen.findByRole('dialog')
      fireEvent.change(within(dialog).getByLabelText('Symbol'), { target: { value: draft.symbol } })
      fireEvent.mouseDown(within(dialog).getByLabelText('Direction'))
      fireEvent.click(await screen.findByRole('option', { name: draft.direction === 'LONG' ? 'Long' : 'Short' }))
      fireEvent.change(within(dialog).getByLabelText('Setup title'), { target: { value: draft.setupTitle } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(workspaceApiMock.createSetupCandidate).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[2])
    expect(screen.getByTestId('mock-chart')).toHaveTextContent('chart:OANDA:EURUSD:15')

    fireEvent.click(screen.getAllByRole('button', { name: 'Import strategy' })[0])
    expect(await screen.findByText('London sweep')).toBeInTheDocument()
    fireEvent.click(screen.getByText('London sweep'))
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(screen.getByText(/Imported from:/)).toBeInTheDocument())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText((_, element) => element?.textContent === 'Imported from: London sweep')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Triggers' }))
    fireEvent.click(screen.getByLabelText('Sweep identified'))
    fireEvent.click(screen.getByLabelText('Displacement confirmed'))
    fireEvent.click(screen.getByLabelText('MSS / structure confirmed'))
    fireEvent.change(screen.getByLabelText('Confirmation model'), { target: { value: 'M5 displacement into M1 confirmation' } })
    fireEvent.change(screen.getByLabelText('Entry zone'), { target: { value: 'M1 FVG reclaim' } })
    fireEvent.change(screen.getByLabelText('RR estimate'), { target: { value: '2.0' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }))
    fireEvent.change(screen.getByLabelText('Liquidity / key levels'), { target: { value: 'PDH sweep into London opening range' } })
    fireEvent.change(screen.getByLabelText('Invalidation idea'), { target: { value: 'If the reclaim fails and price accepts below PDH.' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Executions' }))
    fireEvent.change(screen.getByLabelText('Entry'), { target: { value: '1.0812' } })
    fireEvent.change(screen.getByLabelText('Stop loss'), { target: { value: '1.0798' } })
    fireEvent.change(screen.getByLabelText('Take profit'), { target: { value: '1.0844' } })
    fireEvent.change(screen.getByLabelText('Risk amount'), { target: { value: '75' } })
    fireEvent.change(screen.getByLabelText('Execution invalidation'), { target: { value: 'Close below the reclaimed London range low.' } })
    fireEvent.change(screen.getByLabelText('Initial notes'), { target: { value: 'Execute only if spread stays clean through the reclaim.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clone execution' }))
    await waitFor(() => expect(screen.getAllByText('Execution 1 Copy').length).toBeGreaterThan(0))
    const setupSaveCallCount = workspaceApiMock.updateSetupCandidate.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Save execution' }))
    await waitFor(() => expect(workspaceApiMock.updateSetupCandidate.mock.calls.length).toBeGreaterThan(setupSaveCallCount))

    fireEvent.click(screen.getAllByRole('button', { name: 'Lock session' })[0])
    await waitFor(() => expect(workspaceApiMock.updateSessionWorkspace).toHaveBeenCalled())

    let startTradeButton: HTMLElement | undefined
    await waitFor(() => {
      startTradeButton = screen.getAllByRole('button', { name: 'Start trade' }).find((button) => !button.hasAttribute('disabled'))
      expect(startTradeButton).toBeDefined()
    }, { timeout: 5000 })
    fireEvent.click(startTradeButton as HTMLElement)
    await waitFor(() => expect(workspaceApiMock.startTradeFromSetupCandidate).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('tab', { name: 'Review' }))
    await waitFor(() => expect(screen.getAllByText('Execution started').length).toBeGreaterThan(0))
    expect(screen.getAllByText('London sweep reclaim').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1])
    await waitFor(() => expect(screen.getByTestId('mock-chart')).toHaveTextContent('chart:DAX:15'))
  }, 30000)

  it('renders the workstation labels in Romanian', async () => {
    renderWithProviders(<SessionPage />, 'ro')

    expect(await screen.findByText('Importă strategie')).toBeInTheDocument()
    expect(screen.getByText('Bandă referință')).toBeInTheDocument()
    expect(screen.getByText('Bandă editabilă de execuție')).toBeInTheDocument()
  })
})

import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyPlan } from '../api/plans'
import type { LiveDiagnosticsSummaryResponse } from '../api/diagnostics'
import type { LiveWorkspaceResponse, SetupItem, SetupStatus } from '../api/liveWorkspace'
import DiagnosticsPage from './DiagnosticsPage'
import SessionPage from './SessionPage'
import { I18nProvider } from '../i18n'

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

const diagnosticsApiMock = vi.hoisted(() => ({
  getLiveDiagnosticsSummary: vi.fn()
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
vi.mock('../api/diagnostics', () => diagnosticsApiMock)
vi.mock('../components/charts/TradingViewWidget', () => ({
  default: ({ symbol, interval }: { symbol?: string; interval?: string }) => (
    <div data-testid="mock-chart">{`chart:${symbol || 'none'}:${interval || 'none'}`}</div>
  )
}))

let workspaceState: LiveWorkspaceResponse
let tradeExecuted = false
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function makeReadiness(score: number, state: 'READY' | 'INCOMPLETE' | 'BLOCKED', blockers: string[] = []) {
  const summary = blockers.length ? `Missing: ${blockers.join(', ')}` : 'Ready to execute.'
  return {
    score,
    state,
    summary,
    missingItems: blockers,
    blockers,
    steps: [
      { key: 'context', label: 'Context', state: blockers.some((item) => ['key liquidity idea', 'invalidation concept'].includes(item)) ? 'INCOMPLETE' : 'READY', summary, missingItems: blockers },
      { key: 'trigger', label: 'Trigger', state: blockers.some((item) => ['sweep', 'displacement', 'structure confirmation', 'confirmation model', 'entry zone', 'RR >= 1.5'].includes(item)) ? 'INCOMPLETE' : 'READY', summary, missingItems: blockers },
      { key: 'execution', label: 'Execution', state: blockers.some((item) => ['entry', 'stop loss', 'take profit', 'risk amount or quantity', 'invalidation', 'session lock-in'].includes(item)) ? 'INCOMPLETE' : 'READY', summary, missingItems: blockers }
    ]
  }
}

function recalcSetup(setup: SetupItem, locked: boolean): SetupItem {
  const blockers: string[] = []
  if (!setup.context.liquidityNotes && setup.levels.length === 0) blockers.push('key liquidity idea')
  if (!setup.context.invalidationIdea && !setup.execution.invalidation) blockers.push('invalidation concept')
  if (!setup.trigger.sweepIdentified) blockers.push('sweep')
  if (!setup.trigger.displacementConfirmed) blockers.push('displacement')
  if (!setup.trigger.structureConfirmed) blockers.push('structure confirmation')
  if (!setup.trigger.confirmationModel) blockers.push('confirmation model')
  if (!setup.trigger.entryZone) blockers.push('entry zone')
  if ((setup.trigger.rrEstimate ?? 0) < 1.5) blockers.push('RR >= 1.5')
  if (setup.execution.entryPrice == null) blockers.push('entry')
  if (setup.execution.stopLossPrice == null) blockers.push('stop loss')
  if (setup.execution.takeProfitPrice == null) blockers.push('take profit')
  if (setup.execution.riskAmount == null && setup.execution.quantity == null) blockers.push('risk amount or quantity')
  if (!setup.execution.invalidation && !setup.context.invalidationIdea) blockers.push('invalidation')
  if (!locked) blockers.push('session lock-in')

  const score = Math.max(15, 100 - blockers.length * 7)
  return {
    ...setup,
    readiness: makeReadiness(score, blockers.length ? 'INCOMPLETE' : 'READY', blockers)
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
    readiness: makeReadiness(20, 'INCOMPLETE', ['key liquidity idea']),
    context: {
      narrative: '',
      liquidityNotes: '',
      invalidationIdea: '',
      newsSafety: '',
      notes: ''
    },
    trigger: {
      sweepIdentified: false,
      displacementConfirmed: false,
      structureConfirmed: false,
      confirmationModel: '',
      entryZone: '',
      rrEstimate: null,
      notes: ''
    },
    execution: {
      entryPrice: null,
      stopLossPrice: null,
      takeProfitPrice: null,
      riskAmount: null,
      quantity: null,
      invalidation: '',
      whyWrong: '',
      initialNotes: ''
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
  tradeExecuted = false
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
  workspaceApiMock.createSetupCandidate.mockImplementation(async (_sessionId: string, payload: { symbol?: string | null; direction?: 'LONG' | 'SHORT' | null; setupTitle?: string | null }) => {
    const nextSetup = buildSetup(payload.symbol || 'EURUSD', payload.direction || 'LONG', payload.setupTitle || 'Draft setup')
    workspaceState.setups.push(nextSetup)
    workspaceState.activeSetupId = nextSetup.id
    recalcWorkspace()
    return clone(workspaceState)
  })
  workspaceApiMock.selectActiveSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string | null) => {
    workspaceState.activeSetupId = setupId
    return clone(workspaceState)
  })
  workspaceApiMock.updateSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string, payload: Partial<SetupItem>) => {
    workspaceState.setups = workspaceState.setups.map((setup) => (
      setup.id === setupId
        ? recalcSetup({
          ...setup,
          ...payload,
          context: { ...setup.context, ...payload.context },
          trigger: { ...setup.trigger, ...payload.trigger },
          execution: { ...setup.execution, ...payload.execution },
          levels: payload.levels || setup.levels,
          mentorReference: payload.mentorReference || setup.mentorReference
        }, Boolean(workspaceState.session.lockedInAt))
        : setup
    ))
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
  workspaceApiMock.duplicateSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string) => {
    const source = workspaceState.setups.find((setup) => setup.id === setupId)
    if (!source) return clone(workspaceState)
    const nextSetup = buildSetup(source.symbol, source.direction, `${source.setupTitle} Copy`)
    workspaceState.setups.push(nextSetup)
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
  workspaceApiMock.startTradeFromSetupCandidate.mockImplementation(async (_sessionId: string, setupId: string) => {
    const setup = workspaceState.setups.find((item) => item.id === setupId)
    if (!setup) return clone(workspaceState)
    tradeExecuted = true
    workspaceState.setups = workspaceState.setups.map((item) => (
      item.id === setupId ? { ...item, status: 'EXECUTED', linkedTradeId: 'trade-1' } : item
    ))
    workspaceState.activity = [{
      tradeId: 'trade-1',
      setupId,
      setupTitle: setup.setupTitle,
      symbol: setup.symbol,
      direction: setup.direction,
      tradeSession: setup.tradeSession,
      status: 'OPEN',
      entryPrice: setup.execution.entryPrice,
      exitPrice: null,
      riskAmount: setup.execution.riskAmount,
      rMultiple: null,
      pnlNet: 0,
      openedAt: '2026-03-06T07:10:00.000Z',
      closedAt: null
    }]
    recalcWorkspace()
    return clone(workspaceState)
  })
  plansApiMock.fetchTodayMentorPlan.mockResolvedValue(mentorPlan)
  diagnosticsApiMock.getLiveDiagnosticsSummary.mockImplementation(async (): Promise<LiveDiagnosticsSummaryResponse> => ({
    coreMetrics: {
      sampleSize: tradeExecuted ? 1 : 0,
      winRate: tradeExecuted ? 100 : 0,
      expectancyR: tradeExecuted ? 1.8 : 0,
      profitFactor: tradeExecuted ? 2.1 : 0,
      avgMaeR: tradeExecuted ? 0.3 : 0,
      avgMfeR: tradeExecuted ? 2.2 : 0,
      avgDurationMinutes: 35
    },
    breakdownBySession: tradeExecuted ? [{ key: 'LONDON', sampleSize: 1, winRate: 100, expectancyR: 1.8 }] : [],
    breakdownBySymbol: tradeExecuted ? [{ key: 'EURUSD', sampleSize: 1, winRate: 100, expectancyR: 1.8 }] : [],
    breakdownByDayOfWeek: tradeExecuted ? [{ key: 'FRIDAY', sampleSize: 1, winRate: 100, expectancyR: 1.8 }] : [],
    strategyPerformance: tradeExecuted ? [{
      strategyId: 'strategy-1',
      strategyName: 'London sweep',
      sampleSize: 1,
      winRate: 100,
      expectancyR: 1.8,
      profitFactor: 2.1
    }] : [],
    failureModes: [],
    suggestions: tradeExecuted ? [{ title: 'Keep London sweep tight', description: 'Live performance is healthy when the trigger sequence is respected.' }] : [],
    generatedAt: '2026-03-06T08:00:00.000Z'
  }))
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
        <I18nProvider>{ui}</I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SessionPage live workspace', () => {
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

  it('handles the multi-setup live trading workflow end to end', async () => {
    const sessionView = renderWithProviders(<SessionPage />)

    expect(await screen.findByText('Chart workspace')).toBeInTheDocument()

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

    expect(await screen.findByText('Cable fade')).toBeInTheDocument()
    expect(screen.getByText('DAX continuation')).toBeInTheDocument()
    expect(screen.getByText('London sweep reclaim')).toBeInTheDocument()

    const reclaimCard = screen.getByText('London sweep reclaim').closest('.MuiCard-root') as HTMLElement
    fireEvent.click(within(reclaimCard).getByRole('button', { name: 'Edit' }))

    fireEvent.change(screen.getByLabelText('Liquidity / key levels'), { target: { value: 'PDH sweep into London opening range' } })
    fireEvent.change(screen.getByLabelText('Invalidation idea'), { target: { value: 'If the reclaim fails and price accepts below PDH.' } })
    fireEvent.click(screen.getByLabelText('Sweep identified'))
    fireEvent.click(screen.getByLabelText('Displacement confirmed'))
    fireEvent.click(screen.getByLabelText('MSS / structure confirmed'))
    fireEvent.change(screen.getByLabelText('Confirmation model'), { target: { value: 'M5 displacement into M1 confirmation' } })
    fireEvent.change(screen.getByLabelText('Entry zone'), { target: { value: 'M1 FVG reclaim' } })
    fireEvent.change(screen.getByLabelText('RR estimate'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Entry'), { target: { value: '1.0812' } })
    fireEvent.change(screen.getByLabelText('Stop loss'), { target: { value: '1.0798' } })
    fireEvent.change(screen.getByLabelText('Take profit'), { target: { value: '1.0844' } })
    fireEvent.change(screen.getByLabelText('Risk amount'), { target: { value: '75' } })
    fireEvent.change(screen.getByLabelText('Execution invalidation'), { target: { value: 'Close below the reclaimed London range low.' } })
    fireEvent.change(screen.getByLabelText('Initial notes'), { target: { value: 'Execute only if spread stays clean through the reclaim.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(workspaceApiMock.updateSetupCandidate).toHaveBeenCalled())

    fireEvent.click(screen.getAllByRole('button', { name: 'Lock session' })[0])
    await waitFor(() => expect(workspaceApiMock.updateSessionWorkspace).toHaveBeenCalled())

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start trade' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Start trade' }))
    await waitFor(() => expect(workspaceApiMock.startTradeFromSetupCandidate).toHaveBeenCalled())
    expect(await screen.findByText('Trade started from selected setup.')).toBeInTheDocument()

    const daxCard = screen.getByText('DAX continuation').closest('.MuiCard-root') as HTMLElement
    fireEvent.click(within(daxCard).getByRole('button', { name: 'Edit' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(workspaceApiMock.updateSetupCandidateStatus).toHaveBeenCalled())
    expect(screen.getByText('OPEN')).toBeInTheDocument()

    sessionView.unmount()

    renderWithProviders(<DiagnosticsPage />)
    expect(await screen.findByText('Live diagnostics')).toBeInTheDocument()
    expect(screen.getByText(/Backtest metrics are intentionally hidden/i)).toBeInTheDocument()
    expect(screen.getByText('EURUSD')).toBeInTheDocument()
    expect(screen.getByText('London sweep')).toBeInTheDocument()
  }, 15000)
})

import type { DailyPlan } from '../../api/plans'
import type {
  ExecutionTicket,
  ExecutionTicketStatus,
  ConfluenceItem,
  LiveWorkspaceResponse,
  MentorReference,
  PeriodPlan,
  ReviewTimelineEntry,
  SessionPeriodPlanRequest,
  SessionWorkspaceRequest,
  SetupDraftRequest,
  SetupExecution,
  SetupItem,
  SetupLevel,
  SetupStrategySnapshot,
  SetupTrigger,
  WorkspaceReadiness,
  WorkspaceReadinessStep
} from '../../api/liveWorkspace'
import type { StrategyResponse } from '../../api/strategies'

export type SessionDraft = {
  sessionName: string
  objective: string
  bias: string
  biasReason: string
  narrative: string
  dailyMaxLoss: number | null
  profitTarget: number | null
  riskPerTrade: number | null
  maxTrades: number | null
  maxConsecutiveLosses: number | null
  stopAfterTargetReached: boolean
  stopAfterMaxLossReached: boolean
}

export type PeriodPlanDraft = {
  title: string
  bias: string
  focusSymbols: string
  objectives: string
  target: number | null
  maxLoss: number | null
  notes: string
  reviewIntentions: string
}

export type CreateSetupDraft = {
  symbol: string
  direction: SetupItem['direction']
  setupTitle: string
}

export type StrategyImportDraft = {
  search: string
  source: 'ALL' | 'MY' | 'MENTOR'
  createNewSetup: boolean
  symbol: string
  direction: SetupItem['direction']
  setupTitle: string
}

export type CaptureDrawerMode = 'PLAN' | 'TRIGGER' | 'EXECUTE' | 'JOURNAL'
export type WorkstationDensity = 'COMPACT' | 'ADVANCED'
export type CompareMode = 'BOTH' | 'MENTOR' | 'MINE' | 'EXECUTIONS'
export type TriggerStatus = 'NOT_READY' | 'WATCHING' | 'CONFIRMED' | 'INVALIDATED'
export type PlanScopeTab = 'TODAY' | 'WEEKLY' | 'MONTHLY'

export type FocusLevel = {
  id: string
  label: string
  price?: number | null
  source: 'MENTOR' | 'MINE' | 'EXECUTION'
  kind?: 'LEVEL' | 'ENTRY' | 'SL' | 'TP'
}

export type SetupInsight = {
  plan: {
    state: WorkspaceReadiness['state']
    summary: string
    missingItems: string[]
    nextAction: string
  }
  trigger: {
    state: TriggerStatus | WorkspaceReadiness['state']
    summary: string
    missingItems: string[]
    nextAction: string
  }
  execution: {
    state: WorkspaceReadiness['state']
    summary: string
    missingItems: string[]
    nextAction: string
  }
  session: {
    state: WorkspaceReadiness['state']
    summary: string
    missingItems: string[]
    nextAction: string
  }
}

export type NextAction = {
  title: string
  detail: string
  tone: 'success' | 'warning' | 'error' | 'info'
}

export type QuickLogActionId =
  | 'WATCHING'
  | 'TRIGGER_CONFIRMED'
  | 'ENTRY_TAKEN'
  | 'PARTIAL_TAKEN'
  | 'MOVE_TO_BE'
  | 'CLOSE_WIN'
  | 'CLOSE_LOSS'
  | 'SKIPPED'
  | 'INVALIDATED'
  | 'MISSED_TRADE'
  | 'ADD_NOTE'
  | 'ADD_LESSON'

export type QuickLogActionDefinition = {
  id: QuickLogActionId
  eventType: string
  title: string
  tone: 'primary' | 'success' | 'warning' | 'error' | 'secondary'
}

export type QuickLogMutationResult = {
  setup: SetupItem
  feedback: string
}

type CurrentExecutionLookup = {
  executionId: string | null
  ticket: ExecutionTicket | null
}

export const sessionOptions = ['ASIA', 'LONDON', 'NY_AM', 'NY_PM', 'NY'] as const
export const marketOptions = ['FOREX', 'CFD', 'FUTURES', 'CRYPTO', 'STOCK', 'OTHER'] as const
export const executionStatusOptions: ExecutionTicketStatus[] = ['DRAFT', 'WATCHING', 'READY', 'ACTIVE', 'PARTIAL', 'CLOSED', 'INVALIDATED', 'SKIPPED']
export const defaultConfluenceLabels = [
  'HTF bias identified',
  'Key liquidity level identified',
  'Sweep or liquidity event present',
  'Displacement present',
  'Structure confirmation present',
  'Entry zone identified',
  'Invalidation clear',
  'Minimum RR acceptable',
  'Risk configured'
]

export const quickLogActions: QuickLogActionDefinition[] = [
  { id: 'WATCHING', eventType: 'watching', title: 'Watching', tone: 'secondary' },
  { id: 'TRIGGER_CONFIRMED', eventType: 'trigger_confirmed', title: 'Trigger confirmed', tone: 'primary' },
  { id: 'ENTRY_TAKEN', eventType: 'entry_taken', title: 'Entry taken', tone: 'success' },
  { id: 'PARTIAL_TAKEN', eventType: 'partial_taken', title: 'Partial taken', tone: 'primary' },
  { id: 'MOVE_TO_BE', eventType: 'move_to_be', title: 'Move to BE', tone: 'secondary' },
  { id: 'CLOSE_WIN', eventType: 'close_win', title: 'Close win', tone: 'success' },
  { id: 'CLOSE_LOSS', eventType: 'close_loss', title: 'Close loss', tone: 'warning' },
  { id: 'SKIPPED', eventType: 'setup_skipped', title: 'Skipped', tone: 'warning' },
  { id: 'INVALIDATED', eventType: 'setup_invalidated', title: 'Invalidated', tone: 'error' },
  { id: 'MISSED_TRADE', eventType: 'missed_trade', title: 'Missed trade', tone: 'warning' },
  { id: 'ADD_NOTE', eventType: 'note_added', title: 'Add note', tone: 'secondary' },
  { id: 'ADD_LESSON', eventType: 'lesson_added', title: 'Add lesson', tone: 'secondary' }
]

export function parseNumberInput(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function generateId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`
}

export function normalizeConfluence(item: Partial<ConfluenceItem> | undefined, index = 0): ConfluenceItem {
  const label = item?.label?.trim() || `Confluence ${index + 1}`
  return {
    id: item?.id || `conf-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || generateId()}`,
    label,
    checked: Boolean(item?.checked),
    required: item?.required ?? true,
    source: item?.source || 'CUSTOM'
  }
}

export function defaultConfluences(): ConfluenceItem[] {
  return defaultConfluenceLabels.map((label, index) => normalizeConfluence({
    id: `default-${index}`,
    label,
    source: 'DEFAULT',
    required: true,
    checked: false
  }, index))
}

export function strategyConfluences(strategy: Pick<StrategyResponse, 'entryConditions' | 'invalidationLogic' | 'tpFramework' | 'noTradeRules'>): ConfluenceItem[] {
  const rows: ConfluenceItem[] = []
  ;(strategy.entryConditions || []).forEach((label, index) => {
    if (label?.trim()) {
      rows.push(normalizeConfluence({ label, source: 'STRATEGY', required: true }, index))
    }
  })
  if (strategy.invalidationLogic) {
    rows.push(normalizeConfluence({ label: `Invalidation clear: ${strategy.invalidationLogic}`, source: 'STRATEGY', required: true }, rows.length))
  }
  if (strategy.tpFramework) {
    rows.push(normalizeConfluence({ label: `Target model clear: ${strategy.tpFramework}`, source: 'STRATEGY', required: true }, rows.length))
  }
  if (strategy.noTradeRules) {
    rows.push(normalizeConfluence({ label: `Avoid conditions reviewed: ${strategy.noTradeRules}`, source: 'STRATEGY', required: false }, rows.length))
  }
  rows.push(normalizeConfluence({ label: 'Risk configured', source: 'DEFAULT', required: true }, rows.length))
  return dedupeConfluences(rows.length ? rows : defaultConfluences())
}

export function dedupeConfluences(items: ConfluenceItem[]) {
  const seen = new Set<string>()
  return items
    .map((item, index) => normalizeConfluence(item, index))
    .filter((item) => {
      const key = item.label.trim().toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function parseTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function toTagValue(values?: string[] | null) {
  return (values || []).join(', ')
}

export function formatDirection(direction: SetupItem['direction']) {
  if (direction === 'LONG') return 'Long'
  if (direction === 'SHORT') return 'Short'
  return 'Not decided yet'
}

export function computeRr(
  direction: SetupItem['direction'],
  execution: Pick<ExecutionTicket, 'entryPrice' | 'stopLossPrice' | 'takeProfitPrice'>
) {
  if (direction === 'UNDECIDED') return null
  const entry = execution.entryPrice
  const stop = execution.stopLossPrice
  const target = execution.takeProfitPrice
  if (entry == null || stop == null || target == null) return null
  const risk = direction === 'LONG' ? entry - stop : stop - entry
  const reward = direction === 'LONG' ? target - entry : entry - target
  if (risk <= 0 || reward <= 0) return null
  return reward / risk
}

export function ensureTicket(ticket: ExecutionTicket | Partial<ExecutionTicket> | undefined, index: number): ExecutionTicket {
  const id = ticket?.id || generateId()
  return {
    id,
    label: ticket?.label || `Execution ${index + 1}`,
    status: (ticket?.status as ExecutionTicketStatus) || 'DRAFT',
    entryPrice: ticket?.entryPrice ?? null,
    stopLossPrice: ticket?.stopLossPrice ?? null,
    takeProfitPrice: ticket?.takeProfitPrice ?? null,
    riskAmount: ticket?.riskAmount ?? null,
    quantity: ticket?.quantity ?? null,
    invalidation: ticket?.invalidation || '',
    whyWrong: ticket?.whyWrong || '',
    initialNotes: ticket?.initialNotes || '',
    notes: ticket?.notes || '',
    linkedTradeId: ticket?.linkedTradeId || null,
    createdAt: ticket?.createdAt || new Date().toISOString(),
    updatedAt: ticket?.updatedAt || null,
    startedAt: ticket?.startedAt || null,
    closedAt: ticket?.closedAt || null
  }
}

export function ensureExecutionWorkspace(setup: SetupItem): SetupItem {
  const incomingTickets = setup.executions?.tickets?.length
    ? setup.executions.tickets
    : setup.execution?.tickets?.length
      ? setup.execution.tickets
      : [ensureTicket({
        id: setup.execution.activeExecutionId || undefined,
        label: 'Execution 1',
        status: 'DRAFT',
        entryPrice: setup.execution.entryPrice,
        stopLossPrice: setup.execution.stopLossPrice,
        takeProfitPrice: setup.execution.takeProfitPrice,
        riskAmount: setup.execution.riskAmount,
        quantity: setup.execution.quantity,
        invalidation: setup.execution.invalidation,
        whyWrong: setup.execution.whyWrong,
        initialNotes: setup.execution.initialNotes
      }, 0)]
  const tickets = incomingTickets.map((ticket, index) => ensureTicket(ticket, index))
  const activeExecutionId = tickets.some((ticket) => ticket.id === setup.executions?.activeExecutionId)
    ? setup.executions?.activeExecutionId || null
    : tickets.some((ticket) => ticket.id === setup.execution.activeExecutionId)
      ? setup.execution.activeExecutionId || null
      : tickets[0]?.id || null
  const activeTicket = tickets.find((ticket) => ticket.id === activeExecutionId) || tickets[0]
  return {
    ...setup,
    confluences: dedupeConfluences(setup.confluences?.length ? setup.confluences : defaultConfluences()),
    manualSetupMode: setup.manualSetupMode ?? !setup.strategySnapshot?.name,
    strategySnapshot: setup.strategySnapshot || null,
    review: {
      liveNotes: setup.review?.liveNotes || '',
      mistakes: setup.review?.mistakes || '',
      lessons: setup.review?.lessons || '',
      outcomeSummary: setup.review?.outcomeSummary || '',
      tags: setup.review?.tags || [],
      timeline: setup.review?.timeline || []
    },
    trigger: {
      sweepIdentified: Boolean(setup.trigger.sweepIdentified),
      displacementConfirmed: Boolean(setup.trigger.displacementConfirmed),
      structureConfirmed: Boolean(setup.trigger.structureConfirmed),
      confirmationModel: setup.trigger.confirmationModel || '',
      sweepType: setup.trigger.sweepType || '',
      liquiditySource: setup.trigger.liquiditySource || '',
      confirmationTimeframe: setup.trigger.confirmationTimeframe || '',
      displacementRule: setup.trigger.displacementRule || '',
      structureRule: setup.trigger.structureRule || '',
      fvgRequirement: setup.trigger.fvgRequirement || '',
      entryModel: setup.trigger.entryModel || '',
      entryZone: setup.trigger.entryZone || '',
      rrEstimate: setup.trigger.rrEstimate ?? null,
      rrMinimum: setup.trigger.rrMinimum ?? null,
      confluenceRequirement: setup.trigger.confluenceRequirement || '',
      newsRestriction: setup.trigger.newsRestriction || '',
      sessionRestriction: setup.trigger.sessionRestriction || '',
      invalidationThreshold: setup.trigger.invalidationThreshold || '',
      notes: setup.trigger.notes || ''
    },
    execution: {
      activeExecutionId,
      entryPrice: activeTicket?.entryPrice ?? null,
      stopLossPrice: activeTicket?.stopLossPrice ?? null,
      takeProfitPrice: activeTicket?.takeProfitPrice ?? null,
      riskAmount: activeTicket?.riskAmount ?? null,
      quantity: activeTicket?.quantity ?? null,
      invalidation: activeTicket?.invalidation || '',
      whyWrong: activeTicket?.whyWrong || '',
      initialNotes: activeTicket?.initialNotes || '',
      tickets
    },
    executions: {
      activeExecutionId,
      tickets
    }
  }
}

export function ensureWorkspace(workspace: LiveWorkspaceResponse): LiveWorkspaceResponse {
  return {
    ...workspace,
    setups: workspace.setups.map((setup) => ensureExecutionWorkspace(setup))
  }
}

export function toSessionDraft(session: LiveWorkspaceResponse['session']): SessionDraft {
  return {
    sessionName: session.sessionName || '',
    objective: session.objective || '',
    bias: session.bias || '',
    biasReason: session.biasReason || '',
    narrative: session.narrative || '',
    dailyMaxLoss: session.dailyMaxLoss ?? null,
    profitTarget: session.profitTarget ?? null,
    riskPerTrade: session.riskPerTrade ?? null,
    maxTrades: session.maxTrades ?? null,
    maxConsecutiveLosses: session.maxConsecutiveLosses ?? null,
    stopAfterTargetReached: Boolean(session.stopAfterTargetReached),
    stopAfterMaxLossReached: session.stopAfterMaxLossReached ?? true
  }
}

export function toSessionPayload(draft: SessionDraft): SessionWorkspaceRequest {
  return {
    sessionName: draft.sessionName || null,
    objective: draft.objective || null,
    bias: draft.bias || null,
    biasReason: draft.biasReason || null,
    narrative: draft.narrative || null,
    dailyMaxLoss: draft.dailyMaxLoss,
    profitTarget: draft.profitTarget,
    riskPerTrade: draft.riskPerTrade,
    maxTrades: draft.maxTrades,
    maxConsecutiveLosses: draft.maxConsecutiveLosses,
    stopAfterTargetReached: draft.stopAfterTargetReached,
    stopAfterMaxLossReached: draft.stopAfterMaxLossReached
  }
}

export function toSetupPayload(setup: SetupItem): SetupDraftRequest {
  const normalized = ensureExecutionWorkspace(setup)
  return {
    symbol: normalized.symbol,
    direction: normalized.direction,
    market: normalized.market || null,
    tradeSession: normalized.tradeSession || null,
    strategyId: normalized.strategyId || normalized.strategySnapshot?.strategyId || null,
    strategyLabel: normalized.strategyLabel || normalized.strategySnapshot?.name || null,
    setupTitle: normalized.setupTitle,
    biasAlignment: normalized.biasAlignment || null,
    context: {
      narrative: normalized.context.narrative || null,
      liquidityNotes: normalized.context.liquidityNotes || null,
      invalidationIdea: normalized.context.invalidationIdea || null,
      newsSafety: normalized.context.newsSafety || null,
      notes: normalized.context.notes || null
    },
    strategySnapshot: normalized.strategySnapshot
      ? {
        strategyId: normalized.strategySnapshot.strategyId || null,
        source: normalized.strategySnapshot.source || null,
        name: normalized.strategySnapshot.name || null,
        model: normalized.strategySnapshot.model || null,
        entryConditionsRich: normalized.strategySnapshot.entryConditionsRich || null,
        entryConditions: normalized.strategySnapshot.entryConditions || [],
        invalidationLogic: normalized.strategySnapshot.invalidationLogic || null,
        tpFramework: normalized.strategySnapshot.tpFramework || null,
        noTradeRules: normalized.strategySnapshot.noTradeRules || null,
        sessionSuitability: normalized.strategySnapshot.sessionSuitability || [],
        tags: normalized.strategySnapshot.tags || [],
        snapshotAssetId: normalized.strategySnapshot.snapshotAssetId || null,
        importedAt: normalized.strategySnapshot.importedAt || null,
        localEditsApplied: normalized.strategySnapshot.localEditsApplied ?? null
      }
      : null,
    trigger: {
      sweepIdentified: normalized.trigger.sweepIdentified ?? false,
      displacementConfirmed: normalized.trigger.displacementConfirmed ?? false,
      structureConfirmed: normalized.trigger.structureConfirmed ?? false,
      confirmationModel: normalized.trigger.confirmationModel || null,
      sweepType: normalized.trigger.sweepType || null,
      liquiditySource: normalized.trigger.liquiditySource || null,
      confirmationTimeframe: normalized.trigger.confirmationTimeframe || null,
      displacementRule: normalized.trigger.displacementRule || null,
      structureRule: normalized.trigger.structureRule || null,
      fvgRequirement: normalized.trigger.fvgRequirement || null,
      entryModel: normalized.trigger.entryModel || null,
      entryZone: normalized.trigger.entryZone || null,
      rrEstimate: normalized.trigger.rrEstimate ?? null,
      rrMinimum: normalized.trigger.rrMinimum ?? null,
      confluenceRequirement: normalized.trigger.confluenceRequirement || null,
      newsRestriction: normalized.trigger.newsRestriction || null,
      sessionRestriction: normalized.trigger.sessionRestriction || null,
      invalidationThreshold: normalized.trigger.invalidationThreshold || null,
      notes: normalized.trigger.notes || null
    },
    execution: {
      activeExecutionId: normalized.executions.activeExecutionId || null,
      entryPrice: normalized.execution.entryPrice ?? null,
      stopLossPrice: normalized.execution.stopLossPrice ?? null,
      takeProfitPrice: normalized.execution.takeProfitPrice ?? null,
      riskAmount: normalized.execution.riskAmount ?? null,
      quantity: normalized.execution.quantity ?? null,
      invalidation: normalized.execution.invalidation || null,
      whyWrong: normalized.execution.whyWrong || null,
      initialNotes: normalized.execution.initialNotes || null,
      tickets: normalized.executions.tickets.map((ticket) => ({
        id: ticket.id,
        label: ticket.label,
        status: ticket.status,
        entryPrice: ticket.entryPrice ?? null,
        stopLossPrice: ticket.stopLossPrice ?? null,
        takeProfitPrice: ticket.takeProfitPrice ?? null,
        riskAmount: ticket.riskAmount ?? null,
        quantity: ticket.quantity ?? null,
        invalidation: ticket.invalidation || null,
        whyWrong: ticket.whyWrong || null,
        initialNotes: ticket.initialNotes || null,
        notes: ticket.notes || null,
        linkedTradeId: ticket.linkedTradeId || null,
        createdAt: ticket.createdAt || null,
        updatedAt: ticket.updatedAt || null,
        startedAt: ticket.startedAt || null,
        closedAt: ticket.closedAt || null
      }))
    },
    review: normalized.review
      ? {
        liveNotes: normalized.review.liveNotes || null,
        mistakes: normalized.review.mistakes || null,
        lessons: normalized.review.lessons || null,
        outcomeSummary: normalized.review.outcomeSummary || null,
        tags: normalized.review.tags || [],
        timeline: normalized.review.timeline || []
      }
      : null,
    levels: normalized.levels.map((level) => ({
      label: level.label || null,
      price: level.price ?? null,
      source: level.source || null,
      notes: level.notes || null
    })),
    mentorReference: normalized.mentorReference || null,
    confluences: dedupeConfluences(normalized.confluences || []).map((item) => ({
      id: item.id,
      label: item.label,
      checked: item.checked,
      required: item.required,
      source: item.source || 'CUSTOM'
    })),
    manualSetupMode: normalized.manualSetupMode ?? !normalized.strategySnapshot?.name
  }
}

export function extractMentorLevels(mentorPlan: DailyPlan | null | undefined): SetupLevel[] {
  if (!mentorPlan?.keyLevels?.length) return []
  return mentorPlan.keyLevels.map((item) => {
    const match = item.match(/-?\d+(?:\.\d+)?/g)
    const price = match?.length ? Number(match[match.length - 1]) : null
    return {
      label: item,
      price: Number.isFinite(price) ? price : null,
      source: 'MENTOR',
      notes: null
    }
  })
}

export function mergeMentorLevels(existing: SetupLevel[], mentorPlan: DailyPlan) {
  const mentorLevels = extractMentorLevels(mentorPlan)
  const merged = [...existing]
  mentorLevels.forEach((level) => {
    if (!merged.some((item) => item.label === level.label && item.price === level.price)) {
      merged.push(level)
    }
  })
  return merged
}

export function createMentorReference(mentorPlan: DailyPlan): MentorReference {
  return {
    planTitle: mentorPlan.title,
    symbol: mentorPlan.tradingViewSymbol || null,
    bias: mentorPlan.biasSummary || null,
    preferredScenario: mentorPlan.executionRules || mentorPlan.liquidityNarrative || null,
    invalidation: mentorPlan.alternativeScenario || null,
    noTradeWarning: mentorPlan.riskNote || null,
    keyLevels: mentorPlan.keyLevels || []
  }
}

export function mentorMatchesSetup(mentorPlan: DailyPlan | null | undefined, setup: SetupItem | null) {
  if (!mentorPlan || !setup) return true
  const mentorSymbol = mentorPlan.tradingViewSymbol?.split(':').pop()?.toUpperCase()
  if (!mentorSymbol) return true
  return mentorSymbol.includes(setup.symbol) || setup.symbol.includes(mentorSymbol)
}

export function toTradingViewSymbol(setupSymbol?: string | null, mentorSymbol?: string | null) {
  if (setupSymbol) {
    const normalized = setupSymbol.trim().toUpperCase()
    if (normalized.includes(':')) return normalized
    if (/^[A-Z]{6}$/.test(normalized)) return `OANDA:${normalized}`
    return normalized
  }
  return mentorSymbol || ''
}

export function createTimelineEntry(type: string, title: string, body?: string | null, executionId?: string | null, tradeId?: string | null): ReviewTimelineEntry {
  return {
    id: generateId(),
    type,
    title,
    body: body || null,
    executionId: executionId || null,
    tradeId: tradeId || null,
    occurredAt: new Date().toISOString()
  }
}

export function markStrategyDirty(setup: SetupItem) {
  if (!setup.strategySnapshot) return setup
  return {
    ...setup,
    strategySnapshot: {
      ...setup.strategySnapshot,
      localEditsApplied: true
    }
  }
}

export function appendTimeline(setup: SetupItem, entry: ReviewTimelineEntry) {
  const review = setup.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }
  return {
    ...setup,
    review: {
      ...review,
      timeline: [...(review.timeline || []), entry]
    }
  }
}

export function buildStrategySnapshot(strategy: StrategyResponse): SetupStrategySnapshot {
  return {
    strategyId: strategy.id,
    source: strategy.source,
    name: strategy.name,
    model: strategy.model,
    entryConditionsRich: strategy.entryConditionsRich || null,
    entryConditions: strategy.entryConditions || [],
    invalidationLogic: strategy.invalidationLogic || null,
    tpFramework: strategy.tpFramework || null,
    noTradeRules: strategy.noTradeRules || null,
    sessionSuitability: strategy.sessionSuitability || [],
    tags: strategy.tags || [],
    snapshotAssetId: strategy.snapshotAssetId || null,
    importedAt: new Date().toISOString(),
    localEditsApplied: false
  }
}

export function applyStrategyImport(setup: SetupItem, strategy: StrategyResponse): SetupItem {
  const snapshot = buildStrategySnapshot(strategy)
  const linkedStrategyId = strategy.source === 'MY' ? strategy.id : null
  const imported = ensureExecutionWorkspace({
    ...setup,
    strategyId: linkedStrategyId,
    strategyLabel: strategy.name,
    strategySnapshot: snapshot,
    manualSetupMode: false,
    confluences: strategyConfluences(strategy),
    setupTitle: setup.setupTitle || strategy.name,
    tradeSession: setup.tradeSession || ((strategy.sessionSuitability || []).includes('London') ? 'LONDON' : setup.tradeSession || null),
    context: {
      ...setup.context,
      narrative: setup.context.narrative || strategy.model || '',
      liquidityNotes: setup.context.liquidityNotes || (strategy.entryConditions || []).slice(0, 3).join(' • '),
      invalidationIdea: setup.context.invalidationIdea || strategy.invalidationLogic || '',
      newsSafety: setup.context.newsSafety || strategy.noTradeRules || '',
      notes: setup.context.notes || ''
    },
    trigger: {
      ...setup.trigger,
      confirmationModel: setup.trigger.confirmationModel || strategy.model || '',
      entryModel: setup.trigger.entryModel || strategy.model || '',
      entryZone: setup.trigger.entryZone || strategy.entryConditions?.[0] || '',
      notes: setup.trigger.notes || (strategy.entryConditions || []).join('\n'),
      rrMinimum: setup.trigger.rrMinimum ?? null
    },
    review: {
      liveNotes: setup.review?.liveNotes || '',
      mistakes: setup.review?.mistakes || '',
      lessons: setup.review?.lessons || '',
      outcomeSummary: setup.review?.outcomeSummary || '',
      tags: Array.from(new Set([...(setup.review?.tags || []), ...(strategy.tags || [])])),
      timeline: setup.review?.timeline || []
    }
  })
  return appendTimeline(imported, createTimelineEntry('strategy_imported', 'Strategy imported', strategy.name))
}

export function buildTimeline(setup: SetupItem, activity: LiveWorkspaceResponse['activity']) {
  const rows: ReviewTimelineEntry[] = [...(setup.review?.timeline || [])]
  rows.push({
    id: `setup-created-${setup.id}`,
    type: 'setup_created',
    title: 'Setup created',
    body: setup.setupTitle,
    executionId: null,
    tradeId: null,
    occurredAt: setup.createdAt || null
  })
  if (setup.strategySnapshot?.importedAt) {
    rows.push({
      id: `strategy-import-${setup.id}`,
      type: 'strategy_imported',
      title: 'Strategy imported',
      body: setup.strategySnapshot.name || null,
      executionId: null,
      tradeId: null,
      occurredAt: setup.strategySnapshot.importedAt
    })
  }
  setup.executions.tickets.forEach((ticket) => {
    rows.push({
      id: `ticket-created-${ticket.id}`,
      type: 'execution_created',
      title: 'Execution created',
      body: ticket.label,
      executionId: ticket.id,
      tradeId: ticket.linkedTradeId || null,
      occurredAt: ticket.createdAt || null
    })
    if (ticket.startedAt) {
      rows.push({
        id: `ticket-started-${ticket.id}`,
        type: 'execution_started',
        title: 'Execution started',
        body: ticket.label,
        executionId: ticket.id,
        tradeId: ticket.linkedTradeId || null,
        occurredAt: ticket.startedAt
      })
    }
    if (ticket.closedAt) {
      rows.push({
        id: `ticket-closed-${ticket.id}`,
        type: 'execution_closed',
        title: 'Execution closed',
        body: ticket.label,
        executionId: ticket.id,
        tradeId: ticket.linkedTradeId || null,
        occurredAt: ticket.closedAt
      })
    }
  })
  activity
    .filter((trade) => trade.setupId === setup.id)
    .forEach((trade) => {
      rows.push({
        id: `trade-open-${trade.tradeId}`,
        type: 'trade_open',
        title: 'Trade opened',
        body: trade.setupTitle || trade.symbol,
        executionId: null,
        tradeId: trade.tradeId,
        occurredAt: trade.openedAt || null
      })
      if (trade.closedAt) {
        rows.push({
          id: `trade-close-${trade.tradeId}`,
          type: 'trade_close',
          title: 'Trade closed',
          body: trade.setupTitle || trade.symbol,
          executionId: null,
          tradeId: trade.tradeId,
          occurredAt: trade.closedAt
        })
      }
    })

  const seen = new Set<string>()
  return rows
    .filter((entry) => {
      const key = [entry.id, entry.type, entry.executionId, entry.tradeId, entry.occurredAt].join('::')
      if (seen.has(key)) return false
      seen.add(key)
      return Boolean(entry.occurredAt || entry.title)
    })
    .sort((left, right) => `${right.occurredAt || ''}`.localeCompare(left.occurredAt || ''))
}

export function focusLevelsForSetup(setup: SetupItem | null, mentorPlan: DailyPlan | null | undefined, compareMode: CompareMode): FocusLevel[] {
  if (!setup) return []
  const mentorLevels = extractMentorLevels(mentorPlan).map((level, index) => ({
    id: `mentor-${index}-${level.label}`,
    label: level.label || 'Mentor level',
    price: level.price,
    source: 'MENTOR' as const,
    kind: 'LEVEL' as const
  }))
  const mineLevels = setup.levels.map((level, index) => ({
    id: `setup-${index}-${level.label}`,
    label: level.label || 'Setup level',
    price: level.price,
    source: 'MINE' as const,
    kind: 'LEVEL' as const
  }))
  const activeTicket = setup.executions.tickets.find((ticket) => ticket.id === setup.executions.activeExecutionId) || setup.executions.tickets[0]
  const executionLevels: FocusLevel[] = [
    { id: `entry-${activeTicket?.id || 'none'}`, label: 'Entry', price: activeTicket?.entryPrice ?? null, source: 'EXECUTION' as const, kind: 'ENTRY' as const },
    { id: `sl-${activeTicket?.id || 'none'}`, label: 'Stop', price: activeTicket?.stopLossPrice ?? null, source: 'EXECUTION' as const, kind: 'SL' as const },
    { id: `tp-${activeTicket?.id || 'none'}`, label: 'Target', price: activeTicket?.takeProfitPrice ?? null, source: 'EXECUTION' as const, kind: 'TP' as const }
  ].filter((item) => item.price != null)
  if (compareMode === 'MENTOR') return mentorLevels
  if (compareMode === 'MINE') return mineLevels
  if (compareMode === 'EXECUTIONS') return executionLevels
  return [...executionLevels, ...mineLevels, ...mentorLevels]
}

export function findCurrentExecution(setup: SetupItem): CurrentExecutionLookup {
  const normalized = ensureExecutionWorkspace(setup)
  const executionId = normalized.executions.activeExecutionId || normalized.executions.tickets[0]?.id || null
  const ticket = normalized.executions.tickets.find((item) => item.id === executionId) || normalized.executions.tickets[0] || null
  return { executionId, ticket }
}

function updateExecutionTicket(
  setup: SetupItem,
  updater: (ticket: ExecutionTicket) => ExecutionTicket,
  explicitExecutionId?: string | null
) {
  const normalized = ensureExecutionWorkspace(setup)
  const { executionId } = findCurrentExecution(normalized)
  const activeExecutionId = explicitExecutionId || executionId
  const tickets = normalized.executions.tickets.map((ticket, index) => (
    ticket.id === activeExecutionId
      ? ensureTicket(updater(ticket), index)
      : ticket
  ))
  return ensureExecutionWorkspace({
    ...normalized,
    executions: {
      ...normalized.executions,
      activeExecutionId,
      tickets
    }
  })
}

function appendLine(value: string | null | undefined, incoming: string | undefined) {
  if (!incoming?.trim()) return value || ''
  return [value?.trim(), incoming.trim()].filter(Boolean).join('\n')
}

export function getTriggerStatus(setup: SetupItem | null): TriggerStatus {
  if (!setup) return 'NOT_READY'
  const current = ensureExecutionWorkspace(setup)
  if (current.status === 'INVALIDATED') return 'INVALIDATED'
  if (current.trigger.sweepIdentified && current.trigger.displacementConfirmed && current.trigger.structureConfirmed) {
    return 'CONFIRMED'
  }
  const { ticket } = findCurrentExecution(current)
  if (current.status === 'WATCHING' || ticket?.status === 'WATCHING' || current.trigger.sweepIdentified || current.trigger.displacementConfirmed || current.trigger.structureConfirmed) {
    return 'WATCHING'
  }
  return 'NOT_READY'
}

export function getTriggerStateFromStatus(status: TriggerStatus): WorkspaceReadiness['state'] {
  if (status === 'CONFIRMED') return 'READY'
  if (status === 'INVALIDATED') return 'BLOCKED'
  return 'INCOMPLETE'
}

function stepOrFallback(steps: WorkspaceReadinessStep[], key: string) {
  return steps.find((step) => step.key === key)
}

function missingItemsForStep(step: WorkspaceReadinessStep | undefined) {
  return step?.missingItems || []
}

export function getSetupInsight(setup: SetupItem | null, sessionReadiness: WorkspaceReadiness): SetupInsight | null {
  if (!setup) return null
  const current = ensureExecutionWorkspace(setup)
  const contextStep = stepOrFallback(current.readiness.steps, 'context')
  const triggerStep = stepOrFallback(current.readiness.steps, 'trigger')
  const executionStep = stepOrFallback(current.readiness.steps, 'execution')
  const sessionStep = stepOrFallback(sessionReadiness.steps, 'lock')
  const triggerStatus = getTriggerStatus(current)
  const triggerMissing = triggerStep?.missingItems?.length
    ? triggerStep.missingItems
    : triggerStatus === 'NOT_READY'
      ? ['trigger confirmation']
      : []
  return {
    plan: {
      state: contextStep?.state || current.readiness.state,
      summary: contextStep?.summary || current.readiness.summary,
      missingItems: missingItemsForStep(contextStep),
      nextAction: contextStep?.missingItems?.length ? `Add ${contextStep.missingItems[0]}.` : 'Plan context is aligned.'
    },
    trigger: {
      state: triggerStatus,
      summary: triggerStep?.summary || triggerStatus,
      missingItems: triggerMissing,
      nextAction: triggerMissing.length ? `Confirm ${triggerMissing[0]}.` : 'Trigger confirmation is ready.'
    },
    execution: {
      state: executionStep?.state || current.readiness.state,
      summary: executionStep?.summary || current.readiness.summary,
      missingItems: missingItemsForStep(executionStep),
      nextAction: executionStep?.missingItems?.length ? `Complete ${executionStep.missingItems[0]}.` : 'Execution ticket is ready.'
    },
    session: {
      state: sessionStep?.state || sessionReadiness.state,
      summary: sessionStep?.summary || sessionReadiness.summary,
      missingItems: missingItemsForStep(sessionStep),
      nextAction: sessionStep?.missingItems?.length ? `Resolve ${sessionStep.missingItems[0]}.` : 'Session guardrails are locked.'
    }
  }
}

export function toPeriodPlanDraft(plan: PeriodPlan | null | undefined): PeriodPlanDraft {
  return {
    title: plan?.title || '',
    bias: plan?.bias || '',
    focusSymbols: (plan?.focusSymbols || []).join(', '),
    objectives: plan?.objectives || '',
    target: plan?.target ?? null,
    maxLoss: plan?.maxLoss ?? null,
    notes: plan?.notes || '',
    reviewIntentions: plan?.reviewIntentions || ''
  }
}

export function toPeriodPlanPayload(draft: PeriodPlanDraft): SessionPeriodPlanRequest {
  return {
    title: draft.title || null,
    bias: draft.bias || null,
    focusSymbols: parseTags(draft.focusSymbols),
    objectives: draft.objectives || null,
    target: draft.target,
    maxLoss: draft.maxLoss,
    notes: draft.notes || null,
    reviewIntentions: draft.reviewIntentions || null
  }
}

export function getSimpleReadinessLabel(
  workspace: LiveWorkspaceResponse,
  setup: SetupItem | null
): 'Empty' | 'Planning' | 'Not Ready' | 'Ready to Lock' | 'Locked' {
  if (!workspace.setups.length || !setup) return 'Empty'
  if (workspace.session.lockedInAt) return 'Locked'
  if (!workspace.session.quickStats.riskConfigured) return 'Planning'
  if (!setup.strategySnapshot?.name && !setup.manualSetupMode) return 'Planning'
  const requiredMissing = (setup.confluences || []).some((item) => item.required && !item.checked && item.label.toLowerCase() !== 'risk configured')
  if (requiredMissing || setup.direction === 'UNDECIDED' || !setup.symbol || !setup.setupTitle) return 'Not Ready'
  return 'Ready to Lock'
}

export function getNextAction(setup: SetupItem | null, sessionReadiness: WorkspaceReadiness): NextAction {
  if (!setup) {
    return {
      title: 'Create or open a setup',
      detail: 'Add a setup or import a strategy to anchor the chart and capture drawer.',
      tone: 'info'
    }
  }
  const current = ensureExecutionWorkspace(setup)
  const { ticket } = findCurrentExecution(current)
  if (!sessionReadiness.steps.find((step) => step.key === 'lock')?.state || !current) {
    return {
      title: 'Open a setup',
      detail: 'Select a setup to start planning and execution capture.',
      tone: 'info'
    }
  }
  if (!current.strategySnapshot?.name) {
    return {
      title: 'Import a strategy',
      detail: 'Use a strategy snapshot to prefill the setup and reduce typing.',
      tone: 'info'
    }
  }
  if (!sessionReadiness.steps.find((step) => step.key === 'lock') || sessionReadiness.state !== 'READY') {
    return {
      title: 'Lock session to enable execution',
      detail: 'Freeze session guardrails before marking entries live.',
      tone: 'warning'
    }
  }
  if (!ticket?.entryPrice || !ticket.stopLossPrice || !ticket.takeProfitPrice) {
    return {
      title: 'Complete the active execution ticket',
      detail: 'Add entry, stop, and target so the execution card can move live.',
      tone: 'warning'
    }
  }
  const triggerStatus = getTriggerStatus(current)
  if (triggerStatus !== 'CONFIRMED') {
    return {
      title: 'Confirm the trigger',
      detail: 'Use the trigger checklist before logging the entry.',
      tone: 'warning'
    }
  }
  return {
    title: 'Ready to execute',
    detail: 'Use quick log actions to record entry, BE moves, partials, and close events without opening long notes.',
    tone: 'success'
  }
}

export function summarizeStrategySnapshot(snapshot: SetupStrategySnapshot | null | undefined) {
  if (!snapshot) return null
  return {
    importedFrom: snapshot.name || '—',
    model: snapshot.model || '—',
    entrySummary: snapshot.entryConditions?.slice(0, 3).join(' • ') || snapshot.model || '—',
    invalidation: snapshot.invalidationLogic || '—',
    targets: snapshot.tpFramework || '—',
    noTradeRules: snapshot.noTradeRules || '—'
  }
}

export function latestSetupAction(setup: SetupItem, activity: LiveWorkspaceResponse['activity']) {
  const timeline = buildTimeline(setup, activity)
  return timeline[0] || null
}

export function buildQuickLogUpdate(
  setup: SetupItem,
  actionId: QuickLogActionId,
  options: {
    note?: string
    reviewTags?: string[]
    executionId?: string | null
    now?: string
  } = {}
): QuickLogMutationResult {
  const definition = quickLogActions.find((item) => item.id === actionId)
  if (!definition) {
    return {
      setup,
      feedback: 'Quick action unavailable.'
    }
  }
  const now = options.now || new Date().toISOString()
  const current = ensureExecutionWorkspace(setup)
  const { executionId, ticket } = findCurrentExecution(current)
  const activeExecutionId = options.executionId || executionId
  const activeTicket = current.executions.tickets.find((item) => item.id === activeExecutionId) || ticket
  let next = current

  const applyExecutionStatus = (
    status: ExecutionTicketStatus,
    extras: Partial<ExecutionTicket> = {}
  ) => {
    next = updateExecutionTicket(next, (existing) => ({
      ...existing,
      status,
      ...extras,
      updatedAt: now
    }), activeExecutionId)
  }

  if (actionId === 'WATCHING') {
    next = {
      ...next,
      status: 'WATCHING'
    }
    applyExecutionStatus('WATCHING')
  }

  if (actionId === 'TRIGGER_CONFIRMED') {
    next = {
      ...next,
      status: 'TRIGGERED',
      trigger: {
        ...next.trigger,
        sweepIdentified: true,
        displacementConfirmed: true,
        structureConfirmed: true
      }
    }
    applyExecutionStatus(activeTicket?.status === 'ACTIVE' ? 'ACTIVE' : 'READY')
  }

  if (actionId === 'ENTRY_TAKEN') {
    next = {
      ...next,
      status: 'EXECUTED'
    }
    applyExecutionStatus('ACTIVE', { startedAt: activeTicket?.startedAt || now })
  }

  if (actionId === 'PARTIAL_TAKEN') {
    applyExecutionStatus('PARTIAL')
  }

  if (actionId === 'MOVE_TO_BE') {
    next = updateExecutionTicket(next, (existing) => ({
      ...existing,
      status: existing.status === 'CLOSED' ? existing.status : existing.status === 'PARTIAL' ? 'PARTIAL' : 'ACTIVE',
      stopLossPrice: existing.entryPrice ?? existing.stopLossPrice,
      updatedAt: now
    }), activeExecutionId)
  }

  if (actionId === 'CLOSE_WIN' || actionId === 'CLOSE_LOSS') {
    next = {
      ...next,
      status: 'CLOSED'
    }
    applyExecutionStatus('CLOSED', { closedAt: now })
  }

  if (actionId === 'SKIPPED' || actionId === 'MISSED_TRADE') {
    next = {
      ...next,
      status: 'SKIPPED'
    }
    applyExecutionStatus('SKIPPED')
  }

  if (actionId === 'INVALIDATED') {
    next = {
      ...next,
      status: 'INVALIDATED'
    }
    applyExecutionStatus('INVALIDATED')
  }

  if (actionId === 'ADD_NOTE') {
    next = {
      ...next,
      review: {
        ...(next.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }),
        liveNotes: appendLine(next.review?.liveNotes, options.note)
      }
    }
  }

  if (actionId === 'ADD_LESSON') {
    next = {
      ...next,
      review: {
        ...(next.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }),
        lessons: appendLine(next.review?.lessons, options.note),
        tags: Array.from(new Set([...(next.review?.tags || []), ...(options.reviewTags || [])]))
      }
    }
  }

  if (actionId !== 'ADD_NOTE' && actionId !== 'ADD_LESSON' && options.reviewTags?.length) {
    next = {
      ...next,
      review: {
        ...(next.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }),
        tags: Array.from(new Set([...(next.review?.tags || []), ...options.reviewTags]))
      }
    }
  }

  const entryBody = options.note?.trim()
    || activeTicket?.label
    || current.setupTitle
  next = appendTimeline(
    next,
    {
      id: generateId(),
      type: definition.eventType,
      title: definition.title,
      body: entryBody || null,
      executionId: activeExecutionId || null,
      tradeId: activeTicket?.linkedTradeId || null,
      occurredAt: now
    }
  )

  return {
    setup: ensureExecutionWorkspace(next),
    feedback: definition.title
  }
}

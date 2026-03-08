import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import type { ChipProps } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import ImportExportRoundedIcon from '@mui/icons-material/ImportExportRounded'
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import NotesRoundedIcon from '@mui/icons-material/NotesRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PriceCheckRoundedIcon from '@mui/icons-material/PriceCheckRounded'
import RuleRoundedIcon from '@mui/icons-material/RuleRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { fetchTodayMentorPlan, type DailyPlan } from '../api/plans'
import {
  createSetupCandidate,
  duplicateSetupCandidate,
  getSessionWorkspace,
  selectActiveSetupCandidate,
  startTradeFromSetupCandidate,
  updateSessionWorkspace,
  updateSetupCandidate,
  updateSetupCandidateStatus,
  type ExecutionTicket,
  type ExecutionTicketStatus,
  type LiveWorkspaceResponse,
  type MentorReference,
  type ReviewTimelineEntry,
  type SessionWorkspaceRequest,
  type SetupDraftRequest,
  type SetupExecution,
  type SetupItem,
  type SetupLevel,
  type SetupReview,
  type SetupStatus,
  type SetupStrategySnapshot,
  type SetupTrigger
} from '../api/liveWorkspace'
import { listStrategies, type StrategyResponse } from '../api/strategies'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import RichTextContent from '../components/ui/RichTextContent'
import { useI18n } from '../i18n'
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatSignedCurrency } from '../utils/format'

type SessionDraft = {
  sessionName: string
  objective: string
  bias: string
  biasReason: string
  narrative: string
  dailyMaxLoss: number | null
  maxTrades: number | null
}

type CreateSetupDraft = {
  symbol: string
  direction: 'LONG' | 'SHORT'
  setupTitle: string
}

type StrategyImportDraft = {
  search: string
  source: 'ALL' | 'MY' | 'MENTOR'
  createNewSetup: boolean
  symbol: string
  direction: 'LONG' | 'SHORT'
  setupTitle: string
}

type WorkspaceTab = 'PLAN' | 'TRIGGERS' | 'EXECUTIONS' | 'REVIEW'
type CompareMode = 'BOTH' | 'MENTOR' | 'MINE' | 'EXECUTIONS'

type FocusLevel = {
  id: string
  label: string
  price?: number | null
  source: 'MENTOR' | 'MINE' | 'EXECUTION'
  kind?: 'LEVEL' | 'ENTRY' | 'SL' | 'TP'
}

const sessionOptions = ['ASIA', 'LONDON', 'NY_AM', 'NY_PM', 'NY'] as const
const marketOptions = ['FOREX', 'CFD', 'FUTURES', 'CRYPTO', 'STOCK', 'OTHER'] as const
const executionStatusOptions: ExecutionTicketStatus[] = ['DRAFT', 'WATCHING', 'READY', 'ACTIVE', 'PARTIAL', 'CLOSED', 'INVALIDATED', 'SKIPPED']

const panelSx = (theme: Theme) => {
  const dark = theme.palette.mode === 'dark'
  return {
    minWidth: 0,
    pb: 3,
    '--ws-panel-radius': '18px',
    '--ws-tile-radius': '14px',
    '--ws-control-radius': '12px',
    '--ws-border': dark ? alpha(theme.palette.divider, 0.9) : alpha(theme.palette.divider, 0.72),
    '--ws-soft': dark ? alpha(theme.palette.common.white, 0.04) : alpha(theme.palette.common.white, 0.86),
    background: dark
      ? `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.background.default, 0.98)} 34%, ${alpha(theme.palette.background.default, 1)} 100%)`
      : `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.background.default, 0.98)} 38%, ${alpha(theme.palette.background.default, 1)} 100%)`,
    '& .ws-panel': {
      border: '1px solid var(--ws-border)',
      borderRadius: 'var(--ws-panel-radius)',
      background: dark
        ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`
        : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
      boxShadow: dark ? '0 18px 44px rgba(0,0,0,0.34)' : '0 18px 44px rgba(15,23,42,0.08)'
    },
    '& .ws-subpanel': {
      border: '1px solid var(--ws-border)',
      borderRadius: 'var(--ws-tile-radius)',
      background: dark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.primary.main, 0.03)
    },
    '& .ws-tag': {
      borderRadius: '999px',
      fontWeight: 700
    },
    '& .ws-textarea textarea': {
      lineHeight: 1.45
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: 'var(--ws-control-radius)',
      backgroundColor: dark ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.white, 0.94)
    }
  }
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function generateId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toTagValue(values?: string[] | null) {
  return (values || []).join(', ')
}

function computeRr(direction: SetupItem['direction'], execution: Pick<ExecutionTicket, 'entryPrice' | 'stopLossPrice' | 'takeProfitPrice'>) {
  const entry = execution.entryPrice
  const stop = execution.stopLossPrice
  const target = execution.takeProfitPrice
  if (entry == null || stop == null || target == null) return null
  const risk = direction === 'LONG' ? entry - stop : stop - entry
  const reward = direction === 'LONG' ? target - entry : entry - target
  if (risk <= 0 || reward <= 0) return null
  return reward / risk
}

function chipColorForReadiness(state: string): ChipProps['color'] {
  if (state === 'READY') return 'success'
  if (state === 'BLOCKED') return 'error'
  return 'warning'
}

function chipColorForSetupStatus(status: SetupStatus): ChipProps['color'] {
  if (status === 'READY' || status === 'TRIGGERED') return 'success'
  if (status === 'EXECUTED' || status === 'CLOSED') return 'primary'
  if (status === 'INVALIDATED' || status === 'ARCHIVED') return 'error'
  if (status === 'SKIPPED') return 'default'
  return 'warning'
}

function chipColorForExecutionStatus(status: ExecutionTicketStatus): ChipProps['color'] {
  if (status === 'READY' || status === 'ACTIVE' || status === 'PARTIAL') return 'success'
  if (status === 'CLOSED') return 'primary'
  if (status === 'INVALIDATED') return 'error'
  if (status === 'SKIPPED') return 'default'
  return 'warning'
}

function formatDirection(direction: 'LONG' | 'SHORT') {
  return direction === 'LONG' ? 'Long' : 'Short'
}

function ensureTicket(ticket: ExecutionTicket | Partial<ExecutionTicket> | undefined, index: number): ExecutionTicket {
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

function ensureExecutionWorkspace(setup: SetupItem): SetupItem {
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

function ensureWorkspace(workspace: LiveWorkspaceResponse): LiveWorkspaceResponse {
  return {
    ...workspace,
    setups: workspace.setups.map((setup) => ensureExecutionWorkspace(setup))
  }
}

function toSessionDraft(session: LiveWorkspaceResponse['session']): SessionDraft {
  return {
    sessionName: session.sessionName || '',
    objective: session.objective || '',
    bias: session.bias || '',
    biasReason: session.biasReason || '',
    narrative: session.narrative || '',
    dailyMaxLoss: session.dailyMaxLoss ?? null,
    maxTrades: session.maxTrades ?? null
  }
}

function toSessionPayload(draft: SessionDraft): SessionWorkspaceRequest {
  return {
    sessionName: draft.sessionName || null,
    objective: draft.objective || null,
    bias: draft.bias || null,
    biasReason: draft.biasReason || null,
    narrative: draft.narrative || null,
    dailyMaxLoss: draft.dailyMaxLoss,
    maxTrades: draft.maxTrades
  }
}

function toSetupPayload(setup: SetupItem): SetupDraftRequest {
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
    mentorReference: normalized.mentorReference || null
  }
}

function extractMentorLevels(mentorPlan: DailyPlan | null | undefined): SetupLevel[] {
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

function mergeMentorLevels(existing: SetupLevel[], mentorPlan: DailyPlan) {
  const mentorLevels = extractMentorLevels(mentorPlan)
  const merged = [...existing]
  mentorLevels.forEach((level) => {
    if (!merged.some((item) => item.label === level.label && item.price === level.price)) {
      merged.push(level)
    }
  })
  return merged
}

function createMentorReference(mentorPlan: DailyPlan): MentorReference {
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

function mentorMatchesSetup(mentorPlan: DailyPlan | null | undefined, setup: SetupItem | null) {
  if (!mentorPlan || !setup) return true
  const mentorSymbol = mentorPlan.tradingViewSymbol?.split(':').pop()?.toUpperCase()
  if (!mentorSymbol) return true
  return mentorSymbol.includes(setup.symbol) || setup.symbol.includes(mentorSymbol)
}

function toTradingViewSymbol(setupSymbol?: string | null, mentorSymbol?: string | null) {
  if (setupSymbol) {
    const normalized = setupSymbol.trim().toUpperCase()
    if (normalized.includes(':')) return normalized
    if (/^[A-Z]{6}$/.test(normalized)) return `OANDA:${normalized}`
    return normalized
  }
  return mentorSymbol || ''
}

function createTimelineEntry(type: string, title: string, body?: string | null, executionId?: string | null, tradeId?: string | null): ReviewTimelineEntry {
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

function markStrategyDirty(setup: SetupItem) {
  if (!setup.strategySnapshot) return setup
  return {
    ...setup,
    strategySnapshot: {
      ...setup.strategySnapshot,
      localEditsApplied: true
    }
  }
}

function appendTimeline(setup: SetupItem, entry: ReviewTimelineEntry) {
  const review = setup.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }
  return {
    ...setup,
    review: {
      ...review,
      timeline: [...(review.timeline || []), entry]
    }
  }
}

function buildStrategySnapshot(strategy: StrategyResponse): SetupStrategySnapshot {
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

function applyStrategyImport(setup: SetupItem, strategy: StrategyResponse): SetupItem {
  const snapshot = buildStrategySnapshot(strategy)
  const imported = ensureExecutionWorkspace({
    ...setup,
    strategyId: strategy.id,
    strategyLabel: strategy.name,
    strategySnapshot: snapshot,
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

function buildTimeline(setup: SetupItem, activity: LiveWorkspaceResponse['activity']) {
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

function focusLevelsForSetup(setup: SetupItem | null, mentorPlan: DailyPlan | null | undefined, compareMode: CompareMode): FocusLevel[] {
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

function SurfaceMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Box className="ws-subpanel" sx={{ p: 1.75 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
        {value}
      </Typography>
    </Box>
  )
}

export default function SessionPage() {
  const { user } = useAuth()
  const { language, t } = useI18n()
  const queryClient = useQueryClient()
  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'

  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)
  const [setupDraft, setSetupDraft] = useState<SetupItem | null>(null)
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>('PLAN')
  const [compareMode, setCompareMode] = useState<CompareMode>('BOTH')
  const [showLevels, setShowLevels] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mentorExpanded, setMentorExpanded] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false)
  const [focusedLevelId, setFocusedLevelId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [createSetupDraft, setCreateSetupDraft] = useState<CreateSetupDraft>({ symbol: '', direction: 'LONG', setupTitle: '' })
  const [importDraft, setImportDraft] = useState<StrategyImportDraft>({
    search: '',
    source: 'ALL',
    createNewSetup: false,
    symbol: '',
    direction: 'LONG',
    setupTitle: ''
  })
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null)

  const sessionSignatureRef = useRef('')
  const setupSignatureRef = useRef('')

  const objectiveOptions = [
    { value: 'A_PLUS_ONLY', label: t('today.session.lockIn.objectiveAPlus') },
    { value: 'ONE_TRADE_MAX', label: t('today.session.lockIn.objectiveOne') },
    { value: 'TWO_TRADES_MAX', label: t('today.session.lockIn.objectiveTwo') }
  ]

  const workspaceQuery = useQuery({
    queryKey: ['liveWorkspace'],
    queryFn: async () => ensureWorkspace(await getSessionWorkspace())
  })

  const mentorPlanQuery = useQuery({
    queryKey: ['todayMentorPlanWorkspace', workspaceQuery.data?.session.tradingDate || '', timezone],
    queryFn: () => fetchTodayMentorPlan({
      date: workspaceQuery.data?.session.tradingDate || '',
      tz: timezone
    }),
    enabled: Boolean(workspaceQuery.data?.session.tradingDate)
  })

  const strategiesQuery = useQuery({
    queryKey: ['strategies', 'session-import'],
    queryFn: () => listStrategies({ includeArchived: false }),
    enabled: strategyDialogOpen
  })

  const deferredChartSymbol = useDeferredValue(toTradingViewSymbol(
    setupDraft?.symbol || workspaceQuery.data?.setups.find((item) => item.id === selectedSetupId)?.symbol || null,
    mentorPlanQuery.data?.tradingViewSymbol || null
  ))
  const deferredChartInterval = useDeferredValue(mentorPlanQuery.data?.tradingViewInterval || '15')

  const applyWorkspace = (workspace: LiveWorkspaceResponse, preferredSetupId?: string | null) => {
    const normalized = ensureWorkspace(workspace)
    queryClient.setQueryData(['liveWorkspace'], normalized)
    const nextSelectedSetupId = preferredSetupId && normalized.setups.some((item) => item.id === preferredSetupId)
      ? preferredSetupId
      : normalized.activeSetupId && normalized.setups.some((item) => item.id === normalized.activeSetupId)
        ? normalized.activeSetupId
        : normalized.setups[0]?.id || null
    startTransition(() => {
      setSelectedSetupId(nextSelectedSetupId)
    })
  }

  const updateSessionMutation = useMutation({
    mutationFn: (payload: { sessionId: string; data: SessionWorkspaceRequest; signature: string }) =>
      updateSessionWorkspace(payload.sessionId, payload.data),
    onSuccess: (workspace, variables) => {
      sessionSignatureRef.current = variables.signature
      applyWorkspace(workspace, selectedSetupId)
    },
    onError: (error) => {
      const apiError = error as ApiError
      setFeedback(apiError.message || 'Could not save session settings.')
    }
  })

  const updateSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string; data: SetupDraftRequest; signature: string }) =>
      updateSetupCandidate(payload.sessionId, payload.setupId, payload.data),
    onSuccess: (workspace, variables) => {
      setupSignatureRef.current = variables.signature
      applyWorkspace(workspace, variables.setupId)
    },
    onError: (error) => {
      const apiError = error as ApiError
      setFeedback(apiError.message || 'Could not save setup changes.')
    }
  })

  const createSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; data: SetupDraftRequest }) =>
      createSetupCandidate(payload.sessionId, payload.data),
    onSuccess: (workspace) => {
      applyWorkspace(workspace, workspace.setups[workspace.setups.length - 1]?.id || workspace.activeSetupId || null)
      setCreateDialogOpen(false)
      setCreateSetupDraft({ symbol: '', direction: 'LONG', setupTitle: '' })
      setFeedback('Setup added to the workspace.')
    },
    onError: (error) => {
      const apiError = error as ApiError
      setFeedback(apiError.message || 'Could not create setup.')
    }
  })

  const duplicateSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string }) =>
      duplicateSetupCandidate(payload.sessionId, payload.setupId),
    onSuccess: (workspace) => {
      applyWorkspace(workspace, workspace.setups[workspace.setups.length - 1]?.id || workspace.activeSetupId || null)
      setFeedback('Setup duplicated.')
    }
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string; status: SetupStatus }) =>
      updateSetupCandidateStatus(payload.sessionId, payload.setupId, payload.status),
    onSuccess: (workspace, variables) => {
      applyWorkspace(workspace, variables.setupId)
      setFeedback(`Setup marked ${variables.status.toLowerCase().replaceAll('_', ' ')}.`)
    },
    onError: (error) => {
      const apiError = error as ApiError
      setFeedback(apiError.message || 'Could not change setup status.')
    }
  })

  const selectSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string | null }) =>
      selectActiveSetupCandidate(payload.sessionId, payload.setupId),
    onSuccess: (workspace, variables) => {
      applyWorkspace(workspace, variables.setupId)
    }
  })

  const startTradeMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string; executionId?: string | null }) =>
      startTradeFromSetupCandidate(payload.sessionId, payload.setupId, payload.executionId),
    onSuccess: (workspace, variables) => {
      applyWorkspace(workspace, variables.setupId)
      setFeedback('Trade started from selected execution.')
    },
    onError: (error) => {
      const apiError = error as ApiError
      setFeedback(apiError.message || 'Could not start trade.')
    }
  })

  useEffect(() => {
    const workspace = workspaceQuery.data
    if (!workspace) return
    const nextSelectedSetupId = selectedSetupId && workspace.setups.some((item) => item.id === selectedSetupId)
      ? selectedSetupId
      : workspace.activeSetupId && workspace.setups.some((item) => item.id === workspace.activeSetupId)
        ? workspace.activeSetupId
        : workspace.setups[0]?.id || null

    if (nextSelectedSetupId !== selectedSetupId) {
      startTransition(() => {
        setSelectedSetupId(nextSelectedSetupId)
      })
    }

    const nextSessionDraft = toSessionDraft(workspace.session)
    sessionSignatureRef.current = JSON.stringify(toSessionPayload(nextSessionDraft))
    setSessionDraft(nextSessionDraft)

    const nextSetup = workspace.setups.find((item) => item.id === nextSelectedSetupId) || null
    if (nextSetup) {
      const normalized = ensureExecutionWorkspace(nextSetup)
      setupSignatureRef.current = JSON.stringify(toSetupPayload(normalized))
      setSetupDraft(normalized)
    } else {
      setupSignatureRef.current = ''
      setSetupDraft(null)
    }
  }, [workspaceQuery.data, selectedSetupId])

  useEffect(() => {
    const workspace = workspaceQuery.data
    if (!workspace || !sessionDraft) return
    const signature = JSON.stringify(toSessionPayload(sessionDraft))
    if (signature === sessionSignatureRef.current) return
    const timer = window.setTimeout(() => {
      updateSessionMutation.mutate({
        sessionId: workspace.session.id,
        data: toSessionPayload(sessionDraft),
        signature
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [sessionDraft, updateSessionMutation, workspaceQuery.data])

  useEffect(() => {
    const workspace = workspaceQuery.data
    if (!workspace || !setupDraft) return
    const signature = JSON.stringify(toSetupPayload(setupDraft))
    if (signature === setupSignatureRef.current) return
    const timer = window.setTimeout(() => {
      updateSetupMutation.mutate({
        sessionId: workspace.session.id,
        setupId: setupDraft.id,
        data: toSetupPayload(setupDraft),
        signature
      })
    }, 550)
    return () => window.clearTimeout(timer)
  }, [setupDraft, updateSetupMutation, workspaceQuery.data])

  const workspace = workspaceQuery.data
  const selectedSetup = setupDraft || workspace?.setups.find((item) => item.id === selectedSetupId) || null
  const selectedSetupIsPersisted = Boolean(selectedSetup && workspace?.setups.some((item) => item.id === selectedSetup.id))
  const selectedExecution = selectedSetup?.executions.tickets.find((ticket) => ticket.id === selectedSetup.executions.activeExecutionId)
    || selectedSetup?.executions.tickets[0]
    || null
  const mentorRelevant = mentorMatchesSetup(mentorPlanQuery.data, selectedSetup)
  const visibleLevels = useMemo(
    () => (selectedSetup ? focusLevelsForSetup(selectedSetup, mentorRelevant ? mentorPlanQuery.data : null, compareMode) : []),
    [compareMode, mentorPlanQuery.data, mentorRelevant, selectedSetup]
  )
  const focusedLevel = visibleLevels.find((level) => level.id === focusedLevelId) || visibleLevels[0] || null
  const selectedStrategy = useMemo(() => {
    const all = [...(strategiesQuery.data?.myStrategies || []), ...(strategiesQuery.data?.mentorStrategies || [])]
    return all.find((item) => item.id === selectedStrategyId) || null
  }, [selectedStrategyId, strategiesQuery.data?.mentorStrategies, strategiesQuery.data?.myStrategies])

  useEffect(() => {
    if (focusedLevel && focusedLevel.id !== focusedLevelId) {
      setFocusedLevelId(focusedLevel.id)
    }
    if (!focusedLevel) {
      setFocusedLevelId(null)
    }
  }, [focusedLevel, focusedLevelId])

  const strategyList = useMemo(() => {
    const items = [...(strategiesQuery.data?.myStrategies || []), ...(strategiesQuery.data?.mentorStrategies || [])]
    const term = importDraft.search.trim().toLowerCase()
    return items.filter((item) => {
      if (importDraft.source !== 'ALL' && item.source !== importDraft.source) {
        return false
      }
      if (!term) return true
      return [
        item.name,
        item.model,
        ...(item.entryConditions || []),
        ...(item.tags || [])
      ].some((value) => value?.toLowerCase().includes(term))
    })
  }, [importDraft.search, importDraft.source, strategiesQuery.data?.mentorStrategies, strategiesQuery.data?.myStrategies])

  const autoSaveState = updateSetupMutation.isPending || updateSessionMutation.isPending
    ? t('today.session.workspace.autoSaving')
    : t('today.session.workspace.saved')

  const updateSelectedSetup = (
    updater: (setup: SetupItem) => SetupItem,
    options: { markStrategyDirty?: boolean } = { markStrategyDirty: true }
  ) => {
    setSetupDraft((current) => {
      if (!current) return current
      let next = ensureExecutionWorkspace(updater(current))
      if (options.markStrategyDirty) {
        next = markStrategyDirty(next)
      }
      return next
    })
  }

  const updateActiveExecution = (updater: (ticket: ExecutionTicket) => ExecutionTicket) => {
    updateSelectedSetup((current) => {
      const activeId = current.executions.activeExecutionId || current.executions.tickets[0]?.id
      const tickets = current.executions.tickets.map((ticket, index) => {
        if (ticket.id !== activeId) return ticket
        return ensureTicket({
          ...updater(ticket),
          updatedAt: new Date().toISOString()
        }, index)
      })
      return ensureExecutionWorkspace({
        ...current,
        executions: {
          ...current.executions,
          tickets
        }
      })
    })
  }

  const selectExecution = (executionId: string) => {
    updateSelectedSetup((current) => ensureExecutionWorkspace({
      ...current,
      executions: {
        ...current.executions,
        activeExecutionId: executionId
      }
    }), { markStrategyDirty: false })
    setSelectedTab('EXECUTIONS')
  }

  const addExecution = (cloneFrom?: ExecutionTicket | null) => {
    updateSelectedSetup((current) => {
      const ticket = ensureTicket(cloneFrom
        ? {
          ...cloneFrom,
          id: generateId(),
          label: `${cloneFrom.label} Copy`,
          status: 'DRAFT',
          linkedTradeId: null,
          startedAt: null,
          closedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
        : {
          id: generateId(),
          label: `Execution ${current.executions.tickets.length + 1}`,
          status: 'DRAFT',
          createdAt: new Date().toISOString()
        }, current.executions.tickets.length)
      return appendTimeline(ensureExecutionWorkspace({
        ...current,
        executions: {
          activeExecutionId: ticket.id,
          tickets: [...current.executions.tickets, ticket]
        }
      }), createTimelineEntry('execution_created', cloneFrom ? 'Execution cloned' : 'Execution created', ticket.label, ticket.id))
    })
    setSelectedTab('EXECUTIONS')
  }

  const applyFocusedPrice = (field: 'entryPrice' | 'stopLossPrice' | 'takeProfitPrice') => {
    if (!focusedLevel?.price) return
    updateActiveExecution((ticket) => ({
      ...ticket,
      [field]: focusedLevel.price
    }))
  }

  const handleSelectSetup = (setupId: string) => {
    startTransition(() => {
      setSelectedSetupId(setupId)
    })
    if (workspace && setupId !== workspace.activeSetupId) {
      selectSetupMutation.mutate({ sessionId: workspace.session.id, setupId })
    }
  }

  const handleCreateSetup = () => {
    if (!workspace) return
    createSetupMutation.mutate({
      sessionId: workspace.session.id,
      data: {
        symbol: createSetupDraft.symbol.trim().toUpperCase(),
        direction: createSetupDraft.direction,
        setupTitle: createSetupDraft.setupTitle.trim() || createSetupDraft.symbol.trim().toUpperCase()
      }
    })
  }

  const handleAddMentorContext = () => {
    if (!selectedSetup || !mentorPlanQuery.data) return
    updateSelectedSetup((current) => appendTimeline(ensureExecutionWorkspace({
      ...current,
      mentorReference: createMentorReference(mentorPlanQuery.data as DailyPlan),
      levels: mergeMentorLevels(current.levels, mentorPlanQuery.data as DailyPlan),
      context: {
        ...current.context,
        narrative: current.context.narrative || mentorPlanQuery.data?.summary || mentorPlanQuery.data?.biasSummary || '',
        liquidityNotes: current.context.liquidityNotes || mentorPlanQuery.data?.liquidityNarrative || ''
      }
    }), createTimelineEntry('mentor_applied', 'Mentor context applied', mentorPlanQuery.data.title)), { markStrategyDirty: false })
    setFeedback('Mentor context copied into the selected setup.')
  }

  const handleImportStrategy = () => {
    if (!workspace || !selectedStrategy) return
    if (!selectedSetup || importDraft.createNewSetup) {
      createSetupMutation.mutate({
        sessionId: workspace.session.id,
        data: toSetupPayload(applyStrategyImport(ensureExecutionWorkspace({
          id: `draft-${generateId()}`,
          symbol: importDraft.symbol.trim().toUpperCase(),
          direction: importDraft.direction,
          market: 'FOREX',
          tradeSession: selectedSetup?.tradeSession || null,
          strategyId: null,
          strategyLabel: '',
          setupTitle: importDraft.setupTitle.trim() || selectedStrategy.name,
          biasAlignment: selectedSetup?.biasAlignment || '',
          status: 'DRAFT',
          linkedTradeId: null,
          readiness: selectedSetup?.readiness || workspace.setups[0]?.readiness || {
            score: 0,
            state: 'INCOMPLETE',
            summary: 'Missing',
            missingItems: [],
            blockers: [],
            steps: []
          },
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
            entryZone: '',
            rrEstimate: null,
            notes: ''
          } as SetupTrigger,
          execution: {
            activeExecutionId: null,
            entryPrice: null,
            stopLossPrice: null,
            takeProfitPrice: null,
            riskAmount: null,
            quantity: null,
            invalidation: '',
            whyWrong: '',
            initialNotes: ''
          } as SetupExecution,
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
          mentorReference: selectedSetup?.mentorReference || null,
          sortOrder: workspace.setups.length,
          createdAt: null,
          updatedAt: null
        } as SetupItem), selectedStrategy))
      })
      setFeedback('Strategy imported into a new setup.')
    } else {
      updateSelectedSetup((current) => applyStrategyImport(current, selectedStrategy), { markStrategyDirty: false })
      setFeedback('Strategy imported into the selected setup.')
    }
    setStrategyDialogOpen(false)
  }

  if (workspaceQuery.isLoading) {
    return <LoadingState rows={10} height={34} />
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    const apiError = workspaceQuery.error as ApiError
    return <Alert severity="error">{apiError?.message || 'Could not load the live workspace.'}</Alert>
  }

  const currentWorkspace = workspace
  const sessionLockStep = currentWorkspace.session.readiness.steps.find((step) => step.key === 'lock')
  const setupBlockers = selectedSetup?.readiness.blockers || []
  const combinedBlockers = Array.from(new Set([
    ...setupBlockers,
    ...(!currentWorkspace.session.lockedInAt ? ['session lock'] : [])
  ]))
  const activeRr = selectedSetup && selectedExecution ? computeRr(selectedSetup.direction, selectedExecution) : null
  const timeline = selectedSetup ? buildTimeline(selectedSetup, currentWorkspace.activity) : []
  const startActionLooksReady = selectedSetup && combinedBlockers.length === 0 && selectedExecution
  const strategyName = selectedSetup?.strategySnapshot?.name || selectedSetup?.strategyLabel || '—'
  const setupCount = currentWorkspace.setups.length

  return (
    <Stack spacing={2.5} sx={(theme) => panelSx(theme)}>
      <Card className="ws-panel" sx={{ position: 'sticky', top: 16, zIndex: 6 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip className="ws-tag" size="small" color="primary" label={t('today.session.title')} />
                  <Chip
                    className="ws-tag"
                    size="small"
                    color={currentWorkspace.session.lockedInAt ? 'success' : 'default'}
                    icon={currentWorkspace.session.lockedInAt ? <LockRoundedIcon /> : <LockOpenRoundedIcon />}
                    label={currentWorkspace.session.lockedInAt ? t('today.session.workspace.locked') : t('today.session.workspace.unlocked')}
                  />
                  <Chip className="ws-tag" size="small" variant="outlined" label={formatDate(currentWorkspace.session.tradingDate, timezone)} />
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.04em' }}>
                  {sessionDraft?.sessionName || t('today.session.workspace.today')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('today.session.workstation.header.flow')}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                <Button variant="outlined" startIcon={<ImportExportRoundedIcon />} onClick={() => setStrategyDialogOpen(true)}>
                  {t('today.session.workstation.header.importStrategy')}
                </Button>
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                  {t('today.session.workspace.actions.addSetup')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={currentWorkspace.session.lockedInAt ? <LockOpenRoundedIcon /> : <LockRoundedIcon />}
                  onClick={() => updateSessionMutation.mutate({
                    sessionId: currentWorkspace.session.id,
                    data: {
                      ...toSessionPayload(sessionDraft || toSessionDraft(currentWorkspace.session)),
                      lockSession: !Boolean(currentWorkspace.session.lockedInAt)
                    },
                    signature: sessionSignatureRef.current
                  })}
                >
                  {currentWorkspace.session.lockedInAt ? t('today.session.workspace.actions.unlockSession') : t('today.session.workspace.actions.lockSession')}
                </Button>
                <Button
                  variant={startActionLooksReady ? 'contained' : 'outlined'}
                  color="secondary"
                  startIcon={startActionLooksReady ? <PlayArrowRoundedIcon /> : <AddRoundedIcon />}
                  onClick={() => {
                    if (startActionLooksReady && selectedSetup && selectedExecution) {
                      startTradeMutation.mutate({
                        sessionId: currentWorkspace.session.id,
                        setupId: selectedSetup.id,
                        executionId: selectedExecution.id
                      })
                      return
                    }
                    addExecution()
                  }}
                  disabled={startTradeMutation.isPending || !selectedSetup}
                >
                  {startActionLooksReady ? t('today.session.workstation.header.startTrade') : t('today.session.workstation.header.newExecution')}
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
                gap: 1.25
              }}
            >
              <SurfaceMetric label={t('today.session.workspace.metrics.maxLoss')} value={formatCurrency(currentWorkspace.session.quickStats.maxLoss, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workspace.metrics.riskUsed')} value={formatCurrency(currentWorkspace.session.quickStats.riskUsed, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workstation.header.setupCount')} value={setupCount} />
              <SurfaceMetric label={t('today.session.workspace.metrics.trades')} value={currentWorkspace.session.quickStats.tradesTaken} />
              <SurfaceMetric label={t('today.session.workspace.metrics.realizedPnl')} value={formatSignedCurrency(currentWorkspace.session.quickStats.realizedPnl, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workstation.header.selectedStrategy')} value={strategyName} />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {feedback && (
        <Alert severity="info" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '280px minmax(0, 1.15fr) 440px' },
          gap: 2.5,
          alignItems: 'start'
        }}
      >
        <Card className="ws-panel" component="aside" sx={{ position: { xl: 'sticky' }, top: { xl: 104 } }}>
          <CardContent sx={{ p: 2.25 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack spacing={0.5}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {t('today.session.workstation.mentor.kicker')}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t('today.session.workstation.mentor.title')}
                  </Typography>
                </Stack>
                <Button size="small" onClick={() => setMentorExpanded((value) => !value)}>
                  {mentorExpanded ? t('today.session.workstation.mentor.collapse') : t('today.session.workstation.mentor.expand')}
                </Button>
              </Stack>

              {mentorPlanQuery.isLoading ? (
                <LoadingState rows={5} height={18} />
              ) : mentorPlanQuery.data && mentorRelevant ? (
                <>
                  <Box className="ws-subpanel" sx={{ p: 1.75 }}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {mentorPlanQuery.data.title}
                      </Typography>
                      <Chip size="small" className="ws-tag" label={mentorPlanQuery.data.biasSummary || t('today.mentor.emptySummary')} />
                      <Typography variant="body2" color="text.secondary">
                        {mentorPlanQuery.data.summary || mentorPlanQuery.data.liquidityNarrative || mentorPlanQuery.data.executionRules || '—'}
                      </Typography>
                    </Stack>
                  </Box>
                  <Collapse in={mentorExpanded}>
                    <Stack spacing={1.25}>
                      <Box className="ws-subpanel" sx={{ p: 1.75 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                          {t('today.session.workstation.mentor.reference')}
                        </Typography>
                        <Stack spacing={0.75}>
                          <Typography variant="body2"><strong>{t('today.session.workstation.mentor.scenario')}</strong> {mentorPlanQuery.data.executionRules || '—'}</Typography>
                          <Typography variant="body2"><strong>{t('today.session.workstation.mentor.invalidation')}</strong> {mentorPlanQuery.data.alternativeScenario || '—'}</Typography>
                          <Typography variant="body2"><strong>{t('today.session.workstation.mentor.risk')}</strong> {mentorPlanQuery.data.riskNote || '—'}</Typography>
                        </Stack>
                      </Box>
                      <Box className="ws-subpanel" sx={{ p: 1.75 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                          {t('today.session.workstation.mentor.levels')}
                        </Typography>
                        <Stack spacing={0.75}>
                          {(mentorPlanQuery.data.keyLevels || []).length > 0 ? (
                            (mentorPlanQuery.data.keyLevels || []).map((item) => (
                              <Chip key={item} size="small" variant="outlined" label={item} />
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Collapse>
                  <Button variant="outlined" startIcon={<SchoolRoundedIcon />} disabled={!selectedSetup} onClick={handleAddMentorContext}>
                    {t('today.session.workstation.mentor.apply')}
                  </Button>
                </>
              ) : (
                <EmptyState
                  title={t('today.session.workstation.mentor.emptyTitle')}
                  description={selectedSetup ? t('today.session.workstation.mentor.emptyBody') : t('today.session.workstation.mentor.noSetup')}
                  icon={<SchoolRoundedIcon fontSize="inherit" />}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2.5}>
          <Card className="ws-panel" component="section" sx={{ position: { xl: 'sticky' }, top: { xl: 104 }, zIndex: 2 }}>
            <CardContent sx={{ p: 2.25 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Stack spacing={0.75}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {t('today.session.workstation.chart.kicker')}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      <CandlestickChartRoundedIcon color="primary" />
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {t('today.session.workstation.chart.title')}
                      </Typography>
                      {selectedSetup ? <Chip size="small" color={chipColorForSetupStatus(selectedSetup.status)} label={selectedSetup.setupTitle} /> : null}
                      {selectedExecution ? <Chip size="small" color={chipColorForExecutionStatus(selectedExecution.status)} label={selectedExecution.label} /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {t('today.session.workstation.chart.subtitle')}
                    </Typography>
                  </Stack>
                  <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={compareMode}
                      onChange={(_, value: CompareMode | null) => value && setCompareMode(value)}
                    >
                      <ToggleButton value="MENTOR">{t('today.session.workstation.chart.mentorOnly')}</ToggleButton>
                      <ToggleButton value="MINE">{t('today.session.workstation.chart.mineOnly')}</ToggleButton>
                      <ToggleButton value="BOTH">{t('today.session.workstation.chart.both')}</ToggleButton>
                      <ToggleButton value="EXECUTIONS">{t('today.session.workstation.chart.executionsOnly')}</ToggleButton>
                    </ToggleButtonGroup>
                    <Stack direction="row" spacing={1}>
                      <FormControlLabel
                        control={<Switch checked={showLevels} onChange={(event) => setShowLevels(event.target.checked)} />}
                        label={t('today.session.workstation.chart.levelsToggle')}
                      />
                      <FormControlLabel
                        control={<Switch checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} />}
                        label={t('today.session.workstation.chart.labelsToggle')}
                      />
                    </Stack>
                  </Stack>
                </Stack>

                <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" className="ws-tag" label={selectedSetup?.symbol || '—'} />
                      {selectedSetup?.tradeSession ? <Chip size="small" variant="outlined" label={selectedSetup.tradeSession} /> : null}
                      {selectedSetup ? <Chip size="small" variant="outlined" label={formatDirection(selectedSetup.direction)} /> : null}
                      {selectedSetup?.strategySnapshot?.name ? (
                        <Chip size="small" variant="outlined" label={`${t('today.session.workstation.chart.strategy')}: ${selectedSetup.strategySnapshot.name}`} />
                      ) : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {autoSaveState}
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ minHeight: 620, borderRadius: 'var(--ws-panel-radius)', overflow: 'hidden', border: '1px solid var(--ws-border)', backgroundColor: '#050608' }}>
                  {deferredChartSymbol ? (
                    <TradingViewWidget
                      symbol={deferredChartSymbol}
                      interval={deferredChartInterval}
                      minHeight={620}
                      fallbackMessage={t('today.mentor.liveChartFallback')}
                      fallbackLinkLabel={t('today.mentor.openOnTradingView')}
                    />
                  ) : (
                    <EmptyState
                      sx={{ minHeight: 620, border: 0 }}
                      title={t('today.session.workstation.chart.emptyTitle')}
                      description={t('today.session.workstation.chart.emptyBody')}
                      icon={<CandlestickChartRoundedIcon fontSize="inherit" />}
                    />
                  )}
                </Box>

                <Box
                  className="ws-subpanel"
                  sx={{
                    p: 1.5,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 280px' },
                    gap: 1.5
                  }}
                >
                  <Stack spacing={1.2}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {t('today.session.workstation.chart.focus')}
                    </Typography>
                    {showLevels ? (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {visibleLevels.map((level) => (
                          <Chip
                            key={level.id}
                            clickable
                            color={focusedLevel?.id === level.id ? 'primary' : 'default'}
                            variant={level.source === 'MENTOR' ? 'outlined' : 'filled'}
                            label={showLabels
                              ? `${level.label}${level.price != null ? ` • ${formatNumber(level.price, 5)}` : ''}`
                              : level.price != null ? formatNumber(level.price, 5) : level.label}
                            onClick={() => setFocusedLevelId(level.id)}
                          />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('today.session.workstation.chart.levelsHidden')}
                      </Typography>
                    )}
                  </Stack>

                  <Box className="ws-subpanel" sx={{ p: 1.25 }}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t('today.session.workstation.chart.focusedLevel')}
                      </Typography>
                      {focusedLevel ? (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{focusedLevel.label}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {focusedLevel.price != null ? formatNumber(focusedLevel.price, 5) : '—'} • {focusedLevel.source}
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button size="small" startIcon={<PriceCheckRoundedIcon />} onClick={() => applyFocusedPrice('entryPrice')} disabled={!focusedLevel.price}>
                              {t('today.session.workstation.chart.useForEntry')}
                            </Button>
                            <Button size="small" onClick={() => applyFocusedPrice('stopLossPrice')} disabled={!focusedLevel.price}>
                              {t('today.session.workstation.chart.useForStop')}
                            </Button>
                            <Button size="small" onClick={() => applyFocusedPrice('takeProfitPrice')} disabled={!focusedLevel.price}>
                              {t('today.session.workstation.chart.useForTarget')}
                            </Button>
                          </Stack>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {t('today.session.workstation.chart.noFocus')}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack spacing={2.5}>
          <Card className="ws-panel" component="section" sx={{ position: { xl: 'sticky' }, top: { xl: 104 }, maxHeight: { xl: 'calc(100vh - 128px)' }, overflow: 'auto' }}>
            <CardContent sx={{ p: 2.25 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                  <Stack spacing={0.5}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {t('today.session.workstation.personal.kicker')}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {t('today.session.workstation.personal.title')}
                    </Typography>
                  </Stack>
                  <FormControlLabel
                    control={<Switch checked={showAdvanced} onChange={(event) => setShowAdvanced(event.target.checked)} />}
                    label={t('today.session.workstation.personal.advancedToggle')}
                  />
                </Stack>

                <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t('today.session.workstation.personal.sessionControl')}
                      </Typography>
                      <Chip size="small" color={chipColorForReadiness(currentWorkspace.session.readiness.state)} label={`${currentWorkspace.session.readiness.score}%`} />
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                      <TextField
                        label={t('today.session.workstation.fields.sessionName')}
                        value={sessionDraft?.sessionName || ''}
                        onChange={(event) => setSessionDraft((current) => current ? { ...current, sessionName: event.target.value } : current)}
                      />
                      <FormControl fullWidth>
                        <InputLabel id="session-objective-label">{t('today.session.workstation.fields.objective')}</InputLabel>
                        <Select
                          labelId="session-objective-label"
                          label={t('today.session.workstation.fields.objective')}
                          value={sessionDraft?.objective || ''}
                          onChange={(event) => setSessionDraft((current) => current ? { ...current, objective: event.target.value } : current)}
                        >
                          {objectiveOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth>
                        <InputLabel id="session-bias-label">{t('today.session.workstation.fields.bias')}</InputLabel>
                        <Select
                          labelId="session-bias-label"
                          label={t('today.session.workstation.fields.bias')}
                          value={sessionDraft?.bias || ''}
                          onChange={(event) => setSessionDraft((current) => current ? { ...current, bias: event.target.value } : current)}
                        >
                          <MenuItem value="LONG">Long</MenuItem>
                          <MenuItem value="SHORT">Short</MenuItem>
                          <MenuItem value="NEUTRAL">{t('today.session.lockIn.neutral')}</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label={t('today.session.workstation.fields.biasReason')}
                        value={sessionDraft?.biasReason || ''}
                        onChange={(event) => setSessionDraft((current) => current ? { ...current, biasReason: event.target.value } : current)}
                      />
                      <TextField
                        label={t('today.session.workstation.fields.dailyMaxLoss')}
                        value={sessionDraft?.dailyMaxLoss ?? ''}
                        type="number"
                        onChange={(event) => setSessionDraft((current) => current ? { ...current, dailyMaxLoss: parseNumberInput(event.target.value) } : current)}
                      />
                      <TextField
                        label={t('today.session.workstation.fields.maxTrades')}
                        value={sessionDraft?.maxTrades ?? ''}
                        type="number"
                        onChange={(event) => setSessionDraft((current) => current ? { ...current, maxTrades: parseNumberInput(event.target.value) } : current)}
                      />
                    </Box>
                    <TextField
                      className="ws-textarea"
                      label={t('today.session.workstation.fields.sessionNarrative')}
                      value={sessionDraft?.narrative || ''}
                      onChange={(event) => setSessionDraft((current) => current ? { ...current, narrative: event.target.value } : current)}
                      multiline
                      minRows={3}
                    />
                  </Stack>
                </Box>

                <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t('today.session.workstation.personal.setupNavigator')}
                      </Typography>
                      <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                        {t('today.session.workspace.actions.addNewSetup')}
                      </Button>
                    </Stack>
                    {currentWorkspace.setups.length > 0 ? (
                      currentWorkspace.setups.map((setup) => (
                        <Box
                          key={setup.id}
                          className="ws-subpanel"
                          sx={{
                            p: 1.25,
                            borderColor: selectedSetup?.id === setup.id ? 'primary.main' : 'var(--ws-border)',
                            boxShadow: selectedSetup?.id === setup.id ? (theme) => `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}` : 'none'
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Stack spacing={0.25}>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>{setup.setupTitle}</Typography>
                                <Typography variant="caption" color="text.secondary">{setup.symbol} • {formatDirection(setup.direction)}</Typography>
                              </Stack>
                              <SetupStatusChip status={setup.status} />
                            </Stack>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Chip size="small" variant="outlined" label={`${setup.executions.tickets.length} ${t('today.session.workstation.personal.executionCount')}`} />
                              <Chip size="small" variant="outlined" label={`${setup.readiness.score}%`} />
                              {setup.strategySnapshot?.name ? <Chip size="small" variant="outlined" label={setup.strategySnapshot.name} /> : null}
                            </Stack>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Button size="small" variant={selectedSetup?.id === setup.id ? 'contained' : 'text'} onClick={() => handleSelectSetup(setup.id)}>
                                {t('today.session.workstation.personal.selectSetup')}
                              </Button>
                              <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => duplicateSetupMutation.mutate({ sessionId: currentWorkspace.session.id, setupId: setup.id })}>
                                {t('today.session.workstation.personal.duplicateSetup')}
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      ))
                    ) : (
                      <EmptyState
                        title={t('today.session.workstation.personal.emptyTitle')}
                        description={t('today.session.workstation.personal.emptyBody')}
                        icon={<FlagRoundedIcon fontSize="inherit" />}
                        action={(
                          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                            {t('today.session.workspace.actions.addSetup')}
                          </Button>
                        )}
                      />
                    )}
                  </Stack>
                </Box>

                {selectedSetup ? (
                  <>
                    <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                      <Stack spacing={1.25}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {t('today.session.workstation.personal.readiness')}
                          </Typography>
                          <ReadinessChip state={selectedSetup.readiness.state} score={selectedSetup.readiness.score} />
                        </Stack>
                        <LinearProgress variant="determinate" value={selectedSetup.readiness.score} />
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                          {selectedSetup.readiness.steps.map((step) => (
                            <Box key={step.key} className="ws-subpanel" sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{step.label}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{step.state}</Typography>
                              <Typography variant="caption" color="text.secondary">{step.summary}</Typography>
                            </Box>
                          ))}
                          <Box className="ws-subpanel" sx={{ p: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t('today.session.workstation.personal.sessionLock')}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{sessionLockStep?.state || 'INCOMPLETE'}</Typography>
                            <Typography variant="caption" color="text.secondary">{sessionLockStep?.summary || currentWorkspace.session.readiness.summary}</Typography>
                          </Box>
                        </Box>
                        {combinedBlockers.length > 0 ? (
                          <Alert severity="warning">
                            <AlertTitle>{t('today.session.workstation.personal.blockedBy')}</AlertTitle>
                            {combinedBlockers.join(', ')}
                          </Alert>
                        ) : (
                          <Alert severity="success">{t('today.session.workstation.personal.readyToExecute')}</Alert>
                        )}
                      </Stack>
                    </Box>

                    <Tabs value={selectedTab} onChange={(_, value: WorkspaceTab) => setSelectedTab(value)} variant="fullWidth">
                      <Tab value="PLAN" label={t('today.session.workstation.tabs.plan')} />
                      <Tab value="TRIGGERS" label={t('today.session.workstation.tabs.triggers')} />
                      <Tab value="EXECUTIONS" label={t('today.session.workstation.tabs.executions')} />
                      <Tab value="REVIEW" label={t('today.session.workstation.tabs.review')} />
                    </Tabs>

                    {selectedTab === 'PLAN' ? (
                      <Stack spacing={2}>
                        <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Stack spacing={0.5}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t('today.session.workstation.plan.title')}</Typography>
                                <Typography variant="body2" color="text.secondary">{t('today.session.workstation.plan.subtitle')}</Typography>
                              </Stack>
                              <Button size="small" startIcon={<ImportExportRoundedIcon />} onClick={() => setStrategyDialogOpen(true)}>
                                {t('today.session.workstation.header.importStrategy')}
                              </Button>
                            </Stack>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                              <TextField
                                label={t('today.session.workstation.fields.setupTitle')}
                                value={selectedSetup.setupTitle}
                                onChange={(event) => updateSelectedSetup((current) => ({ ...current, setupTitle: event.target.value }))}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.symbol')}
                                value={selectedSetup.symbol}
                                onChange={(event) => updateSelectedSetup((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                              />
                              <FormControl fullWidth>
                                <InputLabel id="setup-direction-label">{t('today.session.workstation.fields.direction')}</InputLabel>
                                <Select
                                  labelId="setup-direction-label"
                                  label={t('today.session.workstation.fields.direction')}
                                  value={selectedSetup.direction}
                                  onChange={(event) => updateSelectedSetup((current) => ({ ...current, direction: event.target.value as SetupItem['direction'] }))}
                                >
                                  <MenuItem value="LONG">Long</MenuItem>
                                  <MenuItem value="SHORT">Short</MenuItem>
                                </Select>
                              </FormControl>
                              <FormControl fullWidth>
                                <InputLabel id="setup-market-label">{t('today.session.workstation.fields.market')}</InputLabel>
                                <Select
                                  labelId="setup-market-label"
                                  label={t('today.session.workstation.fields.market')}
                                  value={selectedSetup.market || 'FOREX'}
                                  onChange={(event) => updateSelectedSetup((current) => ({ ...current, market: event.target.value as SetupItem['market'] }))}
                                >
                                  {marketOptions.map((market) => (
                                    <MenuItem key={market} value={market}>{market}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <FormControl fullWidth>
                                <InputLabel id="setup-session-label">{t('today.session.workstation.fields.session')}</InputLabel>
                                <Select
                                  labelId="setup-session-label"
                                  label={t('today.session.workstation.fields.session')}
                                  value={selectedSetup.tradeSession || ''}
                                  onChange={(event) => updateSelectedSetup((current) => ({ ...current, tradeSession: (event.target.value || null) as SetupItem['tradeSession'] }))}
                                >
                                  {sessionOptions.map((option) => (
                                    <MenuItem key={option} value={option}>{option}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <TextField
                                label={t('today.session.workstation.fields.biasAlignment')}
                                value={selectedSetup.biasAlignment || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({ ...current, biasAlignment: event.target.value }))}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.newsSafety')}
                                value={selectedSetup.context.newsSafety || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  context: { ...current.context, newsSafety: event.target.value }
                                }))}
                              />
                            </Box>
                            <TextField
                              className="ws-textarea"
                              label={t('today.session.workstation.fields.narrative')}
                              value={selectedSetup.context.narrative || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, narrative: event.target.value }
                              }))}
                              multiline
                              minRows={3}
                            />
                            <TextField
                              className="ws-textarea"
                              label={t('today.session.workstation.fields.liquidity')}
                              value={selectedSetup.context.liquidityNotes || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, liquidityNotes: event.target.value }
                              }))}
                              multiline
                              minRows={3}
                            />
                            <TextField
                              className="ws-textarea"
                              label={t('today.session.workstation.fields.invalidationIdea')}
                              value={selectedSetup.context.invalidationIdea || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, invalidationIdea: event.target.value }
                              }))}
                              multiline
                              minRows={3}
                            />
                            <TextField
                              className="ws-textarea"
                              label={t('today.session.workstation.fields.contextNotes')}
                              value={selectedSetup.context.notes || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, notes: event.target.value }
                              }))}
                              multiline
                              minRows={2}
                            />
                          </Stack>
                        </Box>

                        {selectedSetup.strategySnapshot ? (
                          <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                            <Stack spacing={1.25}>
                              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                  {t('today.session.workstation.plan.strategyTrace')}
                                </Typography>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={selectedSetup.strategySnapshot.localEditsApplied
                                    ? t('today.session.workstation.plan.localEdits')
                                    : t('today.session.workstation.plan.snapshotClean')}
                                />
                              </Stack>
                              <Typography variant="body2"><strong>{t('today.session.workstation.plan.importedFrom')}</strong> {selectedSetup.strategySnapshot.name || '—'}</Typography>
                              <Typography variant="body2"><strong>{t('today.session.workstation.plan.model')}</strong> {selectedSetup.strategySnapshot.model || '—'}</Typography>
                              {selectedSetup.strategySnapshot.entryConditionsRich ? (
                                <Box className="ws-subpanel" sx={{ p: 1.25 }}>
                                  <RichTextContent html={selectedSetup.strategySnapshot.entryConditionsRich} />
                                </Box>
                              ) : null}
                              <Typography variant="body2"><strong>{t('today.session.workstation.plan.invalidation')}</strong> {selectedSetup.strategySnapshot.invalidationLogic || '—'}</Typography>
                              <Typography variant="body2"><strong>{t('today.session.workstation.plan.targets')}</strong> {selectedSetup.strategySnapshot.tpFramework || '—'}</Typography>
                            </Stack>
                          </Box>
                        ) : null}
                      </Stack>
                    ) : null}

                    {selectedTab === 'TRIGGERS' ? (
                      <Stack spacing={2}>
                        <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <RuleRoundedIcon color="primary" />
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {t('today.session.workstation.triggers.title')}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <FormControlLabel
                                control={(
                                  <Switch
                                    checked={Boolean(selectedSetup.trigger.sweepIdentified)}
                                    onChange={(event) => updateSelectedSetup((current) => ({
                                      ...current,
                                      trigger: { ...current.trigger, sweepIdentified: event.target.checked }
                                    }))}
                                  />
                                )}
                                label={t('today.session.workstation.triggers.sweepIdentified')}
                              />
                              <FormControlLabel
                                control={(
                                  <Switch
                                    checked={Boolean(selectedSetup.trigger.displacementConfirmed)}
                                    onChange={(event) => updateSelectedSetup((current) => ({
                                      ...current,
                                      trigger: { ...current.trigger, displacementConfirmed: event.target.checked }
                                    }))}
                                  />
                                )}
                                label={t('today.session.workstation.triggers.displacementConfirmed')}
                              />
                              <FormControlLabel
                                control={(
                                  <Switch
                                    checked={Boolean(selectedSetup.trigger.structureConfirmed)}
                                    onChange={(event) => updateSelectedSetup((current) => ({
                                      ...current,
                                      trigger: { ...current.trigger, structureConfirmed: event.target.checked }
                                    }))}
                                  />
                                )}
                                label={t('today.session.workstation.triggers.structureConfirmed')}
                              />
                            </Stack>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                              <TextField
                                label={t('today.session.workstation.fields.confirmationModel')}
                                value={selectedSetup.trigger.confirmationModel || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  trigger: { ...current.trigger, confirmationModel: event.target.value }
                                }))}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.entryZone')}
                                value={selectedSetup.trigger.entryZone || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  trigger: { ...current.trigger, entryZone: event.target.value }
                                }))}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.rrEstimate')}
                                value={selectedSetup.trigger.rrEstimate ?? ''}
                                type="number"
                                inputProps={{ step: '0.1' }}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  trigger: { ...current.trigger, rrEstimate: parseNumberInput(event.target.value) }
                                }))}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.rrMinimum')}
                                value={selectedSetup.trigger.rrMinimum ?? ''}
                                type="number"
                                inputProps={{ step: '0.1' }}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  trigger: { ...current.trigger, rrMinimum: parseNumberInput(event.target.value) }
                                }))}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.triggerNotes')}
                                value={selectedSetup.trigger.notes || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  trigger: { ...current.trigger, notes: event.target.value }
                                }))}
                                multiline
                                minRows={3}
                                sx={{ gridColumn: { md: '1 / -1' } }}
                              />
                            </Box>
                          </Stack>
                        </Box>

                        {showAdvanced ? (
                          <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                            <Stack spacing={1.25}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <TuneRoundedIcon color="primary" />
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                  {t('today.session.workstation.triggers.advancedTitle')}
                                </Typography>
                              </Stack>
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                                <TextField label={t('today.session.workstation.fields.sweepType')} value={selectedSetup.trigger.sweepType || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, sweepType: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.liquiditySource')} value={selectedSetup.trigger.liquiditySource || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, liquiditySource: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.confirmationTimeframe')} value={selectedSetup.trigger.confirmationTimeframe || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, confirmationTimeframe: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.entryModel')} value={selectedSetup.trigger.entryModel || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, entryModel: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.displacementRule')} value={selectedSetup.trigger.displacementRule || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, displacementRule: event.target.value } }))} multiline minRows={2} />
                                <TextField label={t('today.session.workstation.fields.structureRule')} value={selectedSetup.trigger.structureRule || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, structureRule: event.target.value } }))} multiline minRows={2} />
                                <TextField label={t('today.session.workstation.fields.fvgRequirement')} value={selectedSetup.trigger.fvgRequirement || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, fvgRequirement: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.confluenceRequirement')} value={selectedSetup.trigger.confluenceRequirement || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, confluenceRequirement: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.newsRestriction')} value={selectedSetup.trigger.newsRestriction || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, newsRestriction: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.sessionRestriction')} value={selectedSetup.trigger.sessionRestriction || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, sessionRestriction: event.target.value } }))} />
                                <TextField label={t('today.session.workstation.fields.invalidationThreshold')} value={selectedSetup.trigger.invalidationThreshold || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, invalidationThreshold: event.target.value } }))} />
                              </Box>
                            </Stack>
                          </Box>
                        ) : null}
                      </Stack>
                    ) : null}

                    {selectedTab === 'EXECUTIONS' ? (
                      <Stack spacing={2}>
                        <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.25}>
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {t('today.session.workstation.executions.title')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t('today.session.workstation.executions.subtitle')}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1}>
                              <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => addExecution()}>
                                {t('today.session.workstation.executions.newExecution')}
                              </Button>
                              <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => addExecution(selectedExecution)}>
                                {t('today.session.workstation.executions.cloneExecution')}
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>

                        <Stack spacing={1}>
                          {selectedSetup.executions.tickets.map((ticket) => {
                            const ticketRr = computeRr(selectedSetup.direction, ticket)
                            return (
                              <Box
                                key={ticket.id}
                                className="ws-subpanel"
                                sx={{
                                  p: 1.25,
                                  borderColor: selectedExecution?.id === ticket.id ? 'primary.main' : 'var(--ws-border)',
                                  boxShadow: selectedExecution?.id === ticket.id ? (theme) => `0 0 0 1px ${alpha(theme.palette.primary.main, 0.28)}` : 'none'
                                }}
                              >
                                <Stack spacing={1}>
                                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                    <Stack spacing={0.25}>
                                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{ticket.label}</Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {ticket.entryPrice != null ? `${formatNumber(ticket.entryPrice, 5)} / ${formatNumber(ticket.stopLossPrice, 5)} / ${formatNumber(ticket.takeProfitPrice, 5)}` : t('today.session.workstation.executions.notConfigured')}
                                      </Typography>
                                    </Stack>
                                    <Chip size="small" color={chipColorForExecutionStatus(ticket.status)} label={ticket.status} />
                                  </Stack>
                                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" variant="outlined" label={`RR ${ticketRr != null ? formatNumber(ticketRr, 2) : '—'}`} />
                                    <Chip size="small" variant="outlined" label={formatCurrency(ticket.riskAmount, baseCurrency)} />
                                    {ticket.linkedTradeId ? <Chip size="small" variant="outlined" label={t('today.session.workstation.executions.linkedTrade')} /> : null}
                                  </Stack>
                                  <Stack direction="row" spacing={0.75}>
                                    <Button size="small" variant={selectedExecution?.id === ticket.id ? 'contained' : 'text'} onClick={() => selectExecution(ticket.id)}>
                                      {t('today.session.workstation.executions.focusExecution')}
                                    </Button>
                                  </Stack>
                                </Stack>
                              </Box>
                            )
                          })}
                        </Stack>

                        {selectedExecution ? (
                          <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                            <Stack spacing={1.25}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.25}>
                                <Stack spacing={0.5}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{selectedExecution.label}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {t('today.session.workstation.executions.editorSubtitle')}
                                  </Typography>
                                </Stack>
                                <FormControl sx={{ minWidth: 140 }}>
                                  <InputLabel id="execution-status-label">{t('today.session.workstation.fields.executionStatus')}</InputLabel>
                                  <Select
                                    labelId="execution-status-label"
                                    label={t('today.session.workstation.fields.executionStatus')}
                                    value={selectedExecution.status}
                                    onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, status: event.target.value as ExecutionTicketStatus }))}
                                  >
                                    {executionStatusOptions.map((option) => (
                                      <MenuItem key={option} value={option}>{option}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Stack>

                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                                <TextField label={t('today.session.workstation.fields.executionLabel')} value={selectedExecution.label} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, label: event.target.value }))} />
                                <TextField label={t('today.session.workstation.fields.riskAmount')} value={selectedExecution.riskAmount ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, riskAmount: parseNumberInput(event.target.value) }))} />
                                <TextField label={t('today.session.workstation.fields.entry')} value={selectedExecution.entryPrice ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, entryPrice: parseNumberInput(event.target.value) }))} />
                                <TextField label={t('today.session.workstation.fields.stopLoss')} value={selectedExecution.stopLossPrice ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, stopLossPrice: parseNumberInput(event.target.value) }))} />
                                <TextField label={t('today.session.workstation.fields.takeProfit')} value={selectedExecution.takeProfitPrice ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, takeProfitPrice: parseNumberInput(event.target.value) }))} />
                                <TextField label={t('today.session.workstation.fields.quantity')} value={selectedExecution.quantity ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, quantity: parseNumberInput(event.target.value) }))} />
                                <TextField
                                  className="ws-textarea"
                                  label={t('today.session.workstation.fields.executionInvalidation')}
                                  value={selectedExecution.invalidation || ''}
                                  onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, invalidation: event.target.value }))}
                                  multiline
                                  minRows={2}
                                />
                                <TextField
                                  className="ws-textarea"
                                  label={t('today.session.workstation.fields.whyWrong')}
                                  value={selectedExecution.whyWrong || ''}
                                  onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, whyWrong: event.target.value }))}
                                  multiline
                                  minRows={2}
                                />
                                <TextField
                                  className="ws-textarea"
                                  label={t('today.session.workstation.fields.initialNotes')}
                                  value={selectedExecution.initialNotes || ''}
                                  onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, initialNotes: event.target.value }))}
                                  multiline
                                  minRows={2}
                                  sx={{ gridColumn: { md: '1 / -1' } }}
                                />
                                <TextField
                                  className="ws-textarea"
                                  label={t('today.session.workstation.fields.executionNotes')}
                                  value={selectedExecution.notes || ''}
                                  onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, notes: event.target.value }))}
                                  multiline
                                  minRows={2}
                                  sx={{ gridColumn: { md: '1 / -1' } }}
                                />
                              </Box>

                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                <Chip size="small" label={`RR ${activeRr != null ? formatNumber(activeRr, 2) : '—'}`} />
                                <Chip size="small" variant="outlined" label={formatCurrency(selectedExecution.riskAmount, baseCurrency)} />
                                {focusedLevel?.price != null ? <Chip size="small" variant="outlined" label={`${t('today.session.workstation.chart.focusedLevel')}: ${formatNumber(focusedLevel.price, 5)}`} /> : null}
                              </Stack>

                              {combinedBlockers.length > 0 ? (
                                <Alert severity="warning">
                                  <AlertTitle>{t('today.session.workstation.executions.startBlocked')}</AlertTitle>
                                  {combinedBlockers.join(', ')}
                                </Alert>
                              ) : null}

                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Button
                                  variant="outlined"
                                  onClick={() => {
                                    if (!selectedSetupIsPersisted) return
                                    const signature = JSON.stringify(toSetupPayload(selectedSetup))
                                    updateSetupMutation.mutate({
                                      sessionId: currentWorkspace.session.id,
                                      setupId: selectedSetup.id,
                                      data: toSetupPayload(selectedSetup),
                                      signature
                                    })
                                  }}
                                >
                                  {t('today.session.workstation.executions.saveExecution')}
                                </Button>
                                <Button variant="outlined" onClick={() => statusMutation.mutate({ sessionId: currentWorkspace.session.id, setupId: selectedSetup.id, status: 'READY' })}>
                                  {t('today.session.workstation.executions.markSetupReady')}
                                </Button>
                                <Button
                                  variant="contained"
                                  color="secondary"
                                  startIcon={<PlayArrowRoundedIcon />}
                                  onClick={() => startTradeMutation.mutate({
                                    sessionId: currentWorkspace.session.id,
                                    setupId: selectedSetup.id,
                                    executionId: selectedExecution.id
                                  })}
                                  disabled={combinedBlockers.length > 0 || startTradeMutation.isPending}
                                >
                                  {t('today.session.workstation.header.startTrade')}
                                </Button>
                              </Stack>
                            </Stack>
                          </Box>
                        ) : null}
                      </Stack>
                    ) : null}

                    {selectedTab === 'REVIEW' ? (
                      <Stack spacing={2}>
                        <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <NotesRoundedIcon color="primary" />
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t('today.session.workstation.review.title')}</Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {t('today.session.workstation.review.subtitle')}
                            </Typography>
                            <TextField
                              className="ws-textarea"
                              label={t('today.session.workstation.fields.liveNotes')}
                              value={selectedSetup.review?.liveNotes || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                review: { ...(current.review || { tags: [], timeline: [] }), liveNotes: event.target.value }
                              }), { markStrategyDirty: false })}
                              multiline
                              minRows={3}
                            />
                            <Button
                              size="small"
                              startIcon={<AutoAwesomeRoundedIcon />}
                              onClick={() => updateSelectedSetup((current) => appendTimeline({
                                ...current,
                                review: current.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }
                              }, createTimelineEntry('note_added', 'Live note added', current.review?.liveNotes || '')), { markStrategyDirty: false })}
                            >
                              {t('today.session.workstation.review.addTimelineNote')}
                            </Button>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.25 }}>
                              <TextField
                                className="ws-textarea"
                                label={t('today.session.workstation.fields.mistakes')}
                                value={selectedSetup.review?.mistakes || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  review: { ...(current.review || { tags: [], timeline: [] }), mistakes: event.target.value }
                                }), { markStrategyDirty: false })}
                                multiline
                                minRows={3}
                              />
                              <TextField
                                className="ws-textarea"
                                label={t('today.session.workstation.fields.lessons')}
                                value={selectedSetup.review?.lessons || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  review: { ...(current.review || { tags: [], timeline: [] }), lessons: event.target.value }
                                }), { markStrategyDirty: false })}
                                multiline
                                minRows={3}
                              />
                            </Box>
                            <TextField
                              className="ws-textarea"
                              label={t('today.session.workstation.fields.outcomeSummary')}
                              value={selectedSetup.review?.outcomeSummary || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                review: { ...(current.review || { tags: [], timeline: [] }), outcomeSummary: event.target.value }
                              }), { markStrategyDirty: false })}
                              multiline
                              minRows={2}
                            />
                            <TextField
                              label={t('today.session.workstation.fields.reviewTags')}
                              value={toTagValue(selectedSetup.review?.tags)}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                review: { ...(current.review || { tags: [], timeline: [] }), tags: parseTags(event.target.value) }
                              }), { markStrategyDirty: false })}
                            />
                          </Stack>
                        </Box>

                        <Box className="ws-subpanel" sx={{ p: 1.5 }}>
                          <Stack spacing={1.25}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t('today.session.workstation.review.timeline')}</Typography>
                            {timeline.length > 0 ? (
                              timeline.map((entry) => (
                                <Box key={entry.id} className="ws-subpanel" sx={{ p: 1.1 }}>
                                  <Stack spacing={0.35}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{entry.title || 'Event'}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {entry.occurredAt ? formatDateTime(entry.occurredAt, timezone) : '—'}
                                    </Typography>
                                    {entry.body ? <Typography variant="body2" color="text.secondary">{entry.body}</Typography> : null}
                                  </Stack>
                                </Box>
                              ))
                            ) : (
                              <EmptyState
                                title={t('today.session.workstation.review.timelineEmpty')}
                                description={t('today.session.workstation.review.timelineEmptyBody')}
                                icon={<NotesRoundedIcon fontSize="inherit" />}
                              />
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    ) : null}
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('today.session.workstation.dialogs.createSetup')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              autoFocus
              label={t('today.session.workstation.fields.symbol')}
              value={createSetupDraft.symbol}
              onChange={(event) => setCreateSetupDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
            />
            <FormControl fullWidth>
              <InputLabel id="create-direction-label">{t('today.session.workstation.fields.direction')}</InputLabel>
              <Select
                labelId="create-direction-label"
                label={t('today.session.workstation.fields.direction')}
                value={createSetupDraft.direction}
                onChange={(event) => setCreateSetupDraft((current) => ({ ...current, direction: event.target.value as CreateSetupDraft['direction'] }))}
              >
                <MenuItem value="LONG">Long</MenuItem>
                <MenuItem value="SHORT">Short</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('today.session.workstation.fields.setupTitle')}
              value={createSetupDraft.setupTitle}
              onChange={(event) => setCreateSetupDraft((current) => ({ ...current, setupTitle: event.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleCreateSetup} disabled={!createSetupDraft.symbol.trim()}>
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={strategyDialogOpen} onClose={() => setStrategyDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{t('today.session.workstation.dialogs.importStrategy')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' },
              gap: 2,
              mt: 0.5
            }}
          >
            <Stack spacing={1.25}>
              <TextField
                label={t('today.session.workstation.dialogs.search')}
                value={importDraft.search}
                onChange={(event) => setImportDraft((current) => ({ ...current, search: event.target.value }))}
                InputProps={{ startAdornment: <SearchRoundedIcon fontSize="small" style={{ marginRight: 8 }} /> }}
              />
              <FormControl fullWidth>
                <InputLabel id="strategy-source-label">{t('today.session.workstation.dialogs.source')}</InputLabel>
                <Select
                  labelId="strategy-source-label"
                  label={t('today.session.workstation.dialogs.source')}
                  value={importDraft.source}
                  onChange={(event) => setImportDraft((current) => ({ ...current, source: event.target.value as StrategyImportDraft['source'] }))}
                >
                  <MenuItem value="ALL">{t('today.session.workstation.dialogs.allStrategies')}</MenuItem>
                  <MenuItem value="MY">{t('today.session.workstation.dialogs.myStrategies')}</MenuItem>
                  <MenuItem value="MENTOR">{t('today.session.workstation.dialogs.mentorStrategies')}</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Switch checked={importDraft.createNewSetup || !selectedSetup} onChange={(event) => setImportDraft((current) => ({ ...current, createNewSetup: event.target.checked }))} />}
                label={t('today.session.workstation.dialogs.createNewSetup')}
              />
              {(importDraft.createNewSetup || !selectedSetup) ? (
                <Stack spacing={1.25}>
                  <TextField label={t('today.session.workstation.fields.symbol')} value={importDraft.symbol} onChange={(event) => setImportDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} />
                  <FormControl fullWidth>
                    <InputLabel id="import-direction-label">{t('today.session.workstation.fields.direction')}</InputLabel>
                    <Select
                      labelId="import-direction-label"
                      label={t('today.session.workstation.fields.direction')}
                      value={importDraft.direction}
                      onChange={(event) => setImportDraft((current) => ({ ...current, direction: event.target.value as 'LONG' | 'SHORT' }))}
                    >
                      <MenuItem value="LONG">Long</MenuItem>
                      <MenuItem value="SHORT">Short</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField label={t('today.session.workstation.fields.setupTitle')} value={importDraft.setupTitle} onChange={(event) => setImportDraft((current) => ({ ...current, setupTitle: event.target.value }))} />
                </Stack>
              ) : (
                <Alert severity="info">{t('today.session.workstation.dialogs.importIntoSelected', { setup: selectedSetup?.setupTitle || '' })}</Alert>
              )}

              <Divider />

              <Stack spacing={1}>
                {strategiesQuery.isLoading ? (
                  <LoadingState rows={5} height={18} />
                ) : strategyList.length > 0 ? (
                  strategyList.map((strategy) => (
                    <Box
                      key={strategy.id}
                      className="ws-subpanel"
                      sx={{
                        p: 1.1,
                        cursor: 'pointer',
                        borderColor: selectedStrategyId === strategy.id ? 'primary.main' : 'var(--ws-border)',
                        boxShadow: selectedStrategyId === strategy.id ? (theme) => `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}` : 'none'
                      }}
                      onClick={() => {
                        setSelectedStrategyId(strategy.id)
                        setImportDraft((current) => ({
                          ...current,
                          setupTitle: current.setupTitle || strategy.name
                        }))
                      }}
                    >
                      <Stack spacing={0.6}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{strategy.name}</Typography>
                          <Chip size="small" label={strategy.source} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{strategy.model}</Typography>
                      </Stack>
                    </Box>
                  ))
                ) : (
                  <EmptyState title={t('today.session.workstation.dialogs.noStrategies')} description={t('today.session.workstation.dialogs.noStrategiesBody')} icon={<ImportExportRoundedIcon fontSize="inherit" />} />
                )}
              </Stack>
            </Stack>

            <Box className="ws-subpanel" sx={{ p: 1.5, minHeight: 420 }}>
              {selectedStrategy ? (
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>{selectedStrategy.name}</Typography>
                    <Chip size="small" variant="outlined" label={selectedStrategy.source} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{selectedStrategy.model}</Typography>
                  {selectedStrategy.entryConditionsRich ? <RichTextContent html={selectedStrategy.entryConditionsRich} /> : null}
                  <Typography variant="body2"><strong>{t('today.session.workstation.plan.invalidation')}</strong> {selectedStrategy.invalidationLogic || '—'}</Typography>
                  <Typography variant="body2"><strong>{t('today.session.workstation.plan.targets')}</strong> {selectedStrategy.tpFramework || '—'}</Typography>
                  <Typography variant="body2"><strong>{t('today.session.workstation.dialogs.noTradeRules')}</strong> {selectedStrategy.noTradeRules || '—'}</Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {(selectedStrategy.sessionSuitability || []).map((item) => (
                      <Chip key={item} size="small" label={item} />
                    ))}
                    {(selectedStrategy.tags || []).map((item) => (
                      <Chip key={item} size="small" variant="outlined" label={item} />
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <EmptyState title={t('today.session.workstation.dialogs.previewEmpty')} description={t('today.session.workstation.dialogs.previewEmptyBody')} icon={<AutoAwesomeRoundedIcon fontSize="inherit" />} />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStrategyDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleImportStrategy}
            disabled={!selectedStrategy || ((importDraft.createNewSetup || !selectedSetup) && !importDraft.symbol.trim())}
          >
            {t('today.session.workstation.dialogs.importAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

function SetupStatusChip({ status }: { status: SetupStatus }) {
  return <Chip size="small" color={chipColorForSetupStatus(status)} label={status.replaceAll('_', ' ')} />
}

function ReadinessChip({ state, score }: { state: string; score: number }) {
  return <Chip size="small" color={chipColorForReadiness(state)} label={`${score}% ${state.toLowerCase()}`} />
}

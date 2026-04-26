import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'
import type { ChipProps } from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ImportExportRoundedIcon from '@mui/icons-material/ImportExportRounded'
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import NotesRoundedIcon from '@mui/icons-material/NotesRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from '../api/assets'
import { ApiError } from '../api/client'
import {
  createSetupCandidate,
  deleteSessionPlanImage,
  duplicateSetupCandidate,
  getSessionWorkspace,
  removeSessionPlan,
  selectActiveSetupCandidate,
  startTradeFromSetupCandidate,
  updateSessionWorkspace,
  updateSetupCandidate,
  updateSetupCandidateStatus,
  uploadSessionPlanImages,
  upsertSessionPeriodPlan,
  type ConfluenceItem,
  type ExecutionTicket,
  type LiveWorkspaceResponse,
  type PlanImage,
  type PeriodPlan,
  type ReviewTimelineEntry,
  type SetupItem,
  type SetupStatus
} from '../api/liveWorkspace'
import { fetchTodayMentorPlan, type PlanScope } from '../api/plans'
import { listStrategies, type StrategyResponse } from '../api/strategies'
import { useAuth } from '../auth/AuthContext'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import type { UploadQueueItem } from '../components/assets/AssetListRenderer'
import PlanImagesSection from '../components/session/PlanImagesSection'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import RichTextContent from '../components/ui/RichTextContent'
import {
  applyStrategyImport,
  appendTimeline,
  buildQuickLogUpdate,
  buildTimeline,
  computeRr,
  createTimelineEntry,
  defaultConfluences,
  dedupeConfluences,
  ensureExecutionWorkspace,
  ensureWorkspace,
  formatDirection,
  generateId,
  getSimpleReadinessLabel,
  parseNumberInput,
  quickLogActions,
  strategyConfluences,
  summarizeStrategySnapshot,
  toPeriodPlanDraft,
  toPeriodPlanPayload,
  toSessionDraft,
  toSessionPayload,
  toSetupPayload,
  toTradingViewSymbol,
  type CreateSetupDraft,
  type PeriodPlanDraft,
  type PlanScopeTab,
  type QuickLogActionId,
  type SessionDraft,
  type StrategyImportDraft
} from '../features/session-workstation/sessionWorkstation'
import { useI18n } from '../i18n'
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatSignedCurrency } from '../utils/format'

type SideTab = 'STRATEGY' | 'RISK' | 'CONFLUENCES' | 'EXECUTE' | 'JOURNAL'
type PlanRemovalTarget = {
  scope: PlanScopeTab
  plan: PeriodPlan
}

const planScopeToApiScope = (scope: PlanScopeTab): PlanScope => scope === 'TODAY' ? 'DAILY' : scope

const planScopeToCalendarParam = (scope: PlanScopeTab) => scope.toLowerCase()

const isImageFile = (file: File) => (
  (file.type ? ALLOWED_IMAGE_MIME_TYPES.has(file.type) : false)
  || /\.(png|jpe?g|webp|gif)$/i.test(file.name)
)

const directionOptions: SetupItem['direction'][] = ['UNDECIDED', 'LONG', 'SHORT']

function chipColorForStatus(status: SetupStatus): ChipProps['color'] {
  if (status === 'READY' || status === 'TRIGGERED') return 'success'
  if (status === 'EXECUTED' || status === 'CLOSED') return 'primary'
  if (status === 'INVALIDATED' || status === 'ARCHIVED') return 'error'
  if (status === 'SKIPPED') return 'default'
  return 'warning'
}

function readinessColor(label: string): ChipProps['color'] {
  if (label === 'Locked' || label === 'Ready to Lock') return 'success'
  if (label === 'Not Ready') return 'warning'
  if (label === 'Empty') return 'default'
  return 'primary'
}

function setupStatusForQuickAction(actionId: QuickLogActionId): SetupStatus | null {
  if (actionId === 'WATCHING') return 'WATCHING'
  if (actionId === 'TRIGGER_CONFIRMED') return 'TRIGGERED'
  if (actionId === 'ENTRY_TAKEN') return 'EXECUTED'
  if (actionId === 'CLOSE_WIN' || actionId === 'CLOSE_LOSS') return 'CLOSED'
  if (actionId === 'SKIPPED' || actionId === 'MISSED_TRADE') return 'SKIPPED'
  if (actionId === 'INVALIDATED') return 'INVALIDATED'
  return null
}

function SurfaceMetric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Box className="ws-subpanel" sx={{ p: 1.25, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ mt: 0.25, fontWeight: 900 }} noWrap>
        {value}
      </Typography>
      {detail ? <Typography variant="caption" color="text.secondary">{detail}</Typography> : null}
    </Box>
  )
}

function isRiskConfiguredDraft(draft: SessionDraft | null | undefined) {
  return Boolean(
    draft
    && (draft.dailyMaxLoss ?? 0) > 0
    && (draft.profitTarget ?? 0) > 0
    && (draft.riskPerTrade ?? 0) > 0
    && (draft.maxTrades ?? 0) > 0
    && (draft.maxConsecutiveLosses ?? 0) > 0
  )
}

function periodRange(plan?: PeriodPlan | null, timezone?: string) {
  if (!plan) return '—'
  if (plan.periodStart === plan.periodEnd) return formatDate(plan.periodStart, timezone)
  return `${formatDate(plan.periodStart, timezone)} - ${formatDate(plan.periodEnd, timezone)}`
}

function planScopeLabel(scope: PlanScopeTab) {
  if (scope === 'WEEKLY') return 'Weekly Plan'
  if (scope === 'MONTHLY') return 'Monthly Plan'
  return 'Today Plan'
}

function planRemovalLead(scope: PlanScopeTab) {
  if (scope === 'WEEKLY') return 'Remove this Weekly Plan? It will no longer stay pinned for this week.'
  if (scope === 'MONTHLY') return 'Remove this Monthly Plan? It will no longer stay pinned for this month.'
  return 'Remove this Today Plan? It will no longer appear on this calendar day or in Session Mode.'
}

function createEmptySetup(workspace: LiveWorkspaceResponse, draft: CreateSetupDraft): SetupItem {
  const now = new Date().toISOString()
  return ensureExecutionWorkspace({
    id: `draft-${generateId()}`,
    symbol: draft.symbol.trim().toUpperCase(),
    direction: draft.direction,
    market: 'FOREX',
    tradeSession: null,
    strategyId: null,
    strategyLabel: '',
    setupTitle: draft.setupTitle.trim() || draft.symbol.trim().toUpperCase(),
    biasAlignment: '',
    status: 'DRAFT',
    linkedTradeId: null,
    readiness: workspace.session.readiness,
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
    confluences: defaultConfluences(),
    manualSetupMode: true,
    sortOrder: workspace.setups.length,
    createdAt: now,
    updatedAt: null
  })
}

function TimelineEntryCard({ entry, timezone }: { entry: ReviewTimelineEntry; timezone: string }) {
  return (
    <Box className="ws-subpanel" sx={{ p: 1.15 }}>
      <Stack spacing={0.4}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{entry.title || 'Event'}</Typography>
          <Typography variant="caption" color="text.secondary">{entry.occurredAt ? formatDateTime(entry.occurredAt, timezone) : '—'}</Typography>
        </Stack>
        {entry.body ? <Typography variant="body2" color="text.secondary">{entry.body}</Typography> : null}
      </Stack>
    </Box>
  )
}

export default function SessionPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'

  const initialPlanScope = useMemo<PlanScopeTab>(() => {
    const requested = (searchParams.get('plan') || '').toUpperCase()
    if (requested === 'WEEKLY') return 'WEEKLY'
    if (requested === 'MONTHLY') return 'MONTHLY'
    return 'TODAY'
  }, [searchParams])

  const [planScope, setPlanScope] = useState<PlanScopeTab>(initialPlanScope)
  const [sideTab, setSideTab] = useState<SideTab>('STRATEGY')
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)
  const [weeklyDraft, setWeeklyDraft] = useState<PeriodPlanDraft | null>(null)
  const [monthlyDraft, setMonthlyDraft] = useState<PeriodPlanDraft | null>(null)
  const [setupDraft, setSetupDraft] = useState<SetupItem | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false)
  const [strategyDetailOpen, setStrategyDetailOpen] = useState(false)
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [planRemovalTarget, setPlanRemovalTarget] = useState<PlanRemovalTarget | null>(null)
  const [planImageUploads, setPlanImageUploads] = useState<Record<PlanScopeTab, UploadQueueItem[]>>({
    TODAY: [],
    WEEKLY: [],
    MONTHLY: []
  })
  const [deletingPlanImageIds, setDeletingPlanImageIds] = useState<Set<string>>(new Set())
  const [quickLogAnchorEl, setQuickLogAnchorEl] = useState<null | HTMLElement>(null)
  const [quickNote, setQuickNote] = useState('')
  const [newConfluence, setNewConfluence] = useState('')
  const [createSetupDraft, setCreateSetupDraft] = useState<CreateSetupDraft>({ symbol: '', direction: 'UNDECIDED', setupTitle: '' })
  const [importDraft, setImportDraft] = useState<StrategyImportDraft>({
    search: '',
    source: 'ALL',
    createNewSetup: false,
    symbol: '',
    direction: 'UNDECIDED',
    setupTitle: ''
  })

  const sessionSignatureRef = useRef('')
  const setupSignatureRef = useRef('')

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

  useEffect(() => {
    setPlanScope(initialPlanScope)
  }, [initialPlanScope])

  const applyWorkspace = (workspace: LiveWorkspaceResponse, preferredSetupId?: string | null) => {
    const normalized = ensureWorkspace(workspace)
    queryClient.setQueryData(['liveWorkspace'], normalized)
    const nextSelectedSetupId = preferredSetupId && normalized.setups.some((item) => item.id === preferredSetupId)
      ? preferredSetupId
      : normalized.activeSetupId && normalized.setups.some((item) => item.id === normalized.activeSetupId)
        ? normalized.activeSetupId
        : normalized.setups[0]?.id || null
    setSelectedSetupId(nextSelectedSetupId)
  }

  const updateSessionMutation = useMutation({
    mutationFn: (payload: { sessionId: string; data: ReturnType<typeof toSessionPayload>; signature: string }) =>
      updateSessionWorkspace(payload.sessionId, payload.data),
    onSuccess: (workspace, variables) => {
      sessionSignatureRef.current = variables.signature
      applyWorkspace(workspace, selectedSetupId)
    },
    onError: (error) => setFeedback((error as ApiError).message || 'Could not save session guardrails.')
  })

  const updateSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string; data: ReturnType<typeof toSetupPayload>; signature: string }) =>
      updateSetupCandidate(payload.sessionId, payload.setupId, payload.data),
    onSuccess: (workspace, variables) => {
      setupSignatureRef.current = variables.signature
      applyWorkspace(workspace, variables.setupId)
    },
    onError: (error) => setFeedback((error as ApiError).message || 'Could not save setup changes.')
  })

  const createSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; data: ReturnType<typeof toSetupPayload> }) =>
      createSetupCandidate(payload.sessionId, payload.data),
    onSuccess: (workspace) => {
      const last = workspace.setups[workspace.setups.length - 1]
      applyWorkspace(workspace, last?.id || workspace.activeSetupId || null)
      setCreateDialogOpen(false)
      setCreateSetupDraft({ symbol: '', direction: 'UNDECIDED', setupTitle: '' })
      setFeedback('Setup added.')
    },
    onError: (error) => setFeedback((error as ApiError).message || 'Could not create setup.')
  })

  const duplicateSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string }) =>
      duplicateSetupCandidate(payload.sessionId, payload.setupId),
    onSuccess: (workspace) => {
      const last = workspace.setups[workspace.setups.length - 1]
      applyWorkspace(workspace, last?.id || workspace.activeSetupId || null)
      setFeedback('Setup duplicated.')
    }
  })

  const selectSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string | null }) =>
      selectActiveSetupCandidate(payload.sessionId, payload.setupId),
    onSuccess: (workspace, variables) => applyWorkspace(workspace, variables.setupId)
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string; status: SetupStatus }) =>
      updateSetupCandidateStatus(payload.sessionId, payload.setupId, payload.status),
    onSuccess: (workspace, variables) => applyWorkspace(workspace, variables.setupId)
  })

  const startTradeMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string; executionId?: string | null }) =>
      startTradeFromSetupCandidate(payload.sessionId, payload.setupId, payload.executionId),
    onSuccess: (workspace, variables) => {
      applyWorkspace(workspace, variables.setupId)
      setFeedback('Execution started.')
    },
    onError: (error) => setFeedback((error as ApiError).message || 'Could not start trade.')
  })

  const periodPlanMutation = useMutation({
    mutationFn: (payload: { scope: 'WEEKLY' | 'MONTHLY'; draft: PeriodPlanDraft }) =>
      upsertSessionPeriodPlan(payload.scope, toPeriodPlanPayload(payload.draft)),
    onSuccess: (workspace) => {
      applyWorkspace(workspace, selectedSetupId)
      setFeedback('Plan saved.')
    },
    onError: (error) => setFeedback((error as ApiError).message || 'Could not save plan.')
  })

  const removePlanMutation = useMutation({
    mutationFn: (target: PlanRemovalTarget) => {
      if (!target.plan.id) {
        throw new ApiError('Plan not found.')
      }
      return removeSessionPlan(planScopeToApiScope(target.scope), target.plan.id)
    },
    onSuccess: async (_result, target) => {
      setPlanRemovalTarget(null)
      if (target.scope === 'TODAY') {
        setSelectedSetupId(null)
        setSetupDraft(null)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] }),
        queryClient.invalidateQueries({ queryKey: ['todayMyPlan'] }),
        queryClient.invalidateQueries({ queryKey: ['activeTradePlans'] }),
        queryClient.invalidateQueries({ queryKey: ['calendarPlans'] })
      ])
      setFeedback(`${planScopeLabel(target.scope)} removed.`)
    },
    onError: (error) => setFeedback((error as ApiError).message || 'Could not remove plan.')
  })

  useEffect(() => {
    const workspace = workspaceQuery.data
    if (!workspace) return
    const sessionSavePending = updateSessionMutation.isPending
    const setupSavePending = updateSetupMutation.isPending
    const nextSelectedSetupId = selectedSetupId && workspace.setups.some((item) => item.id === selectedSetupId)
      ? selectedSetupId
      : workspace.activeSetupId && workspace.setups.some((item) => item.id === workspace.activeSetupId)
        ? workspace.activeSetupId
        : workspace.setups[0]?.id || null
    if (nextSelectedSetupId !== selectedSetupId) {
      setSelectedSetupId(nextSelectedSetupId)
    }

    const nextSessionDraft = toSessionDraft(workspace.session)
    const nextSessionSignature = JSON.stringify(toSessionPayload(nextSessionDraft))
    setSessionDraft((current) => {
      const currentSignature = current ? JSON.stringify(toSessionPayload(current)) : ''
      const hasLocalChanges = Boolean(current && currentSignature !== sessionSignatureRef.current)
      if (hasLocalChanges || sessionSavePending) return current
      sessionSignatureRef.current = nextSessionSignature
      return nextSessionDraft
    })
    setWeeklyDraft(toPeriodPlanDraft(workspace.planningContext?.weekly))
    setMonthlyDraft(toPeriodPlanDraft(workspace.planningContext?.monthly))

    const nextSetup = workspace.setups.find((item) => item.id === nextSelectedSetupId) || null
    if (nextSetup) {
      const normalized = ensureExecutionWorkspace(nextSetup)
      const nextSetupSignature = JSON.stringify(toSetupPayload(normalized))
      setSetupDraft((current) => {
        const isSameSetup = current?.id === normalized.id
        const currentSignature = current ? JSON.stringify(toSetupPayload(current)) : ''
        const hasLocalChanges = Boolean(isSameSetup && currentSignature !== setupSignatureRef.current)
        if (hasLocalChanges || (isSameSetup && setupSavePending)) return current
        setupSignatureRef.current = nextSetupSignature
        return normalized
      })
    } else {
      setSetupDraft((current) => {
        const currentSignature = current ? JSON.stringify(toSetupPayload(current)) : ''
        const hasLocalChanges = Boolean(current && currentSignature !== setupSignatureRef.current)
        if (hasLocalChanges || setupSavePending) return current
        setupSignatureRef.current = ''
        return null
      })
    }
  }, [workspaceQuery.data, selectedSetupId, updateSessionMutation.isPending, updateSetupMutation.isPending])

  useEffect(() => {
    const sessionId = workspaceQuery.data?.session.id
    if (!sessionId || !sessionDraft) return
    const signature = JSON.stringify(toSessionPayload(sessionDraft))
    if (signature === sessionSignatureRef.current) return
    const timer = window.setTimeout(() => {
      updateSessionMutation.mutate({
        sessionId,
        data: toSessionPayload(sessionDraft),
        signature
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [sessionDraft, updateSessionMutation.mutate, workspaceQuery.data?.session.id])

  useEffect(() => {
    const sessionId = workspaceQuery.data?.session.id
    if (!sessionId || !setupDraft) return
    const signature = JSON.stringify(toSetupPayload(setupDraft))
    if (signature === setupSignatureRef.current) return
    const timer = window.setTimeout(() => {
      updateSetupMutation.mutate({
        sessionId,
        setupId: setupDraft.id,
        data: toSetupPayload(setupDraft),
        signature
      })
    }, 550)
    return () => window.clearTimeout(timer)
  }, [setupDraft, updateSetupMutation.mutate, workspaceQuery.data?.session.id])

  const workspace = workspaceQuery.data
  const selectedSetup = setupDraft || workspace?.setups.find((item) => item.id === selectedSetupId) || null
  const selectedExecution = selectedSetup?.executions.tickets.find((ticket) => ticket.id === selectedSetup.executions.activeExecutionId)
    || selectedSetup?.executions.tickets[0]
    || null
  const selectedStrategy = useMemo(() => {
    const all = [...(strategiesQuery.data?.myStrategies || []), ...(strategiesQuery.data?.mentorStrategies || [])]
    return all.find((item) => item.id === selectedStrategyId) || null
  }, [selectedStrategyId, strategiesQuery.data])
  const strategyList = useMemo(() => {
    const all = [...(strategiesQuery.data?.myStrategies || []), ...(strategiesQuery.data?.mentorStrategies || [])]
    const term = importDraft.search.trim().toLowerCase()
    return all.filter((item) => {
      if (importDraft.source !== 'ALL' && item.source !== importDraft.source) return false
      if (!term) return true
      return [item.name, item.model, ...(item.entryConditions || []), ...(item.tags || [])]
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [importDraft.search, importDraft.source, strategiesQuery.data])

  const deferredChartSymbol = useDeferredValue(toTradingViewSymbol(
    selectedSetup?.symbol || null,
    mentorPlanQuery.data?.tradingViewSymbol || null
  ))
  const deferredChartInterval = useDeferredValue(mentorPlanQuery.data?.tradingViewInterval || '15')

  if (workspaceQuery.isLoading) {
    return <LoadingState rows={10} height={34} />
  }

  if (workspaceQuery.isError || !workspace) {
    return <Alert severity="error">{(workspaceQuery.error as ApiError)?.message || 'Could not load Session Mode.'}</Alert>
  }

  const readinessLabel = getSimpleReadinessLabel(workspace, selectedSetup)
  const strategySummary = summarizeStrategySnapshot(selectedSetup?.strategySnapshot)
  const timeline = selectedSetup ? buildTimeline(selectedSetup, workspace.activity) : []
  const activeRr = selectedSetup && selectedExecution ? computeRr(selectedSetup.direction, selectedExecution) : null
  const riskConfigured = isRiskConfiguredDraft(sessionDraft)
  const canLock = readinessLabel === 'Ready to Lock'
  const autoSaveState = updateSetupMutation.isPending || updateSessionMutation.isPending ? 'Saving...' : 'Saved'
  const todayPlan = workspace.planningContext?.today
  const todayPlanActive = todayPlan?.exists !== false

  const updateSelectedSetup = (updater: (setup: SetupItem) => SetupItem) => {
    setSetupDraft((current) => current ? ensureExecutionWorkspace(updater(current)) : current)
  }

  const updateActiveExecution = (updater: (ticket: ExecutionTicket) => ExecutionTicket) => {
    updateSelectedSetup((current) => {
      const activeExecutionId = current.executions.activeExecutionId || current.executions.tickets[0]?.id
      const tickets = current.executions.tickets.map((ticket) => (
        ticket.id === activeExecutionId ? { ...updater(ticket), updatedAt: new Date().toISOString() } : ticket
      ))
      const active = tickets.find((ticket) => ticket.id === activeExecutionId) || tickets[0]
      return {
        ...current,
        execution: {
          ...current.execution,
          activeExecutionId,
          entryPrice: active?.entryPrice ?? null,
          stopLossPrice: active?.stopLossPrice ?? null,
          takeProfitPrice: active?.takeProfitPrice ?? null,
          riskAmount: active?.riskAmount ?? null,
          quantity: active?.quantity ?? null,
          invalidation: active?.invalidation || '',
          whyWrong: active?.whyWrong || '',
          initialNotes: active?.initialNotes || '',
          tickets
        },
        executions: { activeExecutionId, tickets }
      }
    })
  }

  const handleCreateSetup = () => {
    if (!workspace) return
    createSetupMutation.mutate({
      sessionId: workspace.session.id,
      data: toSetupPayload(createEmptySetup(workspace, createSetupDraft))
    })
  }

  const handleSelectSetup = (setupId: string) => {
    setSelectedSetupId(setupId)
    if (setupId !== workspace.activeSetupId) {
      selectSetupMutation.mutate({ sessionId: workspace.session.id, setupId })
    }
  }

  const openStrategyDialog = () => {
    setSelectedStrategyId(null)
    setImportDraft((current) => ({
      ...current,
      search: '',
      createNewSetup: !selectedSetup,
      symbol: selectedSetup?.symbol || '',
      direction: selectedSetup?.direction || 'UNDECIDED',
      setupTitle: selectedSetup?.setupTitle || ''
    }))
    setStrategyDialogOpen(true)
  }

  const handleImportStrategy = () => {
    if (!selectedStrategy) return
    if (!selectedSetup || importDraft.createNewSetup) {
      const setup = createEmptySetup(workspace, {
        symbol: importDraft.symbol,
        direction: importDraft.direction,
        setupTitle: importDraft.setupTitle || selectedStrategy.name
      })
      createSetupMutation.mutate({
        sessionId: workspace.session.id,
        data: toSetupPayload(applyStrategyImport(setup, selectedStrategy))
      })
    } else {
      updateSelectedSetup((current) => applyStrategyImport(current, selectedStrategy))
      setFeedback('Strategy imported.')
    }
    setStrategyDialogOpen(false)
  }

  const addExecution = () => {
    updateSelectedSetup((current) => {
      const ticket: ExecutionTicket = {
        id: generateId(),
        label: `Execution ${current.executions.tickets.length + 1}`,
        status: 'DRAFT',
        createdAt: new Date().toISOString()
      }
      return appendTimeline(ensureExecutionWorkspace({
        ...current,
        executions: {
          activeExecutionId: ticket.id,
          tickets: [...current.executions.tickets, ticket]
        }
      }), createTimelineEntry('execution_created', 'Execution created', ticket.label, ticket.id))
    })
    setSideTab('EXECUTE')
  }

  const handleQuickLogAction = async (actionId: QuickLogActionId) => {
    if (!selectedSetup) return
    setQuickLogAnchorEl(null)
    if ((actionId === 'ADD_NOTE' || actionId === 'ADD_LESSON') && !quickNote.trim()) {
      setFeedback('Write a quick note first.')
      return
    }
    if (actionId === 'ENTRY_TAKEN' && selectedExecution && canLock && workspace.session.lockedInAt) {
      startTradeMutation.mutate({ sessionId: workspace.session.id, setupId: selectedSetup.id, executionId: selectedExecution.id })
      return
    }
    const result = buildQuickLogUpdate(selectedSetup, actionId, { note: quickNote, executionId: selectedExecution?.id || null })
    setSetupDraft(result.setup)
    setFeedback(result.feedback)
    setQuickNote('')
    const status = setupStatusForQuickAction(actionId)
    if (status) {
      await statusMutation.mutateAsync({ sessionId: workspace.session.id, setupId: selectedSetup.id, status })
    }
  }

  const saveCurrentPeriodPlan = () => {
    if (planScope === 'WEEKLY' && weeklyDraft) {
      periodPlanMutation.mutate({ scope: 'WEEKLY', draft: weeklyDraft })
    }
    if (planScope === 'MONTHLY' && monthlyDraft) {
      periodPlanMutation.mutate({ scope: 'MONTHLY', draft: monthlyDraft })
    }
  }

  const requestRemovePlan = (scope: PlanScopeTab, plan?: PeriodPlan | null) => {
    if (!plan?.id || !plan.exists) return
    setPlanRemovalTarget({ scope, plan })
  }

  const confirmRemovePlan = () => {
    if (!planRemovalTarget) return
    removePlanMutation.mutate(planRemovalTarget)
  }

  const updatePlanImageUpload = (scope: PlanScopeTab, id: string, patch: Partial<UploadQueueItem>) => {
    setPlanImageUploads((current) => ({
      ...current,
      [scope]: current[scope].map((item) => item.id === id ? { ...item, ...patch } : item)
    }))
  }

  const handleUploadPlanImages = async (scope: PlanScopeTab, files: File[]) => {
    if (files.length === 0) return
    const queueItems: UploadQueueItem[] = files.map((file) => ({
      id: `${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      sizeBytes: file.size,
      progress: 2
    }))
    setPlanImageUploads((current) => ({
      ...current,
      [scope]: [...current[scope], ...queueItems]
    }))

    const acceptedFiles: File[] = []
    files.forEach((file, index) => {
      const queueItem = queueItems[index]
      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        updatePlanImageUpload(scope, queueItem.id, { progress: 0, error: 'File is too large.' })
        return
      }
      if (!isImageFile(file)) {
        updatePlanImageUpload(scope, queueItem.id, { progress: 0, error: 'Only image files are accepted.' })
        return
      }
      acceptedFiles.push(file)
    })

    if (acceptedFiles.length === 0) return

    try {
      await uploadSessionPlanImages(planScopeToApiScope(scope), acceptedFiles, (progress) => {
        acceptedFiles.forEach((file) => {
          const queueItem = queueItems.find((item) => item.fileName === file.name && item.sizeBytes === file.size)
          if (queueItem) {
            updatePlanImageUpload(scope, queueItem.id, { progress })
          }
        })
      })
      setPlanImageUploads((current) => ({
        ...current,
        [scope]: current[scope].filter((item) => !acceptedFiles.some((file) => file.name === item.fileName && file.size === item.sizeBytes))
      }))
      await queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] })
      setFeedback('Plan images uploaded.')
    } catch (error) {
      const message = (error as ApiError)?.message || 'Could not upload plan images.'
      acceptedFiles.forEach((file) => {
        const queueItem = queueItems.find((item) => item.fileName === file.name && item.sizeBytes === file.size)
        if (queueItem) {
          updatePlanImageUpload(scope, queueItem.id, { progress: 0, error: message })
        }
      })
    }
  }

  const handleDeletePlanImage = async (scope: PlanScopeTab, image: PlanImage) => {
    setDeletingPlanImageIds((current) => new Set(current).add(image.id))
    try {
      await deleteSessionPlanImage(planScopeToApiScope(scope), image.id)
      await queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] })
      setFeedback('Plan image deleted.')
    } catch (error) {
      setFeedback((error as ApiError)?.message || 'Could not delete plan image.')
    } finally {
      setDeletingPlanImageIds((current) => {
        const next = new Set(current)
        next.delete(image.id)
        return next
      })
    }
  }

  const openPlanInCalendar = (scope: PlanScopeTab) => {
    navigate(`/calendar?plan=${planScopeToCalendarParam(scope)}`)
  }

  const planCalendarStorageLabel = (scope: PlanScopeTab, plan?: PeriodPlan | null) => {
    if (scope === 'TODAY') {
      return `Visible in Calendar on ${formatDate(plan?.periodStart || workspace.session.tradingDate, timezone)}.`
    }
    if (scope === 'WEEKLY') {
      return `Pinned in Calendar for this week until ${formatDate(plan?.periodEnd, timezone)}.`
    }
    return `Pinned in Calendar for this month until ${formatDate(plan?.periodEnd, timezone)}.`
  }

  const sidePanel = (
    <Card className="ws-panel" component="aside" sx={{ position: { xl: 'sticky' }, top: { xl: 104 }, maxHeight: { xl: 'calc(100vh - 124px)' }, overflow: 'auto' }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.6}>
          <Tabs value={sideTab} onChange={(_, value: SideTab) => setSideTab(value)} variant="scrollable" allowScrollButtonsMobile>
            <Tab value="STRATEGY" label="Strategy" />
            <Tab value="RISK" label="Risk" />
            <Tab value="CONFLUENCES" label="Confluences" />
            <Tab value="EXECUTE" label="Execute" />
            <Tab value="JOURNAL" label="Journal" />
          </Tabs>

          {sideTab === 'STRATEGY' ? (
            <Stack spacing={1.4}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Strategy Focus</Typography>
                <Button size="small" startIcon={<ImportExportRoundedIcon />} onClick={openStrategyDialog}>Import</Button>
              </Stack>
              {strategySummary ? (
                <Box className="ws-subpanel" sx={{ p: 1.25 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{strategySummary.importedFrom}</Typography>
                    <Typography variant="body2" color="text.secondary">{strategySummary.model}</Typography>
                    <Typography variant="body2">{strategySummary.entrySummary}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={selectedSetup?.strategySnapshot?.source || 'Strategy'} />
                      {(selectedSetup?.strategySnapshot?.sessionSuitability || []).map((item) => <Chip key={item} size="small" label={item} />)}
                    </Stack>
                    <Button size="small" onClick={() => setStrategyDetailOpen(true)}>View full strategy</Button>
                  </Stack>
                </Box>
              ) : (
                <Box className="ws-subpanel" sx={{ p: 1.25 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Manual setup mode</Typography>
                    <Typography variant="body2" color="text.secondary">Use the checklist below without importing a strategy.</Typography>
                    <FormControlLabel
                      control={(
                        <Switch
                          checked={Boolean(selectedSetup?.manualSetupMode ?? true)}
                          onChange={(event) => updateSelectedSetup((current) => ({ ...current, manualSetupMode: event.target.checked }))}
                          disabled={!selectedSetup}
                        />
                      )}
                      label="Manual setup mode"
                    />
                  </Stack>
                </Box>
              )}
            </Stack>
          ) : null}

          {sideTab === 'RISK' ? (
            <Stack spacing={1.25}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Risk Guardrails</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <TextField label="Max loss" type="number" value={sessionDraft?.dailyMaxLoss ?? ''} onChange={(event) => setSessionDraft((current) => current ? { ...current, dailyMaxLoss: parseNumberInput(event.target.value) } : current)} />
                <TextField label="Profit target" type="number" value={sessionDraft?.profitTarget ?? ''} onChange={(event) => setSessionDraft((current) => current ? { ...current, profitTarget: parseNumberInput(event.target.value) } : current)} />
                <TextField label="Risk per trade" type="number" value={sessionDraft?.riskPerTrade ?? ''} onChange={(event) => setSessionDraft((current) => current ? { ...current, riskPerTrade: parseNumberInput(event.target.value) } : current)} />
                <TextField label="Max trades" type="number" value={sessionDraft?.maxTrades ?? ''} onChange={(event) => setSessionDraft((current) => current ? { ...current, maxTrades: parseNumberInput(event.target.value) } : current)} />
                <TextField label="Max consecutive losses" type="number" value={sessionDraft?.maxConsecutiveLosses ?? ''} onChange={(event) => setSessionDraft((current) => current ? { ...current, maxConsecutiveLosses: parseNumberInput(event.target.value) } : current)} sx={{ gridColumn: '1 / -1' }} />
              </Box>
              <FormControlLabel control={<Switch checked={Boolean(sessionDraft?.stopAfterTargetReached)} onChange={(event) => setSessionDraft((current) => current ? { ...current, stopAfterTargetReached: event.target.checked } : current)} />} label="Stop after target reached" />
              <FormControlLabel control={<Switch checked={sessionDraft?.stopAfterMaxLossReached ?? true} onChange={(event) => setSessionDraft((current) => current ? { ...current, stopAfterMaxLossReached: event.target.checked } : current)} />} label="Stop after max loss reached" />
              <Box className="ws-subpanel" sx={{ p: 1.25 }}>
                <Stack spacing={0.75}>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={`Risk used ${formatCurrency(workspace.session.quickStats.riskUsed, baseCurrency)}`} />
                    <Chip size="small" label={`Remaining ${formatCurrency(workspace.session.quickStats.remainingRisk, baseCurrency)}`} />
                    <Chip size="small" label={`${workspace.session.quickStats.remainingTrades ?? 0} trades left`} />
                  </Stack>
                  <Alert severity={riskConfigured && workspace.session.quickStats.tradingAllowed !== false ? 'success' : 'warning'}>
                    {riskConfigured ? 'Trading allowed by current guardrails.' : 'Complete all risk guardrails before locking.'}
                  </Alert>
                </Stack>
              </Box>
            </Stack>
          ) : null}

          {sideTab === 'CONFLUENCES' ? (
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Confluence Checklist</Typography>
                <Chip size="small" color={readinessColor(readinessLabel)} label={readinessLabel} />
              </Stack>
              {selectedSetup ? (
                <>
                  <Stack spacing={0.75}>
                    {dedupeConfluences(selectedSetup.confluences || []).map((item) => {
                      const isRiskItem = item.label.toLowerCase() === 'risk configured'
                      const checked = isRiskItem ? riskConfigured : item.checked
                      return (
                        <Box key={item.id} className="ws-subpanel" sx={{ p: 0.9 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Checkbox
                              checked={checked}
                              disabled={isRiskItem}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                confluences: current.confluences.map((row) => row.id === item.id ? { ...row, checked: event.target.checked } : row)
                              }))}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.label}</Typography>
                              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                <Chip size="small" variant="outlined" label={item.source} />
                                {item.required ? <Chip size="small" color="warning" variant="outlined" label="Required" /> : <Chip size="small" variant="outlined" label="Optional" />}
                              </Stack>
                            </Box>
                            <Switch
                              size="small"
                              checked={item.required}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                confluences: current.confluences.map((row) => row.id === item.id ? { ...row, required: event.target.checked } : row)
                              }))}
                              disabled={isRiskItem}
                            />
                            {item.source === 'CUSTOM' ? (
                              <IconButton size="small" onClick={() => updateSelectedSetup((current) => ({ ...current, confluences: current.confluences.filter((row) => row.id !== item.id) }))}>
                                <DeleteRoundedIcon fontSize="small" />
                              </IconButton>
                            ) : null}
                          </Stack>
                        </Box>
                      )
                    })}
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Add confluence" value={newConfluence} onChange={(event) => setNewConfluence(event.target.value)} fullWidth />
                    <Button
                      variant="outlined"
                      startIcon={<AddRoundedIcon />}
                      onClick={() => {
                        if (!newConfluence.trim()) return
                        updateSelectedSetup((current) => ({
                          ...current,
                          confluences: dedupeConfluences([...current.confluences, { id: generateId(), label: newConfluence.trim(), checked: false, required: true, source: 'CUSTOM' }])
                        }))
                        setNewConfluence('')
                      }}
                    >
                      Add
                    </Button>
                  </Stack>
                </>
              ) : (
                <EmptyState title="No setup selected" description="Create a setup to manage confluences." icon={<NotesRoundedIcon fontSize="inherit" />} />
              )}
            </Stack>
          ) : null}

          {sideTab === 'EXECUTE' ? (
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Execution</Typography>
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={addExecution} disabled={!selectedSetup}>New execution</Button>
              </Stack>
              {selectedExecution ? (
                <>
                  <Box className="ws-subpanel" sx={{ p: 1.25 }}>
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{selectedExecution.label}</Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={`RR ${activeRr != null ? formatNumber(activeRr, 2) : '—'}`} />
                        <Chip size="small" label={formatCurrency(selectedExecution.riskAmount, baseCurrency)} />
                      </Stack>
                    </Stack>
                  </Box>
                  <TextField label="Execution label" value={selectedExecution.label} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, label: event.target.value }))} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <TextField label="Risk amount" type="number" value={selectedExecution.riskAmount ?? ''} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, riskAmount: parseNumberInput(event.target.value) }))} />
                    <TextField label="Quantity" type="number" value={selectedExecution.quantity ?? ''} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, quantity: parseNumberInput(event.target.value) }))} />
                    <TextField label="Entry" type="number" value={selectedExecution.entryPrice ?? ''} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, entryPrice: parseNumberInput(event.target.value) }))} />
                    <TextField label="Stop loss" type="number" value={selectedExecution.stopLossPrice ?? ''} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, stopLossPrice: parseNumberInput(event.target.value) }))} />
                    <TextField label="Take profit" type="number" value={selectedExecution.takeProfitPrice ?? ''} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, takeProfitPrice: parseNumberInput(event.target.value) }))} sx={{ gridColumn: '1 / -1' }} />
                  </Box>
                  <TextField label="Execution invalidation" value={selectedExecution.invalidation || ''} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, invalidation: event.target.value }))} multiline minRows={2} />
                  {workspace.session.lockedInAt ? (
                    <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => void handleQuickLogAction('ENTRY_TAKEN')}>
                      Mark active
                    </Button>
                  ) : (
                    <Alert severity="warning">Lock the Today Plan before starting execution.</Alert>
                  )}
                </>
              ) : (
                <EmptyState title="No execution ticket" description="Create an execution ticket after the plan is locked." icon={<PlayArrowRoundedIcon fontSize="inherit" />} />
              )}
            </Stack>
          ) : null}

          {sideTab === 'JOURNAL' ? (
            <Stack spacing={1.25}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Quick Log</Typography>
              <TextField label="Quick note" value={quickNote} onChange={(event) => setQuickNote(event.target.value)} multiline minRows={2} />
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {quickLogActions.map((action) => (
                  <Button key={action.id} size="small" variant={action.id === 'ENTRY_TAKEN' ? 'contained' : 'outlined'} onClick={() => void handleQuickLogAction(action.id)}>
                    {action.title}
                  </Button>
                ))}
              </Stack>
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Activity Timeline</Typography>
              {timeline.length > 0 ? timeline.slice(0, 8).map((entry) => <TimelineEntryCard key={entry.id} entry={entry} timezone={timezone} />) : (
                <EmptyState title="No activity yet" description="Plan changes and execution events appear here." icon={<TimelineRoundedIcon fontSize="inherit" />} />
              )}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )

  const periodEditor = (scope: 'WEEKLY' | 'MONTHLY', plan: PeriodPlan | undefined, draft: PeriodPlanDraft | null, setDraft: (updater: (current: PeriodPlanDraft | null) => PeriodPlanDraft | null) => void) => (
    <Card className="ws-panel">
      <CardContent sx={{ p: 2.2 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2}>
            <Stack spacing={0.4}>
              <Chip size="small" color={plan?.exists ? 'success' : 'default'} label={plan?.exists ? `Active ${scope.toLowerCase()} plan` : `Create this ${scope.toLowerCase()} plan`} />
              <Typography variant="h5" sx={{ fontWeight: 900 }}>{scope === 'WEEKLY' ? 'Weekly Plan' : 'Monthly Plan'}</Typography>
              <Typography variant="body2" color="text.secondary">{periodRange(plan, timezone)}</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              {plan?.exists ? (
                <Button
                  variant="text"
                  color="error"
                  size="small"
                  startIcon={<DeleteRoundedIcon />}
                  onClick={() => requestRemovePlan(scope, plan)}
                >
                  Remove plan
                </Button>
              ) : null}
              <Button variant="contained" onClick={saveCurrentPeriodPlan}>{plan?.exists ? 'Save plan' : 'Create plan'}</Button>
            </Stack>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.2 }}>
            <TextField label="Title" value={draft?.title || ''} onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)} />
            <TextField label={scope === 'WEEKLY' ? 'Weekly bias' : 'Monthly bias/context'} value={draft?.bias || ''} onChange={(event) => setDraft((current) => current ? { ...current, bias: event.target.value } : current)} />
            <TextField label="Focus symbols" value={draft?.focusSymbols || ''} onChange={(event) => setDraft((current) => current ? { ...current, focusSymbols: event.target.value } : current)} helperText="Comma-separated" />
            <TextField label={scope === 'WEEKLY' ? 'Weekly objectives' : 'Monthly target'} value={draft?.objectives || ''} onChange={(event) => setDraft((current) => current ? { ...current, objectives: event.target.value } : current)} />
            <TextField label={scope === 'WEEKLY' ? 'Weekly max loss' : 'Monthly max loss'} type="number" value={draft?.maxLoss ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, maxLoss: parseNumberInput(event.target.value) } : current)} />
            <TextField label={scope === 'WEEKLY' ? 'Weekly target' : 'Monthly target value'} type="number" value={draft?.target ?? ''} onChange={(event) => setDraft((current) => current ? { ...current, target: parseNumberInput(event.target.value) } : current)} />
          </Box>
          <TextField label="Notes" value={draft?.notes || ''} onChange={(event) => setDraft((current) => current ? { ...current, notes: event.target.value } : current)} multiline minRows={3} />
          {scope === 'MONTHLY' ? (
            <TextField label="Review / intentions" value={draft?.reviewIntentions || ''} onChange={(event) => setDraft((current) => current ? { ...current, reviewIntentions: event.target.value } : current)} multiline minRows={2} />
          ) : null}
          <PlanImagesSection
            title={`${scope === 'WEEKLY' ? 'Weekly' : 'Monthly'} Plan Images`}
            storageLabel={plan?.exists ? planCalendarStorageLabel(scope, plan) : `Save this ${scope.toLowerCase()} plan before uploading images.`}
            images={plan?.images || []}
            uploads={planImageUploads[scope]}
            disabled={!plan?.exists}
            disabledReason={!plan?.exists ? `Create this ${scope.toLowerCase()} plan before uploading images.` : undefined}
            deletingIds={deletingPlanImageIds}
            onUpload={(files) => void handleUploadPlanImages(scope, files)}
            onDelete={(image) => void handleDeletePlanImage(scope, image)}
            onRetry={() => void queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] })}
            onOpenCalendar={() => openPlanInCalendar(scope)}
          />
        </Stack>
      </CardContent>
    </Card>
  )

  return (
    <Stack spacing={2} sx={(theme) => ({
      minWidth: 0,
      pb: 3,
      '--ws-panel-radius': '12px',
      '--ws-tile-radius': '10px',
      '--ws-border': alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.78 : 0.66),
      '& .ws-panel': {
        border: '1px solid var(--ws-border)',
        borderRadius: 'var(--ws-panel-radius)',
        background: theme.palette.background.paper,
        boxShadow: theme.palette.mode === 'dark' ? '0 18px 42px rgba(0,0,0,0.28)' : '0 18px 42px rgba(15,23,42,0.07)'
      },
      '& .ws-subpanel': {
        border: '1px solid var(--ws-border)',
        borderRadius: 'var(--ws-tile-radius)',
        background: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.05 : 0.035)
      },
      '& .MuiOutlinedInput-root': { borderRadius: '10px' }
    })}>
      <Card className="ws-panel" sx={{ position: 'sticky', top: 16, zIndex: 6 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.35 }, '&:last-child': { pb: { xs: 2, md: 2.35 } } }}>
          <Stack spacing={1.6}>
            <Stack direction={{ xs: 'column', xl: 'row' }} justifyContent="space-between" spacing={1.6}>
              <Stack spacing={0.8}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Chip color="primary" label="Trader Plan Workstation" />
                  <Chip color={readinessColor(readinessLabel)} icon={workspace.session.lockedInAt ? <LockRoundedIcon /> : <LockOpenRoundedIcon />} label={readinessLabel} />
                  <Chip variant="outlined" label={formatDate(workspace.session.tradingDate, timezone)} />
                  <Chip variant="outlined" label={selectedSetup ? `${selectedSetup.symbol} / ${formatDirection(selectedSetup.direction)}` : 'No setup selected'} />
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>Session Mode</Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                <Button variant="outlined" startIcon={<ImportExportRoundedIcon />} onClick={openStrategyDialog} disabled={!todayPlanActive}>Import strategy</Button>
                <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)} disabled={!todayPlanActive}>Add setup</Button>
                <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => planScope === 'TODAY' ? setCreateDialogOpen(true) : saveCurrentPeriodPlan()} disabled={planScope === 'TODAY' && !todayPlanActive}>
                  Add plan/session
                </Button>
                <Button variant="outlined" startIcon={<BoltRoundedIcon />} onClick={(event) => setQuickLogAnchorEl(event.currentTarget)} disabled={!selectedSetup}>Quick log</Button>
                <Button
                  variant={workspace.session.lockedInAt ? 'outlined' : 'contained'}
                  startIcon={workspace.session.lockedInAt ? <LockOpenRoundedIcon /> : <LockRoundedIcon />}
                  disabled={!todayPlanActive || (!workspace.session.lockedInAt && !canLock)}
                  onClick={() => updateSessionMutation.mutate({
                    sessionId: workspace.session.id,
                    data: {
                      ...toSessionPayload(sessionDraft || toSessionDraft(workspace.session)),
                      lockSession: !Boolean(workspace.session.lockedInAt)
                    },
                    signature: sessionSignatureRef.current
                  })}
                >
                  {workspace.session.lockedInAt ? 'Unlock session' : 'Lock session'}
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' }, gap: 1 }}>
              <SurfaceMetric label="Selected setup" value={selectedSetup?.setupTitle || '—'} detail={selectedSetup?.symbol} />
              <SurfaceMetric label="Max loss" value={formatCurrency(workspace.session.quickStats.maxLoss, baseCurrency)} />
              <SurfaceMetric label="Profit target" value={formatCurrency(workspace.session.quickStats.profitTarget, baseCurrency)} />
              <SurfaceMetric label="Risk used" value={formatCurrency(workspace.session.quickStats.riskUsed, baseCurrency)} />
              <SurfaceMetric label="Realized PnL" value={formatSignedCurrency(workspace.session.quickStats.realizedPnl, baseCurrency)} />
              <SurfaceMetric label="Remaining risk" value={formatCurrency(workspace.session.quickStats.remainingRisk, baseCurrency)} />
              <SurfaceMetric label="Setups" value={workspace.setups.length} detail={`${workspace.session.quickStats.remainingTrades ?? 0} trades left`} />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {feedback ? <Alert severity="info" onClose={() => setFeedback(null)}>{feedback}</Alert> : null}
      {workspace.session.readiness.blockers.length > 0 && !workspace.session.lockedInAt ? (
        <Alert severity="warning">
          <AlertTitle>Plan not ready to lock</AlertTitle>
          {workspace.session.readiness.blockers.join(', ')}
        </Alert>
      ) : null}

      <Card className="ws-panel">
        <CardContent sx={{ p: 1.4 }}>
          <Stack spacing={1.25}>
            <Tabs value={planScope} onChange={(_, value: PlanScopeTab) => setPlanScope(value)} variant="fullWidth">
              <Tab value="TODAY" label="Today Plan" />
              <Tab value="WEEKLY" label="Weekly Plan" />
              <Tab value="MONTHLY" label="Monthly Plan" />
            </Tabs>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
              <Box className="ws-subpanel" sx={{ p: 1.1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Monthly Plan</Typography>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>{workspace.planningContext?.monthly?.bias || 'No monthly bias set'}</Typography>
                <Typography variant="caption" color="text.secondary">{periodRange(workspace.planningContext?.monthly, timezone)}</Typography>
                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                  <Chip size="small" color={workspace.planningContext?.monthly?.exists ? 'success' : 'default'} label={workspace.planningContext?.monthly?.exists ? 'Saved to Calendar' : 'Not saved'} />
                  <Chip size="small" variant="outlined" label={`${workspace.planningContext?.monthly?.imageCount || 0} images`} />
                </Stack>
              </Box>
              <Box className="ws-subpanel" sx={{ p: 1.1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Weekly Plan</Typography>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>{workspace.planningContext?.weekly?.objectives || workspace.planningContext?.weekly?.bias || 'No weekly focus set'}</Typography>
                <Typography variant="caption" color="text.secondary">{periodRange(workspace.planningContext?.weekly, timezone)}</Typography>
                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                  <Chip size="small" color={workspace.planningContext?.weekly?.exists ? 'success' : 'default'} label={workspace.planningContext?.weekly?.exists ? 'Saved to Calendar' : 'Not saved'} />
                  <Chip size="small" variant="outlined" label={`${workspace.planningContext?.weekly?.imageCount || 0} images`} />
                </Stack>
              </Box>
              <Box className="ws-subpanel" sx={{ p: 1.1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Today Plan</Typography>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>{todayPlanActive ? selectedSetup?.setupTitle || 'Create or select a setup' : 'No active Today Plan'}</Typography>
                <Typography variant="caption" color="text.secondary">{todayPlanActive ? workspace.session.lockedInAt ? 'Locked for execution' : 'Planning' : 'Removed from active planning'}</Typography>
                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                  <Chip size="small" color={todayPlanActive ? 'success' : 'default'} label={todayPlanActive ? 'Visible in Calendar' : 'Not active'} />
                  <Chip size="small" variant="outlined" label={`${todayPlanActive ? workspace.planningContext?.today?.imageCount || 0 : 0} images`} />
                </Stack>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {planScope === 'WEEKLY' ? periodEditor('WEEKLY', workspace.planningContext?.weekly, weeklyDraft, setWeeklyDraft) : null}
      {planScope === 'MONTHLY' ? periodEditor('MONTHLY', workspace.planningContext?.monthly, monthlyDraft, setMonthlyDraft) : null}

      {planScope === 'TODAY' ? (
        <Stack spacing={1.25}>
          <Box className="ws-subpanel" sx={{ p: { xs: 1.25, sm: 1.5 }, minWidth: 0 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                <Chip size="small" color={todayPlanActive ? 'success' : 'default'} label={todayPlanActive ? 'Active today plan' : 'No active today plan'} />
                <Typography variant="h5" sx={{ fontWeight: 900 }}>Today Plan</Typography>
                <Typography variant="body2" color="text.secondary">{periodRange(todayPlan, timezone)}</Typography>
              </Stack>
              {todayPlanActive && todayPlan ? (
                <Button
                  variant="text"
                  color="error"
                  size="small"
                  startIcon={<DeleteRoundedIcon />}
                  onClick={() => requestRemovePlan('TODAY', todayPlan)}
                  sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
                >
                  Remove plan
                </Button>
              ) : null}
            </Stack>
          </Box>

          {todayPlanActive ? (
            <PlanImagesSection
              title="Today Plan Images"
              storageLabel={planCalendarStorageLabel('TODAY', workspace.planningContext?.today)}
              images={workspace.planningContext?.today?.images || []}
              uploads={planImageUploads.TODAY}
              deletingIds={deletingPlanImageIds}
              onUpload={(files) => void handleUploadPlanImages('TODAY', files)}
              onDelete={(image) => void handleDeletePlanImage('TODAY', image)}
              onRetry={() => void queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] })}
              onOpenCalendar={() => openPlanInCalendar('TODAY')}
            />
          ) : (
            <EmptyState title="No active Today Plan" description="The removed plan is hidden from Session Mode and Calendar." icon={<NotesRoundedIcon fontSize="inherit" />} />
          )}
        </Stack>
      ) : null}

      {planScope === 'TODAY' && todayPlanActive ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '300px minmax(0, 1fr) 390px' }, gap: 2, alignItems: 'start' }}>
          <Card className="ws-panel" component="aside" sx={{ position: { xl: 'sticky' }, top: { xl: 104 } }}>
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={1.3}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>Setups</Typography>
                  <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>Add</Button>
                </Stack>
                {workspace.setups.length ? workspace.setups.map((setup) => (
                  <Box
                    key={setup.id}
                    className="ws-subpanel"
                    sx={(theme) => ({
                      p: 1.15,
                      borderColor: selectedSetup?.id === setup.id ? theme.palette.primary.main : 'var(--ws-border)',
                      background: selectedSetup?.id === setup.id ? alpha(theme.palette.primary.main, 0.11) : undefined
                    })}
                  >
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 900 }} noWrap>{setup.setupTitle}</Typography>
                          <Typography variant="caption" color="text.secondary">{setup.symbol} / {formatDirection(setup.direction)}</Typography>
                        </Box>
                        <Chip size="small" color={chipColorForStatus(setup.status)} label={setup.status.replaceAll('_', ' ')} />
                      </Stack>
                      <LinearProgress variant="determinate" value={setup.readiness.score} />
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                        <Chip size="small" variant="outlined" label={`${setup.readiness.score}%`} />
                        {setup.strategySnapshot?.name ? <Chip size="small" variant="outlined" label={setup.strategySnapshot.name} /> : <Chip size="small" variant="outlined" label="Manual" />}
                      </Stack>
                      <Stack direction="row" spacing={0.6}>
                        <Button size="small" variant={selectedSetup?.id === setup.id ? 'contained' : 'text'} onClick={() => handleSelectSetup(setup.id)}>Open</Button>
                        <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => duplicateSetupMutation.mutate({ sessionId: workspace.session.id, setupId: setup.id })}>Duplicate</Button>
                      </Stack>
                    </Stack>
                  </Box>
                )) : (
                  <EmptyState title="No setups yet" description="Add a setup to drive the chart and checklist." icon={<AddRoundedIcon fontSize="inherit" />} />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={2}>
            <Card className="ws-panel">
              <CardContent sx={{ p: 2.15 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2}>
                    <Stack spacing={0.35}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CandlestickChartRoundedIcon color="primary" />
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>Chart Workspace</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">The selected setup symbol drives the live chart.</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                      <Chip color={readinessColor(readinessLabel)} label={readinessLabel} />
                      <Typography variant="caption" color="text.secondary">{autoSaveState}</Typography>
                    </Stack>
                  </Stack>

                  <Box sx={{ minHeight: 650, borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--ws-border)', backgroundColor: '#050608' }}>
                    {deferredChartSymbol ? (
                      <TradingViewWidget symbol={deferredChartSymbol} interval={deferredChartInterval} minHeight={650} fallbackMessage={t('today.mentor.liveChartFallback')} fallbackLinkLabel={t('today.mentor.openOnTradingView')} />
                    ) : (
                      <EmptyState sx={{ minHeight: 650, border: 0 }} title="Select a setup symbol" description="The chart appears as soon as a setup has a symbol." icon={<CandlestickChartRoundedIcon fontSize="inherit" />} />
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card className="ws-panel">
              <CardContent sx={{ p: 2 }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>Setup Editor</Typography>
                  {selectedSetup ? (
                    <>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 0.8fr 0.8fr' }, gap: 1.1 }}>
                        <TextField label="Setup title" value={selectedSetup.setupTitle} onChange={(event) => updateSelectedSetup((current) => ({ ...current, setupTitle: event.target.value }))} />
                        <TextField label="Symbol" value={selectedSetup.symbol} onChange={(event) => updateSelectedSetup((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} />
                        <FormControl fullWidth>
                          <InputLabel id="setup-direction-label">Direction</InputLabel>
                          <Select labelId="setup-direction-label" label="Direction" value={selectedSetup.direction} onChange={(event) => updateSelectedSetup((current) => ({ ...current, direction: event.target.value as SetupItem['direction'] }))}>
                            {directionOptions.map((direction) => <MenuItem key={direction} value={direction}>{formatDirection(direction)}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Box>
                      <TextField label="Setup note" value={selectedSetup.context.notes || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, context: { ...current.context, notes: event.target.value } }))} multiline minRows={2} />
                      <Box className="ws-subpanel" sx={{ p: 1.25 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Advanced details</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1, mt: 1 }}>
                          <TextField label="Invalidation note" value={selectedSetup.context.invalidationIdea || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, context: { ...current.context, invalidationIdea: event.target.value } }))} multiline minRows={2} />
                          <TextField label="Target note" value={selectedSetup.trigger.entryZone || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, entryZone: event.target.value } }))} multiline minRows={2} />
                        </Box>
                      </Box>
                    </>
                  ) : (
                    <EmptyState title="No setup selected" description="Create a setup to edit title, symbol, and direction." icon={<NotesRoundedIcon fontSize="inherit" />} />
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          {sidePanel}
        </Box>
      ) : null}

      <Menu anchorEl={quickLogAnchorEl} open={Boolean(quickLogAnchorEl)} onClose={() => setQuickLogAnchorEl(null)}>
        {quickLogActions.map((action) => (
          <MenuItem key={action.id} onClick={() => void handleQuickLogAction(action.id)}>{action.title}</MenuItem>
        ))}
      </Menu>

      <Dialog open={Boolean(planRemovalTarget)} onClose={() => setPlanRemovalTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Remove plan</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.25}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {planRemovalTarget ? planRemovalLead(planRemovalTarget.scope) : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Uploaded images will no longer be shown with the removed plan. Setups linked only to this plan will no longer appear in active planning. This does not delete trades or executions already recorded.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 } }}>
          <Button onClick={() => setPlanRemovalTarget(null)} disabled={removePlanMutation.isPending}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmRemovePlan} disabled={removePlanMutation.isPending}>
            Remove plan
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add setup</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.4} sx={{ mt: 0.5 }}>
            <TextField autoFocus label="Symbol" value={createSetupDraft.symbol} onChange={(event) => setCreateSetupDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} />
            <FormControl fullWidth>
              <InputLabel id="create-direction-label">Direction</InputLabel>
              <Select labelId="create-direction-label" label="Direction" value={createSetupDraft.direction} onChange={(event) => setCreateSetupDraft((current) => ({ ...current, direction: event.target.value as CreateSetupDraft['direction'] }))}>
                {directionOptions.map((direction) => <MenuItem key={direction} value={direction}>{formatDirection(direction)}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Setup title" value={createSetupDraft.setupTitle} onChange={(event) => setCreateSetupDraft((current) => ({ ...current, setupTitle: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSetup} disabled={!createSetupDraft.symbol.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={strategyDetailOpen} onClose={() => setStrategyDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Strategy details</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedSetup?.strategySnapshot ? (
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>{selectedSetup.strategySnapshot.name || '—'}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedSetup.strategySnapshot.model || '—'}</Typography>
              {selectedSetup.strategySnapshot.entryConditionsRich ? <RichTextContent html={selectedSetup.strategySnapshot.entryConditionsRich} /> : <Typography variant="body2">{selectedSetup.strategySnapshot.entryConditions?.join(' / ') || '—'}</Typography>}
              <Divider />
              <Typography variant="body2"><strong>Invalidation:</strong> {selectedSetup.strategySnapshot.invalidationLogic || '—'}</Typography>
              <Typography variant="body2"><strong>Targets:</strong> {selectedSetup.strategySnapshot.tpFramework || '—'}</Typography>
              <Typography variant="body2"><strong>Avoid:</strong> {selectedSetup.strategySnapshot.noTradeRules || '—'}</Typography>
            </Stack>
          ) : <EmptyState title="No strategy imported" description="Import a strategy or stay in manual setup mode." icon={<ImportExportRoundedIcon fontSize="inherit" />} />}
        </DialogContent>
        <DialogActions><Button onClick={() => setStrategyDetailOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={strategyDialogOpen} onClose={() => setStrategyDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Import strategy</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' }, gap: 2, mt: 0.5 }}>
            <Stack spacing={1.25}>
              <TextField label="Search" value={importDraft.search} onChange={(event) => setImportDraft((current) => ({ ...current, search: event.target.value }))} InputProps={{ startAdornment: <SearchRoundedIcon fontSize="small" style={{ marginRight: 8 }} /> }} />
              <FormControl fullWidth>
                <InputLabel id="strategy-source-label">Source</InputLabel>
                <Select labelId="strategy-source-label" label="Source" value={importDraft.source} onChange={(event) => setImportDraft((current) => ({ ...current, source: event.target.value as StrategyImportDraft['source'] }))}>
                  <MenuItem value="ALL">All strategies</MenuItem>
                  <MenuItem value="MY">My strategies</MenuItem>
                  <MenuItem value="MENTOR">Mentor strategies</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel control={<Switch checked={importDraft.createNewSetup || !selectedSetup} onChange={(event) => setImportDraft((current) => ({ ...current, createNewSetup: event.target.checked }))} />} label="Create new setup" />
              {(importDraft.createNewSetup || !selectedSetup) ? (
                <Stack spacing={1.1}>
                  <TextField label="Symbol" value={importDraft.symbol} onChange={(event) => setImportDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} />
                  <FormControl fullWidth>
                    <InputLabel id="import-direction-label">Direction</InputLabel>
                    <Select labelId="import-direction-label" label="Direction" value={importDraft.direction} onChange={(event) => setImportDraft((current) => ({ ...current, direction: event.target.value as StrategyImportDraft['direction'] }))}>
                      {directionOptions.map((direction) => <MenuItem key={direction} value={direction}>{formatDirection(direction)}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField label="Setup title" value={importDraft.setupTitle} onChange={(event) => setImportDraft((current) => ({ ...current, setupTitle: event.target.value }))} />
                </Stack>
              ) : <Alert severity="info">Import into {selectedSetup.setupTitle}.</Alert>}
              <Divider />
              <Stack spacing={1}>
                {strategiesQuery.isLoading ? <LoadingState rows={5} height={18} /> : strategyList.length ? strategyList.map((strategy) => (
                  <Box key={strategy.id} className="ws-subpanel" sx={{ p: 1.1, cursor: 'pointer', borderColor: selectedStrategyId === strategy.id ? 'primary.main' : 'var(--ws-border)' }} onClick={() => {
                    setSelectedStrategyId(strategy.id)
                    setImportDraft((current) => ({ ...current, setupTitle: current.setupTitle || strategy.name, symbol: current.symbol || selectedSetup?.symbol || '' }))
                  }}>
                    <Stack spacing={0.45}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>{strategy.name}</Typography>
                        <Chip size="small" label={strategy.source} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{strategy.model}</Typography>
                      <Typography variant="caption" color="text.secondary">{(strategy.entryConditions || []).slice(0, 3).join(' / ')}</Typography>
                    </Stack>
                  </Box>
                )) : <EmptyState title="No strategies" description="Create a strategy first or continue in manual setup mode." icon={<ImportExportRoundedIcon fontSize="inherit" />} />}
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
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {strategyConfluences(selectedStrategy).slice(0, 8).map((item) => <Chip key={item.id} size="small" variant="outlined" label={item.label} />)}
                  </Stack>
                  {selectedStrategy.entryConditionsRich ? <RichTextContent html={selectedStrategy.entryConditionsRich} /> : <Typography variant="body2">{(selectedStrategy.entryConditions || []).join(' / ') || '—'}</Typography>}
                  <Divider />
                  <Typography variant="body2"><strong>Invalidation:</strong> {selectedStrategy.invalidationLogic || '—'}</Typography>
                  <Typography variant="body2"><strong>Targets:</strong> {selectedStrategy.tpFramework || '—'}</Typography>
                  <Typography variant="body2"><strong>Avoid:</strong> {selectedStrategy.noTradeRules || '—'}</Typography>
                </Stack>
              ) : <EmptyState title="Select a strategy" description="The selected strategy imports a compact snapshot and checklist." icon={<ImportExportRoundedIcon fontSize="inherit" />} />}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStrategyDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleImportStrategy} disabled={!selectedStrategy || ((importDraft.createNewSetup || !selectedSetup) && !importDraft.symbol.trim())}>Import</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

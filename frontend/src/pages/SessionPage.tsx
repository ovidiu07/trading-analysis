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
  Menu,
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
import type { AlertColor, ChipProps } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
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
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
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
  type ReviewTimelineEntry,
  type SetupItem,
  type SetupStatus
} from '../api/liveWorkspace'
import { fetchTodayMentorPlan, type DailyPlan } from '../api/plans'
import { listStrategies, type StrategyResponse } from '../api/strategies'
import { useAuth } from '../auth/AuthContext'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import RichTextContent from '../components/ui/RichTextContent'
import {
  applyStrategyImport,
  appendTimeline,
  buildQuickLogUpdate,
  buildTimeline,
  computeRr,
  createMentorReference,
  createTimelineEntry,
  ensureExecutionWorkspace,
  ensureTicket,
  ensureWorkspace,
  executionStatusOptions,
  extractMentorLevels,
  findCurrentExecution,
  focusLevelsForSetup,
  formatDirection,
  generateId,
  getNextAction,
  getSetupInsight,
  getTriggerStateFromStatus,
  getTriggerStatus,
  latestSetupAction,
  marketOptions,
  markStrategyDirty,
  mentorMatchesSetup,
  mergeMentorLevels,
  parseNumberInput,
  parseTags,
  quickLogActions,
  sessionOptions,
  summarizeStrategySnapshot,
  toSessionDraft,
  toSessionPayload,
  toSetupPayload,
  toTagValue,
  toTradingViewSymbol,
  type CaptureDrawerMode,
  type CompareMode,
  type CreateSetupDraft,
  type FocusLevel,
  type QuickLogActionId,
  type SessionDraft,
  type StrategyImportDraft,
  type WorkstationDensity
} from '../features/session-workstation/sessionWorkstation'
import { useI18n } from '../i18n'
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatSignedCurrency } from '../utils/format'

const journalMistakePresetKeys = ['fomo', 'earlyExit', 'movedStop', 'oversized', 'newsTrade', 'noJournal'] as const
const journalLessonPresetKeys = ['confirmation', 'invalidation', 'breakeven', 'partials', 'smallerSize', 'skipNoise'] as const

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
    '& .MuiOutlinedInput-root': {
      borderRadius: 'var(--ws-control-radius)',
      backgroundColor: dark ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.white, 0.94)
    }
  }
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

function chipColorForTriggerStatus(status: string): ChipProps['color'] {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'INVALIDATED') return 'error'
  if (status === 'WATCHING') return 'primary'
  return 'warning'
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
    <Box className="ws-subpanel" sx={{ p: 1.6 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.45, fontWeight: 800 }}>
        {value}
      </Typography>
      {detail ? (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      ) : null}
    </Box>
  )
}

function SetupStatusChip({ status }: { status: SetupStatus }) {
  return <Chip size="small" color={chipColorForSetupStatus(status)} label={status.replaceAll('_', ' ')} />
}

function ReadinessChip({ state, label }: { state: string; label: string }) {
  return <Chip size="small" color={chipColorForReadiness(state)} label={label} />
}

function TriggerStateChip({ status }: { status: string }) {
  return <Chip size="small" color={chipColorForTriggerStatus(status)} label={status.replaceAll('_', ' ')} />
}

function TimelineEntryCard({
  entry,
  timezone,
  onFocusExecution
}: {
  entry: ReviewTimelineEntry
  timezone: string
  onFocusExecution?: (executionId: string) => void
}) {
  return (
    <Box className="ws-subpanel" sx={{ p: 1.3, position: 'relative', overflow: 'hidden' }}>
      <Box
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.65)}`,
          pointerEvents: 'none'
        })}
      />
      <Stack spacing={0.6}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.75}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {entry.title || 'Event'}
            </Typography>
            {entry.executionId ? <Chip size="small" variant="outlined" label={`Execution ${entry.executionId.slice(0, 6)}`} /> : null}
            {entry.tradeId ? <Chip size="small" variant="outlined" label={`Trade ${entry.tradeId.slice(0, 6)}`} /> : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {entry.occurredAt ? formatDateTime(entry.occurredAt, timezone) : '—'}
          </Typography>
        </Stack>
        {entry.body ? (
          <Typography variant="body2" color="text.secondary">
            {entry.body}
          </Typography>
        ) : null}
        {entry.executionId && onFocusExecution ? (
          <Stack direction="row" justifyContent="flex-end">
            <Button size="small" onClick={() => onFocusExecution(entry.executionId as string)}>
              Focus execution
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  )
}

export default function SessionPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'

  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)
  const [setupDraft, setSetupDraft] = useState<SetupItem | null>(null)
  const [drawerMode, setDrawerMode] = useState<CaptureDrawerMode>('PLAN')
  const [compareModeState, setCompareModeState] = useState<CompareMode>('BOTH')
  const [showLevels, setShowLevels] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [density, setDensity] = useState<WorkstationDensity>('COMPACT')
  const [mentorExpanded, setMentorExpanded] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false)
  const [strategyDetailOpen, setStrategyDetailOpen] = useState(false)
  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false)
  const [quickLogAnchorEl, setQuickLogAnchorEl] = useState<null | HTMLElement>(null)
  const [focusedLevelId, setFocusedLevelId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [quickNote, setQuickNote] = useState('')
  const [createSetupDraft, setCreateSetupDraft] = useState<CreateSetupDraft>({ symbol: '', direction: 'UNDECIDED', setupTitle: '' })
  const [importDraft, setImportDraft] = useState<StrategyImportDraft>({
    search: '',
    source: 'ALL',
    createNewSetup: false,
    symbol: '',
    direction: 'UNDECIDED',
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
    mutationFn: (payload: { sessionId: string; data: ReturnType<typeof toSessionPayload>; signature: string }) =>
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
    mutationFn: (payload: { sessionId: string; setupId: string; data: ReturnType<typeof toSetupPayload>; signature: string }) =>
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
    mutationFn: (payload: { sessionId: string; data: ReturnType<typeof toSetupPayload> }) =>
      createSetupCandidate(payload.sessionId, payload.data),
    onSuccess: (workspace) => {
      applyWorkspace(workspace, workspace.setups[workspace.setups.length - 1]?.id || workspace.activeSetupId || null)
      setCreateDialogOpen(false)
      setCreateSetupDraft({ symbol: '', direction: 'UNDECIDED', setupTitle: '' })
      setFeedback(t('today.session.workstation.feedback.setupAdded'))
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
      setFeedback(t('today.session.workstation.feedback.setupDuplicated'))
    }
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setupId: string; status: SetupStatus }) =>
      updateSetupCandidateStatus(payload.sessionId, payload.setupId, payload.status),
    onSuccess: (workspace, variables) => {
      applyWorkspace(workspace, variables.setupId)
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
      setFeedback(t('today.session.workstation.feedback.tradeStarted'))
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

  useEffect(() => {
    setQuickNote('')
  }, [selectedSetupId])

  const workspace = workspaceQuery.data
  const selectedSetup = setupDraft || workspace?.setups.find((item) => item.id === selectedSetupId) || null
  const selectedSetupIsPersisted = Boolean(selectedSetup && workspace?.setups.some((item) => item.id === selectedSetup.id))
  const selectedExecution = selectedSetup?.executions.tickets.find((ticket) => ticket.id === selectedSetup.executions.activeExecutionId)
    || selectedSetup?.executions.tickets[0]
    || null
  const mentorRelevant = mentorMatchesSetup(mentorPlanQuery.data, selectedSetup)
  const visibleLevels = useMemo(
    () => (selectedSetup ? focusLevelsForSetup(selectedSetup, mentorRelevant ? mentorPlanQuery.data : null, compareModeState) : []),
    [compareModeState, mentorPlanQuery.data, mentorRelevant, selectedSetup]
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
      const activeExecutionId = current.executions.activeExecutionId || current.executions.tickets[0]?.id
      const tickets = current.executions.tickets.map((ticket, index) => (
        ticket.id === activeExecutionId
          ? ensureTicket({
            ...updater(ticket),
            updatedAt: new Date().toISOString()
          }, index)
          : ticket
      ))
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
    setDrawerMode('EXECUTE')
  }

  const addExecution = (cloneFrom?: ExecutionTicket | null) => {
    updateSelectedSetup((current) => {
      const ticket = cloneFrom
        ? {
          ...cloneFrom,
          id: generateId(),
          label: `${cloneFrom.label} Copy`,
          status: 'DRAFT' as const,
          linkedTradeId: null,
          startedAt: null,
          closedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
        : {
          id: generateId(),
          label: `Execution ${current.executions.tickets.length + 1}`,
          status: 'DRAFT' as const,
          createdAt: new Date().toISOString()
        }
      return appendTimeline(ensureExecutionWorkspace({
        ...current,
        executions: {
          activeExecutionId: ticket.id,
          tickets: [...current.executions.tickets, ticket]
        }
      }), createTimelineEntry('execution_created', cloneFrom ? 'Execution cloned' : 'Execution created', ticket.label, ticket.id))
    }, { markStrategyDirty: false })
    setDrawerMode('EXECUTE')
  }

  const removeDraftExecution = () => {
    if (!selectedSetup || !selectedExecution) return
    if (selectedExecution.status !== 'DRAFT' || selectedExecution.linkedTradeId) return
    updateSelectedSetup((current) => {
      const remaining = current.executions.tickets.filter((ticket) => ticket.id !== selectedExecution.id)
      const fallback = remaining.length > 0
        ? remaining
        : [{
          id: generateId(),
          label: 'Execution 1',
          status: 'DRAFT' as const,
          createdAt: new Date().toISOString()
        }]
      return appendTimeline(ensureExecutionWorkspace({
        ...current,
        executions: {
          activeExecutionId: fallback[0]?.id || null,
          tickets: fallback
        }
      }), createTimelineEntry('execution_deleted', 'Draft execution removed', selectedExecution.label, selectedExecution.id))
    }, { markStrategyDirty: false })
    setFeedback(t('today.session.workstation.feedback.executionRemoved'))
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

  const handleCreateSetup = () => {
    if (!workspace) return
    createSetupMutation.mutate({
      sessionId: workspace.session.id,
      data: toSetupPayload(ensureExecutionWorkspace({
        id: `draft-${generateId()}`,
        symbol: createSetupDraft.symbol.trim().toUpperCase(),
        direction: createSetupDraft.direction,
        market: 'FOREX',
        tradeSession: null,
        strategyId: null,
        strategyLabel: '',
        setupTitle: createSetupDraft.setupTitle.trim() || createSetupDraft.symbol.trim().toUpperCase(),
        biasAlignment: '',
        status: 'DRAFT',
        linkedTradeId: null,
        readiness: selectedSetup?.readiness || workspace.session.readiness,
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
        sortOrder: workspace.setups.length,
        createdAt: null,
        updatedAt: null
      } as SetupItem))
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
    setFeedback(t('today.session.workstation.feedback.mentorApplied'))
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
          readiness: selectedSetup?.readiness || workspace.session.readiness,
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
          mentorReference: selectedSetup?.mentorReference || null,
          sortOrder: workspace.setups.length,
          createdAt: null,
          updatedAt: null
        } as SetupItem), selectedStrategy))
      })
      setFeedback(t('today.session.workstation.feedback.strategyImportedNew'))
    } else {
      updateSelectedSetup((current) => applyStrategyImport(current, selectedStrategy), { markStrategyDirty: false })
      setFeedback(t('today.session.workstation.feedback.strategyImportedCurrent'))
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
  const strategySummary = summarizeStrategySnapshot(selectedSetup?.strategySnapshot)
  const setupInsight = getSetupInsight(selectedSetup, currentWorkspace.session.readiness)
  const nextAction = getNextAction(selectedSetup, currentWorkspace.session.readiness)
  const triggerStatus = getTriggerStatus(selectedSetup)
  const selectedSetupLatestAction = selectedSetup ? latestSetupAction(selectedSetup, currentWorkspace.activity) : null
  const startActionLooksReady = Boolean(selectedSetup && selectedExecution && combinedBlockers.length === 0)
  const canDeleteDraftExecution = Boolean(
    selectedExecution
    && selectedExecution.status === 'DRAFT'
    && !selectedExecution.linkedTradeId
  )

  const persistSetupImmediately = async (nextSetup: SetupItem, nextStatus?: SetupStatus | null) => {
    if (!workspace || !selectedSetupIsPersisted) return
    const signature = JSON.stringify(toSetupPayload(nextSetup))
    await updateSetupMutation.mutateAsync({
      sessionId: workspace.session.id,
      setupId: nextSetup.id,
      data: toSetupPayload(nextSetup),
      signature
    })
    if (nextStatus) {
      await statusMutation.mutateAsync({
        sessionId: workspace.session.id,
        setupId: nextSetup.id,
        status: nextStatus
      })
    }
  }

  const handleQuickLogAction = async (actionId: QuickLogActionId) => {
    if (!selectedSetup) return
    setQuickLogAnchorEl(null)

    if ((actionId === 'ADD_NOTE' || actionId === 'ADD_LESSON') && !quickNote.trim()) {
      setFeedback(t('today.session.workstation.feedback.quickNoteRequired'))
      return
    }

    if (actionId === 'ENTRY_TAKEN' && selectedExecution && selectedSetupIsPersisted && startActionLooksReady) {
      startTradeMutation.mutate({
        sessionId: currentWorkspace.session.id,
        setupId: selectedSetup.id,
        executionId: selectedExecution.id
      })
      return
    }

    const result = buildQuickLogUpdate(selectedSetup, actionId, {
      note: quickNote,
      executionId: selectedExecution?.id || null
    })
    setSetupDraft(result.setup)
    setFeedback(result.feedback)
    setQuickNote('')
    if (selectedSetupIsPersisted) {
      void persistSetupImmediately(result.setup, setupStatusForQuickAction(actionId))
    }
  }

  return (
    <Stack spacing={2.5} sx={(theme) => panelSx(theme)}>
      <Card className="ws-panel" sx={{ position: 'sticky', top: 16, zIndex: 6 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.4 }, '&:last-child': { pb: { xs: 2, md: 2.4 } } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', xl: 'row' }} justifyContent="space-between" spacing={2}>
              <Stack spacing={0.85}>
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
                  <Chip className="ws-tag" size="small" variant="outlined" label={`${t('today.session.workstation.header.selectedSymbol')}: ${selectedSetup?.symbol || '—'}`} />
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.04em' }}>
                  {sessionDraft?.sessionName || t('today.session.workspace.today')}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('today.session.workstation.header.flow')}
                  </Typography>
                  <Button size="small" startIcon={<SettingsRoundedIcon />} onClick={() => setSessionSettingsOpen(true)}>
                    {t('today.session.workstation.header.sessionSettings')}
                  </Button>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                <Button variant="outlined" startIcon={<ImportExportRoundedIcon />} onClick={openStrategyDialog}>
                  {t('today.session.workstation.header.importStrategy')}
                </Button>
                <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                  {t('today.session.workspace.actions.addSetup')}
                </Button>
                <Button variant="outlined" startIcon={<PlayArrowRoundedIcon />} onClick={() => addExecution()} disabled={!selectedSetup}>
                  {t('today.session.workstation.header.newExecution')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<BoltRoundedIcon />}
                  onClick={(event) => setQuickLogAnchorEl(event.currentTarget)}
                  disabled={!selectedSetup}
                >
                  {t('today.session.workstation.header.quickLog')}
                </Button>
                <Button
                  variant={currentWorkspace.session.lockedInAt ? 'outlined' : 'contained'}
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
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' },
                gap: 1.2
              }}
            >
              <SurfaceMetric label={t('today.session.workstation.header.selectedSymbol')} value={selectedSetup?.symbol || '—'} detail={selectedSetup ? formatDirection(selectedSetup.direction) : undefined} />
              <SurfaceMetric label={t('today.session.workspace.metrics.maxLoss')} value={formatCurrency(currentWorkspace.session.quickStats.maxLoss, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workspace.metrics.riskUsed')} value={formatCurrency(currentWorkspace.session.quickStats.riskUsed, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workstation.header.setupCount')} value={currentWorkspace.setups.length} />
              <SurfaceMetric label={t('today.session.workspace.metrics.trades')} value={currentWorkspace.session.quickStats.tradesTaken} />
              <SurfaceMetric label={t('today.session.workspace.metrics.realizedPnl')} value={formatSignedCurrency(currentWorkspace.session.quickStats.realizedPnl, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workstation.header.selectedStrategy')} value={selectedSetup?.strategySnapshot?.name || selectedSetup?.strategyLabel || '—'} />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {feedback ? (
        <Alert severity="info" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '280px minmax(0, 1fr) 430px' },
          gap: 2.5,
          alignItems: 'start'
        }}
      >
        <Card className="ws-panel" component="aside" sx={{ position: { xl: 'sticky' }, top: { xl: 104 } }}>
          <CardContent sx={{ p: 2.1 }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack spacing={0.4}>
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
                <Stack spacing={1.25}>
                  <Box className="ws-subpanel" sx={{ p: 1.4 }}>
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {mentorPlanQuery.data.title}
                      </Typography>
                      <Chip size="small" className="ws-tag" label={mentorPlanQuery.data.biasSummary || t('today.mentor.emptySummary')} />
                    </Stack>
                  </Box>
                  <Collapse in={mentorExpanded}>
                    <Stack spacing={1.1}>
                      <Box className="ws-subpanel" sx={{ p: 1.4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {t('today.session.workstation.mentor.bias')}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.55 }}>
                          {mentorPlanQuery.data.biasSummary || '—'}
                        </Typography>
                      </Box>
                      <Box className="ws-subpanel" sx={{ p: 1.4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {t('today.session.workstation.mentor.narrative')}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.55 }}>
                          {mentorPlanQuery.data.summary || mentorPlanQuery.data.liquidityNarrative || mentorPlanQuery.data.executionRules || '—'}
                        </Typography>
                      </Box>
                      <Box className="ws-subpanel" sx={{ p: 1.4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {t('today.session.workstation.mentor.levels')}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
                          {(mentorPlanQuery.data.keyLevels || []).length > 0 ? (
                            (mentorPlanQuery.data.keyLevels || []).map((item) => (
                              <Chip key={item} size="small" variant="outlined" label={item} />
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </Stack>
                      </Box>
                      <Box className="ws-subpanel" sx={{ p: 1.4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {t('today.session.workstation.mentor.invalidation')}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.55 }}>
                          {mentorPlanQuery.data.alternativeScenario || '—'}
                        </Typography>
                      </Box>
                      <Box className="ws-subpanel" sx={{ p: 1.4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {t('today.session.workstation.mentor.checklist')}
                        </Typography>
                        <Stack spacing={0.75} sx={{ mt: 0.8 }}>
                          <Typography variant="body2">{mentorPlanQuery.data.executionRules || '—'}</Typography>
                          <Typography variant="body2" color="text.secondary">{mentorPlanQuery.data.riskNote || '—'}</Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Collapse>
                </Stack>
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
          <Card className="ws-panel">
            <CardContent sx={{ p: 2.15 }}>
              <Stack spacing={1.4}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2}>
                  <Stack spacing={0.45}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                      {t('today.session.workstation.navigator.kicker')}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {t('today.session.workstation.navigator.title')}
                    </Typography>
                  </Stack>
                  <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                    {t('today.session.workspace.actions.addNewSetup')}
                  </Button>
                </Stack>
                {currentWorkspace.setups.length > 0 ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(220px, 1fr))' },
                      gap: 1.1
                    }}
                  >
                    {currentWorkspace.setups.map((setup) => {
                      const lastAction = latestSetupAction(setup, currentWorkspace.activity)
                      return (
                        <Box
                          key={setup.id}
                          className="ws-subpanel"
                          sx={(theme) => ({
                            p: 1.3,
                            borderColor: selectedSetup?.id === setup.id ? 'primary.main' : 'var(--ws-border)',
                            background: selectedSetup?.id === setup.id
                              ? alpha(theme.palette.primary.main, 0.12)
                              : undefined,
                            boxShadow: selectedSetup?.id === setup.id ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}` : 'none'
                          })}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Stack spacing={0.3}>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                  {setup.setupTitle}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {setup.symbol} • {formatDirection(setup.direction)}
                                </Typography>
                              </Stack>
                              <SetupStatusChip status={setup.status} />
                            </Stack>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Chip size="small" variant="outlined" label={`${setup.readiness.score}%`} />
                              <Chip size="small" variant="outlined" label={`${setup.executions.tickets.length} ${t('today.session.workstation.navigator.executions')}`} />
                              {setup.strategySnapshot?.name ? <Chip size="small" variant="outlined" label={setup.strategySnapshot.name} /> : null}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {lastAction
                                ? t('today.session.workstation.navigator.lastAction', {
                                  action: lastAction.title || t('today.session.workstation.timeline.event'),
                                  time: lastAction.occurredAt ? formatDateTime(lastAction.occurredAt, timezone) : '—'
                                })
                                : t('today.session.workstation.navigator.noActivity')}
                            </Typography>
                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Button size="small" variant={selectedSetup?.id === setup.id ? 'contained' : 'text'} onClick={() => handleSelectSetup(setup.id)}>
                                {t('today.session.workstation.navigator.open')}
                              </Button>
                              <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => duplicateSetupMutation.mutate({ sessionId: currentWorkspace.session.id, setupId: setup.id })}>
                                {t('today.session.workstation.navigator.duplicate')}
                              </Button>
                              <Button
                                size="small"
                                startIcon={<AddRoundedIcon />}
                                onClick={() => {
                                  handleSelectSetup(setup.id)
                                  addExecution()
                                }}
                              >
                                {t('today.session.workstation.navigator.newExecution')}
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      )
                    })}
                  </Box>
                ) : (
                  <EmptyState
                    title={t('today.session.workstation.navigator.emptyTitle')}
                    description={t('today.session.workstation.navigator.emptyBody')}
                    icon={<FlagRoundedIcon fontSize="inherit" />}
                    action={(
                      <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                        {t('today.session.workspace.actions.addSetup')}
                      </Button>
                    )}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card className="ws-panel" component="section">
            <CardContent sx={{ p: 2.2 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Stack spacing={0.55}>
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
                      value={compareModeState}
                      onChange={(_, value: CompareMode | null) => value && setCompareModeState(value)}
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

                <Box className="ws-subpanel" sx={{ p: 1.4 }}>
                  <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.25}>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip size="small" className="ws-tag" label={selectedSetup?.symbol || '—'} />
                      {selectedSetup?.tradeSession ? <Chip size="small" variant="outlined" label={selectedSetup.tradeSession} /> : null}
                      {selectedSetup ? <Chip size="small" variant="outlined" label={formatDirection(selectedSetup.direction)} /> : null}
                      <TriggerStateChip status={triggerStatus} />
                      {selectedSetupLatestAction?.title ? <Chip size="small" variant="outlined" label={selectedSetupLatestAction.title} /> : null}
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      {mentorPlanQuery.data && mentorRelevant && selectedSetup ? (
                        <Button size="small" startIcon={<SchoolRoundedIcon />} onClick={handleAddMentorContext}>
                          {t('today.session.workstation.mentor.apply')}
                        </Button>
                      ) : null}
                      <Typography variant="caption" color="text.secondary">
                        {autoSaveState}
                      </Typography>
                    </Stack>
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
                    gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 300px' },
                    gap: 1.4
                  }}
                >
                  <Stack spacing={1.1}>
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

                  <Box className="ws-subpanel" sx={{ p: 1.2 }}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t('today.session.workstation.chart.executionFocus')}
                      </Typography>
                      {selectedExecution ? (
                        <>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Chip size="small" color={chipColorForExecutionStatus(selectedExecution.status)} label={selectedExecution.status} />
                            <Chip size="small" variant="outlined" label={`RR ${activeRr != null ? formatNumber(activeRr, 2) : '—'}`} />
                            <Chip size="small" variant="outlined" label={formatCurrency(selectedExecution.riskAmount, baseCurrency)} />
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {selectedExecution.label}
                          </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {selectedExecution.entryPrice != null
                                  ? `${formatNumber(selectedExecution.entryPrice, 5)} / ${formatNumber(selectedExecution.stopLossPrice, 5)} / ${formatNumber(selectedExecution.takeProfitPrice, 5)}`
                                  : t('today.session.workstation.execute.notConfigured')}
                              </Typography>
                          {focusedLevel ? (
                            <Stack spacing={0.75}>
                              <Typography variant="caption" color="text.secondary">
                                {focusedLevel.label} • {focusedLevel.price != null ? formatNumber(focusedLevel.price, 5) : '—'}
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
                            </Stack>
                          ) : null}
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

        <Card className="ws-panel" component="section" sx={{ position: { xl: 'sticky' }, top: { xl: 104 }, maxHeight: { xl: 'calc(100vh - 128px)' }, overflow: 'auto' }}>
          <CardContent sx={{ p: 2.15 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                <Stack spacing={0.45}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {t('today.session.workstation.capture.kicker')}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {t('today.session.workstation.capture.title')}
                  </Typography>
                </Stack>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={density}
                  onChange={(_, value: WorkstationDensity | null) => value && setDensity(value)}
                >
                  <ToggleButton value="COMPACT">{t('today.session.workstation.capture.compact')}</ToggleButton>
                  <ToggleButton value="ADVANCED">{t('today.session.workstation.capture.advanced')}</ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              {!selectedSetup ? (
                <EmptyState
                  title={t('today.session.workstation.capture.emptyTitle')}
                  description={t('today.session.workstation.capture.emptyBody')}
                  icon={<FlagRoundedIcon fontSize="inherit" />}
                />
              ) : (
                <>
                  <Box className="ws-subpanel" sx={{ p: 1.45 }}>
                    <Stack spacing={1.2}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Stack spacing={0.3}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                            {t('today.session.workstation.readiness.title')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('today.session.workstation.readiness.subtitle')}
                          </Typography>
                        </Stack>
                        <ReadinessChip state={selectedSetup.readiness.state} label={`${selectedSetup.readiness.score}%`} />
                      </Stack>
                      <LinearProgress variant="determinate" value={selectedSetup.readiness.score} />
                      {setupInsight ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
                          {[
                            { key: 'plan', title: t('today.session.workstation.readiness.plan'), value: setupInsight.plan },
                            { key: 'trigger', title: t('today.session.workstation.readiness.trigger'), value: setupInsight.trigger },
                            { key: 'execution', title: t('today.session.workstation.readiness.execution'), value: setupInsight.execution },
                            { key: 'session', title: t('today.session.workstation.readiness.session'), value: setupInsight.session }
                          ].map((item) => (
                            <Box key={item.key} className="ws-subpanel" sx={{ p: 1.1 }}>
                              <Stack spacing={0.55}>
                                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {item.title}
                                  </Typography>
                                  <ReadinessChip
                                    state={item.key === 'trigger'
                                      ? getTriggerStateFromStatus(item.value.state as 'NOT_READY' | 'WATCHING' | 'CONFIRMED' | 'INVALIDATED')
                                      : item.value.state}
                                    label={item.value.state.replaceAll('_', ' ')}
                                  />
                                </Stack>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {item.value.summary}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.value.missingItems.length > 0 ? item.value.missingItems.join(', ') : item.value.nextAction}
                                </Typography>
                              </Stack>
                            </Box>
                          ))}
                        </Box>
                      ) : null}
                      <Alert severity={nextAction.tone as AlertColor}>
                        <AlertTitle>{t('today.session.workstation.readiness.nextAction')}</AlertTitle>
                        <strong>{nextAction.title}</strong> {nextAction.detail}
                      </Alert>
                    </Stack>
                  </Box>

                  <Tabs value={drawerMode} onChange={(_, value: CaptureDrawerMode) => setDrawerMode(value)} variant="fullWidth">
                    <Tab value="PLAN" label={t('today.session.workstation.tabs.plan')} />
                    <Tab value="TRIGGER" label={t('today.session.workstation.tabs.trigger')} />
                    <Tab value="EXECUTE" label={t('today.session.workstation.tabs.execute')} />
                    <Tab value="JOURNAL" label={t('today.session.workstation.tabs.journal')} />
                  </Tabs>

                  {drawerMode === 'PLAN' ? (
                    <Stack spacing={1.5}>
                      <Box className="ws-subpanel" sx={{ p: 1.45 }}>
                        <Stack spacing={1.2}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Stack spacing={0.35}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {t('today.session.workstation.plan.title')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t('today.session.workstation.plan.subtitle')}
                              </Typography>
                            </Stack>
                            <Button size="small" startIcon={<ImportExportRoundedIcon />} onClick={openStrategyDialog}>
                              {t('today.session.workstation.header.importStrategy')}
                            </Button>
                          </Stack>

                          {strategySummary ? (
                            <Box className="ws-subpanel" sx={{ p: 1.15 }}>
                              <Stack spacing={1}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                                  <Stack spacing={0.3}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                      {t('today.session.workstation.plan.strategySummary')}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                      {strategySummary.importedFrom}
                                    </Typography>
                                  </Stack>
                                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={selectedSetup.strategySnapshot?.localEditsApplied
                                        ? t('today.session.workstation.plan.localEdits')
                                        : t('today.session.workstation.plan.snapshotClean')}
                                    />
                                    <Button size="small" onClick={() => setStrategyDetailOpen(true)}>
                                      {t('today.session.workstation.plan.viewDetails')}
                                    </Button>
                                  </Stack>
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                  {strategySummary.entrySummary}
                                </Typography>
                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                  <Chip size="small" variant="outlined" label={selectedSetup.strategySnapshot?.source || '—'} />
                                  {selectedSetup.strategySnapshot?.sessionSuitability?.map((item) => (
                                    <Chip key={item} size="small" variant="outlined" label={item} />
                                  ))}
                                </Stack>
                              </Stack>
                            </Box>
                          ) : (
                            <EmptyState
                              title={t('today.session.workstation.plan.noStrategyTitle')}
                              description={t('today.session.workstation.plan.noStrategyBody')}
                              icon={<ImportExportRoundedIcon fontSize="inherit" />}
                            />
                          )}

                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
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
                                <MenuItem value="UNDECIDED">{t('trades.direction.UNDECIDED')}</MenuItem>
                                <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                                <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
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
                            {density === 'ADVANCED' ? (
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
                            ) : null}
                          </Box>

                          <TextField
                            label={t('today.session.workstation.fields.narrative')}
                            value={selectedSetup.context.narrative || ''}
                            onChange={(event) => updateSelectedSetup((current) => ({
                              ...current,
                              context: { ...current.context, narrative: event.target.value }
                            }))}
                            multiline
                            minRows={2}
                          />
                          <TextField
                            label={t('today.session.workstation.fields.liquidity')}
                            value={selectedSetup.context.liquidityNotes || ''}
                            onChange={(event) => updateSelectedSetup((current) => ({
                              ...current,
                              context: { ...current.context, liquidityNotes: event.target.value }
                            }))}
                            multiline
                            minRows={2}
                          />
                          <TextField
                            label={t('today.session.workstation.fields.invalidationIdea')}
                            value={selectedSetup.context.invalidationIdea || ''}
                            onChange={(event) => updateSelectedSetup((current) => ({
                              ...current,
                              context: { ...current.context, invalidationIdea: event.target.value }
                            }))}
                            multiline
                            minRows={2}
                          />
                          <TextField
                            label={t('today.session.workstation.fields.contextNotes')}
                            value={selectedSetup.context.notes || ''}
                            onChange={(event) => updateSelectedSetup((current) => ({
                              ...current,
                              context: { ...current.context, notes: event.target.value }
                            }))}
                            multiline
                            minRows={2}
                          />

                          {density === 'ADVANCED' ? (
                            <Box className="ws-subpanel" sx={{ p: 1.15 }}>
                              <Stack spacing={1.1}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                  {t('today.session.workstation.plan.advancedTitle')}
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
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
                              </Stack>
                            </Box>
                          ) : null}
                        </Stack>
                      </Box>
                    </Stack>
                  ) : null}

                  {drawerMode === 'TRIGGER' ? (
                    <Stack spacing={1.5}>
                      <Box className="ws-subpanel" sx={{ p: 1.45 }}>
                        <Stack spacing={1.15}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Stack spacing={0.35}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {t('today.session.workstation.trigger.title')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t('today.session.workstation.trigger.subtitle')}
                              </Typography>
                            </Stack>
                            <TriggerStateChip status={triggerStatus} />
                          </Stack>

                          <Box className="ws-subpanel" sx={{ p: 1.05 }}>
                            <Stack spacing={0.9}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t('today.session.workstation.trigger.statusSummary')}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {t(`today.session.workstation.trigger.statusValues.${triggerStatus}`)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {setupInsight?.trigger.nextAction}
                              </Typography>
                            </Stack>
                          </Box>

                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Chip
                              clickable
                              color={selectedSetup.trigger.sweepIdentified ? 'primary' : 'default'}
                              variant={selectedSetup.trigger.sweepIdentified ? 'filled' : 'outlined'}
                              label={t('today.session.workstation.trigger.sweepIdentified')}
                              onClick={() => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, sweepIdentified: !current.trigger.sweepIdentified }
                              }), { markStrategyDirty: false })}
                            />
                            <Chip
                              clickable
                              color={selectedSetup.trigger.displacementConfirmed ? 'primary' : 'default'}
                              variant={selectedSetup.trigger.displacementConfirmed ? 'filled' : 'outlined'}
                              label={t('today.session.workstation.trigger.displacementConfirmed')}
                              onClick={() => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, displacementConfirmed: !current.trigger.displacementConfirmed }
                              }), { markStrategyDirty: false })}
                            />
                            <Chip
                              clickable
                              color={selectedSetup.trigger.structureConfirmed ? 'primary' : 'default'}
                              variant={selectedSetup.trigger.structureConfirmed ? 'filled' : 'outlined'}
                              label={t('today.session.workstation.trigger.structureConfirmed')}
                              onClick={() => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, structureConfirmed: !current.trigger.structureConfirmed }
                              }), { markStrategyDirty: false })}
                            />
                          </Stack>

                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
                            <TextField
                              label={t('today.session.workstation.fields.entryModel')}
                              value={selectedSetup.trigger.entryModel || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: {
                                  ...current.trigger,
                                  entryModel: event.target.value,
                                  entryZone: current.trigger.entryZone || event.target.value
                                }
                              }), { markStrategyDirty: false })}
                            />
                            <TextField
                              label={t('today.session.workstation.fields.liquiditySource')}
                              value={selectedSetup.trigger.liquiditySource || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, liquiditySource: event.target.value }
                              }), { markStrategyDirty: false })}
                            />
                            <TextField
                              label={t('today.session.workstation.fields.confirmationTimeframe')}
                              value={selectedSetup.trigger.confirmationTimeframe || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, confirmationTimeframe: event.target.value }
                              }), { markStrategyDirty: false })}
                            />
                            <TextField
                              label={t('today.session.workstation.fields.rrMinimum')}
                              value={selectedSetup.trigger.rrMinimum ?? ''}
                              type="number"
                              inputProps={{ step: '0.1' }}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: {
                                  ...current.trigger,
                                  rrMinimum: parseNumberInput(event.target.value),
                                  rrEstimate: current.trigger.rrEstimate ?? parseNumberInput(event.target.value)
                                }
                              }), { markStrategyDirty: false })}
                            />
                            <TextField
                              label={t('today.session.workstation.fields.invalidationThreshold')}
                              value={selectedSetup.trigger.invalidationThreshold || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, invalidationThreshold: event.target.value }
                              }), { markStrategyDirty: false })}
                            />
                            <TextField
                              label={t('today.session.workstation.fields.confirmationModel')}
                              value={selectedSetup.trigger.confirmationModel || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, confirmationModel: event.target.value }
                              }), { markStrategyDirty: false })}
                            />
                          </Box>

                          <TextField
                            label={t('today.session.workstation.fields.triggerNotes')}
                            value={selectedSetup.trigger.notes || ''}
                            onChange={(event) => updateSelectedSetup((current) => ({
                              ...current,
                              trigger: { ...current.trigger, notes: event.target.value }
                            }), { markStrategyDirty: false })}
                            multiline
                            minRows={2}
                          />

                          {density === 'ADVANCED' ? (
                            <Box className="ws-subpanel" sx={{ p: 1.15 }}>
                              <Stack spacing={1.1}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <TuneRoundedIcon color="primary" />
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    {t('today.session.workstation.trigger.advancedTitle')}
                                  </Typography>
                                </Stack>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
                                  <TextField label={t('today.session.workstation.fields.entryZone')} value={selectedSetup.trigger.entryZone || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, entryZone: event.target.value } }), { markStrategyDirty: false })} />
                                  <TextField label={t('today.session.workstation.fields.sweepType')} value={selectedSetup.trigger.sweepType || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, sweepType: event.target.value } }), { markStrategyDirty: false })} />
                                  <TextField label={t('today.session.workstation.fields.displacementRule')} value={selectedSetup.trigger.displacementRule || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, displacementRule: event.target.value } }), { markStrategyDirty: false })} multiline minRows={2} />
                                  <TextField label={t('today.session.workstation.fields.structureRule')} value={selectedSetup.trigger.structureRule || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, structureRule: event.target.value } }), { markStrategyDirty: false })} multiline minRows={2} />
                                  <TextField label={t('today.session.workstation.fields.fvgRequirement')} value={selectedSetup.trigger.fvgRequirement || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, fvgRequirement: event.target.value } }), { markStrategyDirty: false })} />
                                  <TextField label={t('today.session.workstation.fields.confluenceRequirement')} value={selectedSetup.trigger.confluenceRequirement || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, confluenceRequirement: event.target.value } }), { markStrategyDirty: false })} />
                                  <TextField label={t('today.session.workstation.fields.newsRestriction')} value={selectedSetup.trigger.newsRestriction || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, newsRestriction: event.target.value } }), { markStrategyDirty: false })} />
                                  <TextField label={t('today.session.workstation.fields.sessionRestriction')} value={selectedSetup.trigger.sessionRestriction || ''} onChange={(event) => updateSelectedSetup((current) => ({ ...current, trigger: { ...current.trigger, sessionRestriction: event.target.value } }), { markStrategyDirty: false })} />
                                </Box>
                              </Stack>
                            </Box>
                          ) : null}
                        </Stack>
                      </Box>
                    </Stack>
                  ) : null}

                  {drawerMode === 'EXECUTE' ? (
                    <Stack spacing={1.5}>
                      <Box className="ws-subpanel" sx={{ p: 1.45 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                          <Stack spacing={0.35}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                              {t('today.session.workstation.execute.title')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t('today.session.workstation.execute.subtitle')}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => addExecution()}>
                              {t('today.session.workstation.execute.newExecution')}
                            </Button>
                            <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => addExecution(selectedExecution)}>
                              {t('today.session.workstation.execute.cloneExecution')}
                            </Button>
                            <Button size="small" color="warning" onClick={removeDraftExecution} disabled={!canDeleteDraftExecution}>
                              {t('today.session.workstation.execute.deleteDraft')}
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
                                p: 1.2,
                                borderColor: selectedExecution?.id === ticket.id ? 'primary.main' : 'var(--ws-border)',
                                boxShadow: selectedExecution?.id === ticket.id ? (theme) => `0 0 0 1px ${alpha(theme.palette.primary.main, 0.28)}` : 'none'
                              }}
                            >
                              <Stack spacing={1}>
                                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                  <Stack spacing={0.25}>
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                      {ticket.label}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {ticket.createdAt ? formatDateTime(ticket.createdAt, timezone) : '—'}
                                    </Typography>
                                  </Stack>
                                  <Chip size="small" color={chipColorForExecutionStatus(ticket.status)} label={ticket.status} />
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                  {ticket.entryPrice != null
                                    ? `${formatNumber(ticket.entryPrice, 5)} / ${formatNumber(ticket.stopLossPrice, 5)} / ${formatNumber(ticket.takeProfitPrice, 5)}`
                                    : t('today.session.workstation.execute.notConfigured')}
                                </Typography>
                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                  <Chip size="small" variant="outlined" label={`RR ${ticketRr != null ? formatNumber(ticketRr, 2) : '—'}`} />
                                  <Chip size="small" variant="outlined" label={formatCurrency(ticket.riskAmount, baseCurrency)} />
                                  {ticket.quantity != null ? <Chip size="small" variant="outlined" label={`${t('today.session.workstation.fields.quantity')}: ${ticket.quantity}`} /> : null}
                                </Stack>
                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                  <Button size="small" variant={selectedExecution?.id === ticket.id ? 'contained' : 'text'} onClick={() => selectExecution(ticket.id)}>
                                    {t('today.session.workstation.execute.open')}
                                  </Button>
                                  <Button size="small" onClick={() => addExecution(ticket)}>
                                    {t('today.session.workstation.execute.clone')}
                                  </Button>
                                  <Button size="small" onClick={() => {
                                    selectExecution(ticket.id)
                                    void handleQuickLogAction('ENTRY_TAKEN')
                                  }}>
                                    {t('today.session.workstation.execute.markActive')}
                                  </Button>
                                  <Button size="small" onClick={() => {
                                    selectExecution(ticket.id)
                                    void handleQuickLogAction('PARTIAL_TAKEN')
                                  }}>
                                    {t('today.session.workstation.execute.partial')}
                                  </Button>
                                  <Button size="small" onClick={() => {
                                    selectExecution(ticket.id)
                                    void handleQuickLogAction('SKIPPED')
                                  }}>
                                    {t('today.session.workstation.execute.skip')}
                                  </Button>
                                </Stack>
                              </Stack>
                            </Box>
                          )
                        })}
                      </Stack>

                      {selectedExecution ? (
                        <Box className="ws-subpanel" sx={{ p: 1.45 }}>
                          <Stack spacing={1.2}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                              <Stack spacing={0.35}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                  {selectedExecution.label}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {t('today.session.workstation.execute.editorSubtitle')}
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

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
                              <TextField label={t('today.session.workstation.fields.executionLabel')} value={selectedExecution.label} onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, label: event.target.value }))} />
                              <TextField label={t('today.session.workstation.fields.riskAmount')} value={selectedExecution.riskAmount ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, riskAmount: parseNumberInput(event.target.value) }))} />
                              <TextField label={t('today.session.workstation.fields.entry')} value={selectedExecution.entryPrice ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, entryPrice: parseNumberInput(event.target.value) }))} />
                              <TextField label={t('today.session.workstation.fields.stopLoss')} value={selectedExecution.stopLossPrice ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, stopLossPrice: parseNumberInput(event.target.value) }))} />
                              <TextField label={t('today.session.workstation.fields.takeProfit')} value={selectedExecution.takeProfitPrice ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, takeProfitPrice: parseNumberInput(event.target.value) }))} />
                              <TextField label={t('today.session.workstation.fields.quantity')} value={selectedExecution.quantity ?? ''} type="number" onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, quantity: parseNumberInput(event.target.value) }))} />
                            </Box>

                            <Box className="ws-subpanel" sx={{ p: 1.1 }}>
                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                <Chip size="small" label={`RR ${activeRr != null ? formatNumber(activeRr, 2) : '—'}`} />
                                <Chip size="small" variant="outlined" label={formatCurrency(selectedExecution.riskAmount, baseCurrency)} />
                                {focusedLevel?.price != null ? <Chip size="small" variant="outlined" label={`${focusedLevel.label}: ${formatNumber(focusedLevel.price, 5)}`} /> : null}
                              </Stack>
                            </Box>

                            <TextField
                              label={t('today.session.workstation.fields.executionInvalidation')}
                              value={selectedExecution.invalidation || ''}
                              onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, invalidation: event.target.value }))}
                              multiline
                              minRows={2}
                            />
                            <TextField
                              label={t('today.session.workstation.fields.executionNotes')}
                              value={selectedExecution.notes || ''}
                              onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, notes: event.target.value }))}
                              multiline
                              minRows={2}
                            />

                            {density === 'ADVANCED' ? (
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.1 }}>
                                <TextField
                                  label={t('today.session.workstation.fields.initialNotes')}
                                  value={selectedExecution.initialNotes || ''}
                                  onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, initialNotes: event.target.value }))}
                                  multiline
                                  minRows={2}
                                />
                                <TextField
                                  label={t('today.session.workstation.fields.whyWrong')}
                                  value={selectedExecution.whyWrong || ''}
                                  onChange={(event) => updateActiveExecution((ticket) => ({ ...ticket, whyWrong: event.target.value }))}
                                  multiline
                                  minRows={2}
                                />
                              </Box>
                            ) : null}

                            {combinedBlockers.length > 0 ? (
                              <Alert severity="warning">
                                <AlertTitle>{t('today.session.workstation.execute.startBlocked')}</AlertTitle>
                                {combinedBlockers.join(', ')}
                              </Alert>
                            ) : null}

                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Button
                                variant={startActionLooksReady ? 'contained' : 'outlined'}
                                startIcon={<PlayArrowRoundedIcon />}
                                onClick={() => void handleQuickLogAction('ENTRY_TAKEN')}
                              >
                                {t('today.session.workstation.execute.markActive')}
                              </Button>
                              <Button variant="outlined" onClick={() => void handleQuickLogAction('PARTIAL_TAKEN')}>
                                {t('today.session.workstation.execute.partial')}
                              </Button>
                              <Button variant="outlined" onClick={() => void handleQuickLogAction('CLOSE_WIN')}>
                                {t('today.session.workstation.execute.closeWin')}
                              </Button>
                              <Button variant="outlined" onClick={() => void handleQuickLogAction('CLOSE_LOSS')}>
                                {t('today.session.workstation.execute.closeLoss')}
                              </Button>
                              <Button variant="outlined" onClick={() => void handleQuickLogAction('SKIPPED')}>
                                {t('today.session.workstation.execute.skip')}
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      ) : null}
                    </Stack>
                  ) : null}

                  {drawerMode === 'JOURNAL' ? (
                    <Stack spacing={1.5}>
                      <Box className="ws-subpanel" sx={{ p: 1.45 }}>
                        <Stack spacing={1.2}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Stack spacing={0.35}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {t('today.session.workstation.journal.title')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {t('today.session.workstation.journal.subtitle')}
                              </Typography>
                            </Stack>
                            <Chip size="small" variant="outlined" label={`${timeline.length} ${t('today.session.workstation.journal.events')}`} />
                          </Stack>

                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 0.8 }}>
                            {quickLogActions.filter((action) => action.id !== 'ADD_NOTE' && action.id !== 'ADD_LESSON').map((action) => (
                              <Button
                                key={action.id}
                                variant={action.id === 'ENTRY_TAKEN' || action.id === 'PARTIAL_TAKEN' ? 'contained' : 'outlined'}
                                onClick={() => void handleQuickLogAction(action.id)}
                              >
                                {t(`today.session.workstation.quickActions.${action.id}`)}
                              </Button>
                            ))}
                          </Box>

                          <TextField
                            label={t('today.session.workstation.journal.quickNote')}
                            placeholder={t('today.session.workstation.journal.quickNotePlaceholder')}
                            value={quickNote}
                            onChange={(event) => setQuickNote(event.target.value)}
                            multiline
                            minRows={2}
                          />

                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Button variant="outlined" startIcon={<NotesRoundedIcon />} onClick={() => void handleQuickLogAction('ADD_NOTE')}>
                              {t('today.session.workstation.quickActions.ADD_NOTE')}
                            </Button>
                            <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => void handleQuickLogAction('ADD_LESSON')}>
                              {t('today.session.workstation.quickActions.ADD_LESSON')}
                            </Button>
                          </Stack>

                          <Box className="ws-subpanel" sx={{ p: 1.1 }}>
                            <Stack spacing={0.9}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t('today.session.workstation.journal.mistakeTags')}
                              </Typography>
                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                {journalMistakePresetKeys.map((key) => {
                                  const tag = t(`today.session.workstation.journal.mistakePresets.${key}`)
                                  return (
                                  <Chip
                                    key={key}
                                    clickable
                                    color={selectedSetup.review?.tags?.includes(tag) ? 'primary' : 'default'}
                                    variant={selectedSetup.review?.tags?.includes(tag) ? 'filled' : 'outlined'}
                                    label={tag}
                                    onClick={() => updateSelectedSetup((current) => ({
                                      ...current,
                                      review: {
                                        ...(current.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }),
                                        tags: current.review?.tags?.includes(tag)
                                          ? (current.review?.tags || []).filter((item) => item !== tag)
                                          : [...(current.review?.tags || []), tag]
                                      }
                                    }), { markStrategyDirty: false })}
                                  />
                                  )
                                })}
                              </Stack>
                            </Stack>
                          </Box>

                          <Box className="ws-subpanel" sx={{ p: 1.1 }}>
                            <Stack spacing={0.9}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t('today.session.workstation.journal.lessonTags')}
                              </Typography>
                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                {journalLessonPresetKeys.map((key) => {
                                  const tag = t(`today.session.workstation.journal.lessonPresets.${key}`)
                                  return (
                                  <Chip
                                    key={key}
                                    clickable
                                    color={selectedSetup.review?.tags?.includes(tag) ? 'primary' : 'default'}
                                    variant={selectedSetup.review?.tags?.includes(tag) ? 'filled' : 'outlined'}
                                    label={tag}
                                    onClick={() => updateSelectedSetup((current) => ({
                                      ...current,
                                      review: {
                                        ...(current.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }),
                                        tags: current.review?.tags?.includes(tag)
                                          ? (current.review?.tags || []).filter((item) => item !== tag)
                                          : [...(current.review?.tags || []), tag]
                                      }
                                    }), { markStrategyDirty: false })}
                                  />
                                  )
                                })}
                              </Stack>
                            </Stack>
                          </Box>

                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={selectedSetup.review?.outcomeSummary || ''}
                            onChange={(_, value: string | null) => value != null && updateSelectedSetup((current) => ({
                              ...current,
                              review: {
                                ...(current.review || { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] }),
                                outcomeSummary: value
                              }
                            }), { markStrategyDirty: false })}
                          >
                            <ToggleButton value={t('today.session.workstation.journal.resultWatching')}>{t('today.session.workstation.journal.resultWatching')}</ToggleButton>
                            <ToggleButton value={t('today.session.workstation.journal.resultBE')}>{t('today.session.workstation.journal.resultBE')}</ToggleButton>
                            <ToggleButton value={t('today.session.workstation.journal.resultWin')}>{t('today.session.workstation.journal.resultWin')}</ToggleButton>
                            <ToggleButton value={t('today.session.workstation.journal.resultLoss')}>{t('today.session.workstation.journal.resultLoss')}</ToggleButton>
                            <ToggleButton value={t('today.session.workstation.journal.resultSkipped')}>{t('today.session.workstation.journal.resultSkipped')}</ToggleButton>
                          </ToggleButtonGroup>

                          {density === 'ADVANCED' ? (
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.1 }}>
                              <TextField
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
                                label={t('today.session.workstation.fields.lessons')}
                                value={selectedSetup.review?.lessons || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  review: { ...(current.review || { tags: [], timeline: [] }), lessons: event.target.value }
                                }), { markStrategyDirty: false })}
                                multiline
                                minRows={3}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.outcomeSummary')}
                                value={selectedSetup.review?.outcomeSummary || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  review: { ...(current.review || { tags: [], timeline: [] }), outcomeSummary: event.target.value }
                                }), { markStrategyDirty: false })}
                                multiline
                                minRows={2}
                                sx={{ gridColumn: { md: '1 / -1' } }}
                              />
                              <TextField
                                label={t('today.session.workstation.fields.reviewTags')}
                                value={toTagValue(selectedSetup.review?.tags)}
                                onChange={(event) => updateSelectedSetup((current) => ({
                                  ...current,
                                  review: { ...(current.review || { tags: [], timeline: [] }), tags: parseTags(event.target.value) }
                                }), { markStrategyDirty: false })}
                                sx={{ gridColumn: { md: '1 / -1' } }}
                              />
                            </Box>
                          ) : null}

                          <Box className="ws-subpanel" sx={{ p: 1.1 }}>
                            <Stack spacing={0.8}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {t('today.session.workstation.journal.recentActivity')}
                              </Typography>
                              {timeline.length > 0 ? timeline.slice(0, 4).map((entry) => (
                                <TimelineEntryCard key={entry.id} entry={entry} timezone={timezone} onFocusExecution={selectExecution} />
                              )) : (
                                <EmptyState
                                  title={t('today.session.workstation.review.timelineEmpty')}
                                  description={t('today.session.workstation.review.timelineEmptyBody')}
                                  icon={<TimelineRoundedIcon fontSize="inherit" />}
                                />
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </Box>
                    </Stack>
                  ) : null}
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card className="ws-panel" component="section">
        <CardContent sx={{ p: 2.15 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Stack spacing={0.35}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {t('today.session.workstation.timeline.kicker')}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {t('today.session.workstation.timeline.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('today.session.workstation.timeline.subtitle')}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {selectedSetup ? <Chip size="small" color={chipColorForSetupStatus(selectedSetup.status)} label={selectedSetup.setupTitle} /> : null}
                {selectedExecution ? <Chip size="small" color={chipColorForExecutionStatus(selectedExecution.status)} label={selectedExecution.label} /> : null}
              </Stack>
            </Stack>

            {selectedSetup ? (
              timeline.length > 0 ? (
                <Stack spacing={1}>
                  {timeline.map((entry) => (
                    <TimelineEntryCard key={entry.id} entry={entry} timezone={timezone} onFocusExecution={selectExecution} />
                  ))}
                </Stack>
              ) : (
                <EmptyState
                  title={t('today.session.workstation.review.timelineEmpty')}
                  description={t('today.session.workstation.review.timelineEmptyBody')}
                  icon={<TimelineRoundedIcon fontSize="inherit" />}
                />
              )
            ) : (
              <EmptyState
                title={t('today.session.workstation.timeline.emptyTitle')}
                description={t('today.session.workstation.timeline.emptyBody')}
                icon={<TimelineRoundedIcon fontSize="inherit" />}
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      <Menu
        anchorEl={quickLogAnchorEl}
        open={Boolean(quickLogAnchorEl)}
        onClose={() => setQuickLogAnchorEl(null)}
      >
        {quickLogActions.map((action) => (
          <MenuItem
            key={action.id}
            onClick={() => void handleQuickLogAction(action.id)}
            disabled={(action.id === 'ADD_NOTE' || action.id === 'ADD_LESSON') && !quickNote.trim()}
          >
            {t(`today.session.workstation.quickActions.${action.id}`)}
          </MenuItem>
        ))}
      </Menu>

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
                <MenuItem value="UNDECIDED">{t('trades.direction.UNDECIDED')}</MenuItem>
                <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
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

      <Dialog open={sessionSettingsOpen} onClose={() => setSessionSettingsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t('today.session.workstation.dialogs.sessionSettings')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.1 }}>
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
              label={t('today.session.workstation.fields.sessionNarrative')}
              value={sessionDraft?.narrative || ''}
              onChange={(event) => setSessionDraft((current) => current ? { ...current, narrative: event.target.value } : current)}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionSettingsOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={strategyDetailOpen} onClose={() => setStrategyDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t('today.session.workstation.plan.strategyDetailsTitle')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedSetup?.strategySnapshot ? (
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {selectedSetup.strategySnapshot.name || '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedSetup.strategySnapshot.model || '—'}
              </Typography>
              {selectedSetup.strategySnapshot.entryConditionsRich ? (
                <RichTextContent html={selectedSetup.strategySnapshot.entryConditionsRich} />
              ) : (
                <Typography variant="body2">{selectedSetup.strategySnapshot.entryConditions?.join(' • ') || '—'}</Typography>
              )}
              <Divider />
              <Typography variant="body2"><strong>{t('today.session.workstation.plan.invalidation')}</strong> {selectedSetup.strategySnapshot.invalidationLogic || '—'}</Typography>
              <Typography variant="body2"><strong>{t('today.session.workstation.plan.targets')}</strong> {selectedSetup.strategySnapshot.tpFramework || '—'}</Typography>
              <Typography variant="body2"><strong>{t('today.session.workstation.plan.noTrade')}</strong> {selectedSetup.strategySnapshot.noTradeRules || '—'}</Typography>
            </Stack>
          ) : (
            <EmptyState
              title={t('today.session.workstation.plan.noStrategyTitle')}
              description={t('today.session.workstation.plan.noStrategyBody')}
              icon={<ImportExportRoundedIcon fontSize="inherit" />}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStrategyDetailOpen(false)}>{t('common.close')}</Button>
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
                <Stack spacing={1.1}>
                  <TextField label={t('today.session.workstation.fields.symbol')} value={importDraft.symbol} onChange={(event) => setImportDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} />
                  <FormControl fullWidth>
                    <InputLabel id="import-direction-label">{t('today.session.workstation.fields.direction')}</InputLabel>
                    <Select
                      labelId="import-direction-label"
                      label={t('today.session.workstation.fields.direction')}
                      value={importDraft.direction}
                      onChange={(event) => setImportDraft((current) => ({ ...current, direction: event.target.value as StrategyImportDraft['direction'] }))}
                    >
                      <MenuItem value="UNDECIDED">{t('trades.direction.UNDECIDED')}</MenuItem>
                      <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                      <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
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
                      <Stack spacing={0.65}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{strategy.name}</Typography>
                          <Chip size="small" label={strategy.source} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{strategy.model}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(strategy.entryConditions || []).slice(0, 3).join(' • ')}
                        </Typography>
                      </Stack>
                    </Box>
                  ))
                ) : (
                  <EmptyState
                    title={t('today.session.workstation.dialogs.noStrategies')}
                    description={t('today.session.workstation.dialogs.noStrategiesBody')}
                    icon={<ImportExportRoundedIcon fontSize="inherit" />}
                  />
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
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {(selectedStrategy.sessionSuitability || []).map((item) => (
                      <Chip key={item} size="small" label={item} />
                    ))}
                    {(selectedStrategy.tags || []).map((item) => (
                      <Chip key={item} size="small" variant="outlined" label={item} />
                    ))}
                  </Stack>
                  <Typography variant="body2">{(selectedStrategy.entryConditions || []).join(' • ') || '—'}</Typography>
                  {selectedStrategy.entryConditionsRich ? <RichTextContent html={selectedStrategy.entryConditionsRich} /> : null}
                  <Divider />
                  <Typography variant="body2"><strong>{t('today.session.workstation.plan.invalidation')}</strong> {selectedStrategy.invalidationLogic || '—'}</Typography>
                  <Typography variant="body2"><strong>{t('today.session.workstation.plan.targets')}</strong> {selectedStrategy.tpFramework || '—'}</Typography>
                  <Typography variant="body2"><strong>{t('today.session.workstation.plan.noTrade')}</strong> {selectedStrategy.noTradeRules || '—'}</Typography>
                </Stack>
              ) : (
                <EmptyState
                  title={t('today.session.workstation.dialogs.previewEmpty')}
                  description={t('today.session.workstation.dialogs.previewEmptyBody')}
                  icon={<AutoAwesomeRoundedIcon fontSize="inherit" />}
                />
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

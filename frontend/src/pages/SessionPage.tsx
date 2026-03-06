import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import {
  Alert,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import type { ChipProps } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded'
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded'
import DoDisturbRoundedIcon from '@mui/icons-material/DoDisturbRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import SouthWestRoundedIcon from '@mui/icons-material/SouthWestRounded'
import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import type { DailyPlan } from '../api/plans'
import { fetchTodayMentorPlan } from '../api/plans'
import {
  createSetupCandidate,
  duplicateSetupCandidate,
  getSessionWorkspace,
  type LiveWorkspaceResponse,
  selectActiveSetupCandidate,
  startTradeFromSetupCandidate,
  type MentorReference,
  type SessionWorkspaceRequest,
  type SetupDraftRequest,
  type SetupItem,
  type SetupLevel,
  type SetupStatus,
  updateSessionWorkspace,
  updateSetupCandidate,
  updateSetupCandidateStatus
} from '../api/liveWorkspace'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
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

const sessionOptions = ['ASIA', 'LONDON', 'NY_AM', 'NY_PM', 'NY'] as const
const objectiveOptions = [
  { value: 'A_PLUS_ONLY', label: 'A+ only' },
  { value: 'ONE_TRADE_MAX', label: 'One trade max' },
  { value: 'TWO_TRADES_MAX', label: 'Two trades max' }
]
const marketOptions = ['FOREX', 'CFD', 'FUTURES', 'CRYPTO', 'STOCK', 'OTHER'] as const
const statusQuickActions: Array<{ value: SetupStatus; label: string; icon: JSX.Element }> = [
  { value: 'WATCHING', label: 'Mark Watching', icon: <RadioButtonCheckedRoundedIcon fontSize="small" /> },
  { value: 'READY', label: 'Mark Ready', icon: <PlaylistAddCheckRoundedIcon fontSize="small" /> },
  { value: 'SKIPPED', label: 'Skip', icon: <SkipNextRoundedIcon fontSize="small" /> },
  { value: 'ARCHIVED', label: 'Archive', icon: <ArchiveRoundedIcon fontSize="small" /> }
]

const elevatedCardSx = {
  borderRadius: 4,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)'
}

const headerSurfaceSx = {
  ...elevatedCardSx,
  background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.12), rgba(245, 158, 11, 0.10))'
}

const heroSurfaceSx = {
  ...elevatedCardSx,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.98))'
}

const railSurfaceSx = {
  ...elevatedCardSx,
  position: { lg: 'sticky' },
  top: { lg: 88 }
}

function parseNumberInput(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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
  return {
    symbol: setup.symbol,
    direction: setup.direction,
    market: setup.market || null,
    tradeSession: setup.tradeSession || null,
    strategyId: setup.strategyId || null,
    strategyLabel: setup.strategyLabel || null,
    setupTitle: setup.setupTitle,
    biasAlignment: setup.biasAlignment || null,
    context: {
      narrative: setup.context.narrative || null,
      liquidityNotes: setup.context.liquidityNotes || null,
      invalidationIdea: setup.context.invalidationIdea || null,
      newsSafety: setup.context.newsSafety || null,
      notes: setup.context.notes || null
    },
    trigger: {
      sweepIdentified: setup.trigger.sweepIdentified ?? false,
      displacementConfirmed: setup.trigger.displacementConfirmed ?? false,
      structureConfirmed: setup.trigger.structureConfirmed ?? false,
      confirmationModel: setup.trigger.confirmationModel || null,
      entryZone: setup.trigger.entryZone || null,
      rrEstimate: setup.trigger.rrEstimate ?? null,
      notes: setup.trigger.notes || null
    },
    execution: {
      entryPrice: setup.execution.entryPrice ?? null,
      stopLossPrice: setup.execution.stopLossPrice ?? null,
      takeProfitPrice: setup.execution.takeProfitPrice ?? null,
      riskAmount: setup.execution.riskAmount ?? null,
      quantity: setup.execution.quantity ?? null,
      invalidation: setup.execution.invalidation || null,
      whyWrong: setup.execution.whyWrong || null,
      initialNotes: setup.execution.initialNotes || null
    },
    levels: setup.levels.map((level) => ({
      label: level.label || null,
      price: level.price ?? null,
      source: level.source || null,
      notes: level.notes || null
    })),
    mentorReference: setup.mentorReference || null
  }
}

function chipColorForReadiness(state: string): ChipProps['color'] {
  if (state === 'READY') return 'success'
  if (state === 'BLOCKED') return 'error'
  return 'warning'
}

function chipColorForStatus(status: SetupStatus): ChipProps['color'] {
  if (status === 'READY' || status === 'TRIGGERED') return 'success'
  if (status === 'EXECUTED' || status === 'CLOSED') return 'primary'
  if (status === 'INVALIDATED' || status === 'ARCHIVED') return 'error'
  if (status === 'SKIPPED') return 'default'
  return 'warning'
}

function formatDirection(direction: 'LONG' | 'SHORT') {
  return direction === 'LONG' ? 'Long' : 'Short'
}

function mentorMatchesSetup(mentorPlan: DailyPlan | null | undefined, setup: SetupItem | null) {
  if (!mentorPlan || !setup) return true
  const mentorSymbol = mentorPlan.tradingViewSymbol?.split(':').pop()?.toUpperCase()
  if (!mentorSymbol) return true
  return mentorSymbol.includes(setup.symbol) || setup.symbol.includes(mentorSymbol)
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

function mergeMentorLevels(existing: SetupLevel[], mentorPlan: DailyPlan): SetupLevel[] {
  const mentorLevels = extractMentorLevels(mentorPlan)
  const deduped = [...existing]
  mentorLevels.forEach((level) => {
    if (!deduped.some((item) => item.label === level.label && item.price === level.price)) {
      deduped.push(level)
    }
  })
  return deduped
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

function toTradingViewSymbol(setupSymbol?: string | null, mentorSymbol?: string | null) {
  if (setupSymbol) {
    const normalized = setupSymbol.trim().toUpperCase()
    if (normalized.includes(':')) return normalized
    if (/^[A-Z]{6}$/.test(normalized)) return `OANDA:${normalized}`
    return normalized
  }
  return mentorSymbol || ''
}

function SetupStatusChip({ status }: { status: SetupStatus }) {
  return <Chip size="small" color={chipColorForStatus(status)} label={status.replaceAll('_', ' ')} />
}

function ReadinessChip({ state, score }: { state: string; score: number }) {
  return <Chip size="small" color={chipColorForReadiness(state)} label={`${score}% ${state.toLowerCase()}`} />
}

export default function SessionPage() {
  const { user } = useAuth()
  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const queryClient = useQueryClient()

  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)
  const [setupDraft, setSetupDraft] = useState<SetupItem | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [mentorExpanded, setMentorExpanded] = useState(false)
  const [showSetupLevels, setShowSetupLevels] = useState(true)
  const [showMentorLevels, setShowMentorLevels] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [createSetupDraft, setCreateSetupDraft] = useState<CreateSetupDraft>({
    symbol: '',
    direction: 'LONG',
    setupTitle: ''
  })

  const sessionSignatureRef = useRef('')
  const setupSignatureRef = useRef('')

  const workspaceQuery = useQuery({
    queryKey: ['liveWorkspace'],
    queryFn: () => getSessionWorkspace()
  })

  const mentorPlanQuery = useQuery({
    queryKey: ['todayMentorPlanWorkspace', workspaceQuery.data?.session.tradingDate || '', timezone],
    queryFn: () => fetchTodayMentorPlan({
      date: workspaceQuery.data?.session.tradingDate || '',
      tz: timezone
    }),
    enabled: Boolean(workspaceQuery.data?.session.tradingDate)
  })

  const deferredChartSymbol = useDeferredValue(toTradingViewSymbol(
    setupDraft?.symbol || workspaceQuery.data?.setups.find((item) => item.id === selectedSetupId)?.symbol || null,
    mentorPlanQuery.data?.tradingViewSymbol || null
  ))
  const deferredChartInterval = useDeferredValue(mentorPlanQuery.data?.tradingViewInterval || '15')

  const applyWorkspace = (workspace: LiveWorkspaceResponse, preferredSetupId?: string | null) => {
    queryClient.setQueryData(['liveWorkspace'], workspace)
    const nextSelectedSetupId = preferredSetupId && workspace.setups.some((item) => item.id === preferredSetupId)
      ? preferredSetupId
      : workspace.activeSetupId && workspace.setups.some((item) => item.id === workspace.activeSetupId)
        ? workspace.activeSetupId
        : workspace.setups[0]?.id || null
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
    onSuccess: (workspace, variables) => {
      applyWorkspace(workspace, workspace.setups.find((item) => item.id !== variables.setupId)?.id || workspace.activeSetupId || null)
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
    mutationFn: (payload: { sessionId: string; setupId: string }) =>
      startTradeFromSetupCandidate(payload.sessionId, payload.setupId),
    onSuccess: (workspace, variables) => {
      applyWorkspace(workspace, variables.setupId)
      setFeedback('Trade started from selected setup.')
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
      setupSignatureRef.current = JSON.stringify(toSetupPayload(nextSetup))
      setSetupDraft(nextSetup)
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
    }, 700)
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
    }, 650)
    return () => window.clearTimeout(timer)
  }, [setupDraft, updateSetupMutation, workspaceQuery.data])

  if (workspaceQuery.isLoading) {
    return <LoadingState rows={10} height={34} />
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    const apiError = workspaceQuery.error as ApiError
    return <Alert severity="error">{apiError?.message || 'Could not load the live workspace.'}</Alert>
  }

  const workspace = workspaceQuery.data
  const selectedSetup = setupDraft || workspace.setups.find((item) => item.id === selectedSetupId) || null
  const selectedSetupIsPersisted = Boolean(selectedSetup && workspace.setups.some((item) => item.id === selectedSetup.id))
  const mentorRelevant = mentorMatchesSetup(mentorPlanQuery.data, selectedSetup)
  const mentorLevels = mentorRelevant ? extractMentorLevels(mentorPlanQuery.data) : []
  const displayedLevels = [
    ...(showSetupLevels ? selectedSetup?.levels || [] : []),
    ...(showMentorLevels ? mentorLevels : [])
  ]
  const autoSaveState = updateSetupMutation.isPending || updateSessionMutation.isPending ? 'Auto-saving…' : 'Saved'

  const updateSelectedSetup = (updater: (setup: SetupItem) => SetupItem) => {
    setSetupDraft((current) => (current ? updater(current) : current))
  }

  const handleSelectSetup = (setupId: string) => {
    startTransition(() => {
      setSelectedSetupId(setupId)
    })
    if (setupId !== workspace.activeSetupId) {
      selectSetupMutation.mutate({ sessionId: workspace.session.id, setupId })
    }
  }

  const handleAddMentorContext = () => {
    if (!selectedSetup || !mentorPlanQuery.data) return
    updateSelectedSetup((current) => ({
      ...current,
      mentorReference: createMentorReference(mentorPlanQuery.data as DailyPlan),
      levels: mergeMentorLevels(current.levels, mentorPlanQuery.data as DailyPlan),
      context: {
        ...current.context,
        narrative: current.context.narrative || mentorPlanQuery.data?.summary || mentorPlanQuery.data?.biasSummary || '',
        liquidityNotes: current.context.liquidityNotes || mentorPlanQuery.data?.liquidityNarrative || ''
      }
    }))
    setFeedback('Mentor context copied into the selected setup.')
  }

  const startExecutionScroll = () => {
    document.getElementById('execution-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0, pb: 3 }}>
      <Card sx={headerSurfaceSx}>
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" color="success" label="Live workspace" />
                  <Chip
                    size="small"
                    color={workspace.session.lockedInAt ? 'success' : 'default'}
                    label={workspace.session.lockedInAt ? 'Locked' : 'Unlocked'}
                    icon={workspace.session.lockedInAt ? <LockRoundedIcon /> : <LockOpenRoundedIcon />}
                  />
                </Stack>
                <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 800 }}>
                  {workspace.session.sessionName || 'Today'}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {`${formatDate(workspace.session.tradingDate, timezone)} • Chart-first live execution workspace`}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                  Add setup
                </Button>
                <Button
                  variant="outlined"
                  startIcon={workspace.session.lockedInAt ? <LockOpenRoundedIcon /> : <LockRoundedIcon />}
                  onClick={() => updateSessionMutation.mutate({
                    sessionId: workspace.session.id,
                    data: {
                      ...toSessionPayload(sessionDraft || toSessionDraft(workspace.session)),
                      lockSession: !workspace.session.lockedInAt
                    },
                    signature: sessionSignatureRef.current
                  })}
                  disabled={updateSessionMutation.isPending}
                >
                  {workspace.session.lockedInAt ? 'Unlock session' : 'Lock session'}
                </Button>
                <Button variant="outlined" startIcon={<SchoolRoundedIcon />} onClick={() => setMentorExpanded((value) => !value)}>
                  {mentorExpanded ? 'Hide mentor' : 'Open mentor'}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={startExecutionScroll}
                  disabled={!selectedSetup}
                >
                  Start execution
                </Button>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={`Max loss ${formatCurrency(workspace.session.quickStats.maxLoss, baseCurrency)}`} />
              <Chip size="small" variant="outlined" label={`Risk used ${formatCurrency(workspace.session.quickStats.riskUsed, baseCurrency)}`} />
              <Chip size="small" variant="outlined" label={`Trades ${workspace.session.quickStats.tradesTaken}`} />
              <Chip size="small" variant="outlined" label={`Active setups ${workspace.session.quickStats.activeSetupCount}`} />
            </Stack>
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
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.7fr) 360px' },
          gap: 2,
          alignItems: 'start'
        }}
      >
        <Stack spacing={2}>
          <Card sx={heroSurfaceSx}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <CandlestickChartRoundedIcon color="primary" />
                      <Typography variant="h5" fontWeight={800}>Chart workspace</Typography>
                      {selectedSetup ? <ReadinessChip state={selectedSetup.readiness.state} score={selectedSetup.readiness.score} /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      The selected setup anchors symbol, levels, readiness, and execution.
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {autoSaveState}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {workspace.setups.map((setup) => (
                    <Card
                      key={setup.id}
                      sx={{
                        minWidth: 220,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: selectedSetup?.id === setup.id ? 'primary.main' : 'divider',
                        backgroundColor: selectedSetup?.id === setup.id ? 'rgba(14, 165, 233, 0.08)' : 'background.paper'
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Stack spacing={0.25}>
                              <Typography variant="subtitle2" fontWeight={800}>{setup.setupTitle}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {`${setup.symbol} • ${formatDirection(setup.direction)}`}
                              </Typography>
                            </Stack>
                            <SetupStatusChip status={setup.status} />
                          </Stack>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Chip size="small" variant="outlined" label={`${setup.readiness.score}%`} />
                            {setup.tradeSession ? <Chip size="small" variant="outlined" label={setup.tradeSession} /> : null}
                            {setup.strategyLabel ? <Chip size="small" variant="outlined" label={setup.strategyLabel} /> : null}
                          </Stack>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Button size="small" variant={selectedSetup?.id === setup.id ? 'contained' : 'text'} onClick={() => handleSelectSetup(setup.id)}>
                              Edit
                            </Button>
                            <Button
                              size="small"
                              startIcon={<ContentCopyRoundedIcon />}
                              onClick={() => duplicateSetupMutation.mutate({ sessionId: workspace.session.id, setupId: setup.id })}
                            >
                              Duplicate
                            </Button>
                            <Button
                              size="small"
                              onClick={() => statusMutation.mutate({ sessionId: workspace.session.id, setupId: setup.id, status: 'READY' })}
                            >
                              Mark ready
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}

                  <Button
                    variant="outlined"
                    startIcon={<AddRoundedIcon />}
                    sx={{ minWidth: 180, minHeight: 120, borderStyle: 'dashed' }}
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    Add new setup
                  </Button>
                </Stack>

                {selectedSetup ? (
                  <>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" color="primary" label={selectedSetup.symbol} />
                      {selectedSetup.tradeSession ? <Chip size="small" variant="outlined" label={selectedSetup.tradeSession} /> : null}
                      <Chip
                        size="small"
                        variant="outlined"
                        label={selectedSetup.direction === 'LONG' ? 'Long bias' : 'Short bias'}
                        icon={selectedSetup.direction === 'LONG' ? <NorthEastRoundedIcon /> : <SouthWestRoundedIcon />}
                      />
                      {selectedSetup.strategyLabel ? <Chip size="small" variant="outlined" label={selectedSetup.strategyLabel} /> : null}
                      {selectedSetup.context.newsSafety ? <Chip size="small" variant="outlined" label={`News: ${selectedSetup.context.newsSafety}`} /> : null}
                      <Chip size="small" color={chipColorForReadiness(selectedSetup.readiness.state)} label={selectedSetup.readiness.summary} />
                    </Stack>

                    <Box sx={{ position: { lg: 'sticky' }, top: { lg: 72 }, zIndex: 1 }}>
                      {deferredChartSymbol ? (
                        <TradingViewWidget
                          symbol={deferredChartSymbol}
                          interval={deferredChartInterval}
                          minHeight={620}
                          fallbackMessage="The chart could not be embedded here. Open it in TradingView to keep the workspace running."
                        />
                      ) : (
                        <Box sx={{ py: 6 }}>
                          <EmptyState
                            title="Create your first setup to anchor the chart"
                            description="The chart stays empty until a setup defines the live symbol and execution context."
                            icon={<CandlestickChartRoundedIcon fontSize="inherit" />}
                          />
                        </Box>
                      )}
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <FormControlLabel
                          control={<Switch checked={showSetupLevels} onChange={(event) => setShowSetupLevels(event.target.checked)} />}
                          label="Setup levels"
                        />
                        <FormControlLabel
                          control={<Switch checked={showMentorLevels} onChange={(event) => setShowMentorLevels(event.target.checked)} />}
                          label="Mentor levels"
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        TradingView embed limits direct overlays, so active levels stay visible here and track the selected setup.
                      </Typography>
                    </Stack>

                    {displayedLevels.length > 0 ? (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {displayedLevels.map((level, index) => (
                          <Chip
                            key={`${level.label || 'level'}-${index}`}
                            size="small"
                            label={`${level.label || 'Level'}${level.price != null ? ` • ${formatNumber(level.price, 5)}` : ''}${level.source ? ` • ${level.source}` : ''}`}
                            variant={level.source === 'MENTOR' ? 'filled' : 'outlined'}
                          />
                        ))}
                      </Stack>
                    ) : (
                      <Alert severity="info">No active levels are attached to this setup yet.</Alert>
                    )}
                  </>
                ) : (
                  <EmptyState
                    title="No setup selected"
                    description="Create your first setup to drive the chart, mentor panel, and execution flow."
                    icon={<FlagRoundedIcon fontSize="inherit" />}
                    action={(
                      <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                        Add setup
                      </Button>
                    )}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={heroSurfaceSx}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SchoolRoundedIcon color="primary" />
                    <Typography variant="h6" fontWeight={800}>Mentor context</Typography>
                  </Stack>
                  <Button size="small" variant="text" onClick={() => setMentorExpanded((value) => !value)}>
                    {mentorExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                </Stack>

                {mentorPlanQuery.isLoading ? (
                  <LoadingState rows={4} height={20} />
                ) : mentorPlanQuery.data && mentorRelevant ? (
                  <>
                    <Typography variant="subtitle1" fontWeight={700}>{mentorPlanQuery.data.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {mentorPlanQuery.data.summary || mentorPlanQuery.data.biasSummary || 'Mentor bias and execution notes are available for this session.'}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {mentorPlanQuery.data.biasSummary ? <Chip size="small" label={mentorPlanQuery.data.biasSummary} /> : null}
                      {(mentorPlanQuery.data.keyLevels || []).slice(0, 4).map((item) => (
                        <Chip key={item} size="small" variant="outlined" label={item} />
                      ))}
                    </Stack>
                    <Collapse in={mentorExpanded}>
                      <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                        {mentorPlanQuery.data.executionRules ? (
                          <Typography variant="body2"><strong>Preferred scenario:</strong> {mentorPlanQuery.data.executionRules}</Typography>
                        ) : null}
                        {mentorPlanQuery.data.alternativeScenario ? (
                          <Typography variant="body2"><strong>Invalidation:</strong> {mentorPlanQuery.data.alternativeScenario}</Typography>
                        ) : null}
                        {mentorPlanQuery.data.riskNote ? (
                          <Alert severity="warning">{mentorPlanQuery.data.riskNote}</Alert>
                        ) : null}
                      </Stack>
                    </Collapse>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button variant="outlined" size="small" onClick={handleAddMentorContext} disabled={!selectedSetup}>
                        Apply mentor levels
                      </Button>
                      <Button variant="text" size="small" onClick={() => setMentorExpanded(true)}>
                        Open full mentor context
                      </Button>
                    </Stack>
                  </>
                ) : (
                  <EmptyState
                    title={selectedSetup ? `No mentor note for ${selectedSetup.symbol}` : 'No mentor note'}
                    description="When today’s mentor plan matches the selected symbol, it appears here without taking focus away from the chart."
                    icon={<SchoolRoundedIcon fontSize="inherit" />}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          {selectedSetup ? (
            <Stack spacing={2}>
              <Card sx={heroSurfaceSx}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                      <Stack spacing={0.5}>
                        <Typography variant="h6" fontWeight={800}>Selected setup</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedSetup.readiness.summary}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <SetupStatusChip status={selectedSetup.status} />
                        <ReadinessChip state={selectedSetup.readiness.state} score={selectedSetup.readiness.score} />
                      </Stack>
                    </Stack>

                    {selectedSetup.readiness.blockers.length > 0 ? (
                      <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
                        {`Missing: ${selectedSetup.readiness.blockers.join(', ')}`}
                      </Alert>
                    ) : null}

                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" fontWeight={800}>Context</Typography>
                            <Chip size="small" color={chipColorForReadiness(selectedSetup.readiness.steps[0]?.state || 'INCOMPLETE')} label={selectedSetup.readiness.steps[0]?.state || 'INCOMPLETE'} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {selectedSetup.readiness.steps[0]?.summary}
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                            <TextField
                              label="Symbol"
                              value={selectedSetup.symbol}
                              onChange={(event) => updateSelectedSetup((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                              fullWidth
                            />
                            <FormControl fullWidth>
                              <InputLabel id="setup-direction-label">Direction</InputLabel>
                              <Select
                                labelId="setup-direction-label"
                                label="Direction"
                                value={selectedSetup.direction}
                                onChange={(event) => updateSelectedSetup((current) => ({ ...current, direction: event.target.value as SetupItem['direction'] }))}
                              >
                                <MenuItem value="LONG">Long</MenuItem>
                                <MenuItem value="SHORT">Short</MenuItem>
                              </Select>
                            </FormControl>
                            <FormControl fullWidth>
                              <InputLabel id="setup-market-label">Market</InputLabel>
                              <Select
                                labelId="setup-market-label"
                                label="Market"
                                value={selectedSetup.market || 'FOREX'}
                                onChange={(event) => updateSelectedSetup((current) => ({ ...current, market: event.target.value as SetupItem['market'] }))}
                              >
                                {marketOptions.map((market) => (
                                  <MenuItem key={market} value={market}>{market}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl fullWidth>
                              <InputLabel id="setup-session-label">Session</InputLabel>
                              <Select
                                labelId="setup-session-label"
                                label="Session"
                                value={selectedSetup.tradeSession || ''}
                                onChange={(event) => updateSelectedSetup((current) => ({ ...current, tradeSession: (event.target.value || null) as SetupItem['tradeSession'] }))}
                              >
                                {sessionOptions.map((option) => (
                                  <MenuItem key={option} value={option}>{option}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <TextField
                              label="Setup title"
                              value={selectedSetup.setupTitle}
                              onChange={(event) => updateSelectedSetup((current) => ({ ...current, setupTitle: event.target.value }))}
                              fullWidth
                            />
                            <TextField
                              label="Strategy"
                              value={selectedSetup.strategyLabel || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({ ...current, strategyLabel: event.target.value }))}
                              fullWidth
                            />
                            <TextField
                              label="Bias alignment"
                              value={selectedSetup.biasAlignment || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({ ...current, biasAlignment: event.target.value }))}
                              fullWidth
                            />
                            <TextField
                              label="News safety"
                              value={selectedSetup.context.newsSafety || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, newsSafety: event.target.value }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Narrative"
                              value={selectedSetup.context.narrative || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, narrative: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                            />
                            <TextField
                              label="Liquidity / key levels"
                              value={selectedSetup.context.liquidityNotes || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, liquidityNotes: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                            />
                            <TextField
                              label="Invalidation idea"
                              value={selectedSetup.context.invalidationIdea || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, invalidationIdea: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                            />
                            <TextField
                              label="Context notes"
                              value={selectedSetup.context.notes || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                context: { ...current.context, notes: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                            />
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" fontWeight={800}>Trigger</Typography>
                            <Chip size="small" color={chipColorForReadiness(selectedSetup.readiness.steps[1]?.state || 'INCOMPLETE')} label={selectedSetup.readiness.steps[1]?.state || 'INCOMPLETE'} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {selectedSetup.readiness.steps[1]?.summary}
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
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
                              label="Sweep identified"
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
                              label="Displacement confirmed"
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
                              label="MSS / structure confirmed"
                            />
                            <TextField
                              label="Confirmation model"
                              value={selectedSetup.trigger.confirmationModel || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, confirmationModel: event.target.value }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Entry zone"
                              value={selectedSetup.trigger.entryZone || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, entryZone: event.target.value }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="RR estimate"
                              value={selectedSetup.trigger.rrEstimate ?? ''}
                              type="number"
                              inputProps={{ step: '0.1' }}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, rrEstimate: parseNumberInput(event.target.value) }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Trigger notes"
                              value={selectedSetup.trigger.notes || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                trigger: { ...current.trigger, notes: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                              sx={{ gridColumn: { md: '1 / -1' } }}
                            />
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card id="execution-step" variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" fontWeight={800}>Execution</Typography>
                            <Chip size="small" color={chipColorForReadiness(selectedSetup.readiness.steps[2]?.state || 'INCOMPLETE')} label={selectedSetup.readiness.steps[2]?.state || 'INCOMPLETE'} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {selectedSetup.readiness.steps[2]?.summary}
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                            <TextField
                              label="Entry"
                              value={selectedSetup.execution.entryPrice ?? ''}
                              type="number"
                              inputProps={{ step: '0.0001' }}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, entryPrice: parseNumberInput(event.target.value) }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Stop loss"
                              value={selectedSetup.execution.stopLossPrice ?? ''}
                              type="number"
                              inputProps={{ step: '0.0001' }}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, stopLossPrice: parseNumberInput(event.target.value) }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Take profit"
                              value={selectedSetup.execution.takeProfitPrice ?? ''}
                              type="number"
                              inputProps={{ step: '0.0001' }}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, takeProfitPrice: parseNumberInput(event.target.value) }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Risk amount"
                              value={selectedSetup.execution.riskAmount ?? ''}
                              type="number"
                              inputProps={{ step: '0.01' }}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, riskAmount: parseNumberInput(event.target.value) }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Quantity"
                              value={selectedSetup.execution.quantity ?? ''}
                              type="number"
                              inputProps={{ step: '0.01' }}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, quantity: parseNumberInput(event.target.value) }
                              }))}
                              fullWidth
                            />
                            <TextField
                              label="Why wrong if..."
                              value={selectedSetup.execution.whyWrong || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, whyWrong: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                            />
                            <TextField
                              label="Execution invalidation"
                              value={selectedSetup.execution.invalidation || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, invalidation: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                            />
                            <TextField
                              label="Initial notes"
                              value={selectedSetup.execution.initialNotes || ''}
                              onChange={(event) => updateSelectedSetup((current) => ({
                                ...current,
                                execution: { ...current.execution, initialNotes: event.target.value }
                              }))}
                              fullWidth
                              multiline
                              minRows={3}
                            />
                          </Box>

                          <Divider />

                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <Chip label={`RR ${selectedSetup.trigger.rrEstimate != null ? formatNumber(selectedSetup.trigger.rrEstimate, 2) : '—'}`} />
                            <Chip label={`Risk ${formatCurrency(selectedSetup.execution.riskAmount, baseCurrency)}`} variant="outlined" />
                            <Chip label={selectedSetup.readiness.summary} color={chipColorForReadiness(selectedSetup.readiness.state)} />
                          </Stack>

                          {selectedSetup.readiness.blockers.length > 0 ? (
                            <Alert severity="warning">{`Start trade is blocked by: ${selectedSetup.readiness.blockers.join(', ')}`}</Alert>
                          ) : null}

                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button
                              variant="outlined"
                              onClick={() => {
                                if (!selectedSetupIsPersisted) return
                                const signature = JSON.stringify(toSetupPayload(selectedSetup))
                                updateSetupMutation.mutate({
                                  sessionId: workspace.session.id,
                                  setupId: selectedSetup.id,
                                  data: toSetupPayload(selectedSetup),
                                  signature
                                })
                              }}
                              disabled={!selectedSetupIsPersisted}
                            >
                              Save draft
                            </Button>
                            {statusQuickActions.map((action) => (
                              <Button
                                key={action.value}
                                variant="outlined"
                                startIcon={action.icon}
                                onClick={() => statusMutation.mutate({
                                  sessionId: workspace.session.id,
                                  setupId: selectedSetup.id,
                                  status: action.value
                                })}
                              >
                                {action.label}
                              </Button>
                            ))}
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<DoDisturbRoundedIcon />}
                              onClick={() => statusMutation.mutate({
                                sessionId: workspace.session.id,
                                setupId: selectedSetup.id,
                                status: 'INVALIDATED'
                              })}
                            >
                              Mark invalidated
                            </Button>
                            <Button
                              variant="contained"
                              color="secondary"
                              startIcon={<PlayArrowRoundedIcon />}
                              onClick={() => startTradeMutation.mutate({
                                sessionId: workspace.session.id,
                                setupId: selectedSetup.id
                              })}
                              disabled={startTradeMutation.isPending || selectedSetup.readiness.blockers.length > 0}
                            >
                              Start trade
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          ) : null}

          <Card sx={heroSurfaceSx}>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h6" fontWeight={800}>Session activity</Typography>
                {workspace.activity.length === 0 ? (
                  <EmptyState
                    title="No trades yet"
                    description="Started trades for this session show up here with their linked setup."
                    icon={<FlagRoundedIcon fontSize="inherit" />}
                  />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Setup</TableCell>
                          <TableCell>Symbol</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Risk</TableCell>
                          <TableCell align="right">R</TableCell>
                          <TableCell align="right">PnL</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {workspace.activity.map((trade) => (
                          <TableRow key={trade.tradeId}>
                            <TableCell>
                              <Stack spacing={0.25}>
                                <Typography variant="body2" fontWeight={700}>{trade.setupTitle || 'Trade'}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {trade.openedAt ? formatDateTime(trade.openedAt, timezone) : '—'}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>{trade.symbol}</TableCell>
                            <TableCell>{trade.status}</TableCell>
                            <TableCell align="right">{formatCurrency(trade.riskAmount, baseCurrency)}</TableCell>
                            <TableCell align="right">{trade.rMultiple != null ? formatNumber(trade.rMultiple, 2) : '—'}</TableCell>
                            <TableCell align="right">{formatSignedCurrency(trade.pnlNet, baseCurrency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Card sx={railSurfaceSx}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack spacing={0.5}>
                  <Typography variant="h6" fontWeight={800}>Session rail</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Lock-in, guardrails, and live warnings stay visible here.
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  color={chipColorForReadiness(workspace.session.readiness.state)}
                  label={`${workspace.session.readiness.score}%`}
                />
              </Stack>

              <Box>
                <LinearProgress variant="determinate" value={workspace.session.readiness.score} sx={{ height: 8, borderRadius: 999 }} />
                <Typography variant="caption" color="text.secondary">
                  {workspace.session.readiness.summary}
                </Typography>
              </Box>

              <FormControl fullWidth>
                <InputLabel id="session-name-label">Session</InputLabel>
                <Select
                  labelId="session-name-label"
                  label="Session"
                  value={sessionDraft?.sessionName || ''}
                  onChange={(event) => setSessionDraft((current) => current ? { ...current, sessionName: event.target.value } : current)}
                >
                  {sessionOptions.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="session-objective-label">Quality filter</InputLabel>
                <Select
                  labelId="session-objective-label"
                  label="Quality filter"
                  value={sessionDraft?.objective || ''}
                  onChange={(event) => setSessionDraft((current) => current ? { ...current, objective: event.target.value } : current)}
                >
                  {objectiveOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="session-bias-label">Bias</InputLabel>
                <Select
                  labelId="session-bias-label"
                  label="Bias"
                  value={sessionDraft?.bias || ''}
                  onChange={(event) => setSessionDraft((current) => current ? { ...current, bias: event.target.value } : current)}
                >
                  <MenuItem value="LONG">Long</MenuItem>
                  <MenuItem value="SHORT">Short</MenuItem>
                  <MenuItem value="NEUTRAL">Neutral</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Bias reason"
                value={sessionDraft?.biasReason || ''}
                onChange={(event) => setSessionDraft((current) => current ? { ...current, biasReason: event.target.value } : current)}
                fullWidth
                multiline
                minRows={2}
              />

              <TextField
                label="Daily max loss"
                type="number"
                inputProps={{ step: '0.01' }}
                value={sessionDraft?.dailyMaxLoss ?? ''}
                onChange={(event) => setSessionDraft((current) => current ? { ...current, dailyMaxLoss: parseNumberInput(event.target.value) } : current)}
                fullWidth
              />

              <TextField
                label="Max trades"
                type="number"
                value={sessionDraft?.maxTrades ?? ''}
                onChange={(event) => setSessionDraft((current) => current ? { ...current, maxTrades: parseNumberInput(event.target.value) } : current)}
                fullWidth
              />

              <TextField
                label="Session narrative"
                value={sessionDraft?.narrative || ''}
                onChange={(event) => setSessionDraft((current) => current ? { ...current, narrative: event.target.value } : current)}
                fullWidth
                multiline
                minRows={4}
              />

              <Button
                variant="contained"
                startIcon={workspace.session.lockedInAt ? <LockOpenRoundedIcon /> : <LockRoundedIcon />}
                onClick={() => updateSessionMutation.mutate({
                  sessionId: workspace.session.id,
                  data: {
                    ...toSessionPayload(sessionDraft || toSessionDraft(workspace.session)),
                    lockSession: !workspace.session.lockedInAt
                  },
                  signature: sessionSignatureRef.current
                })}
              >
                {workspace.session.lockedInAt ? 'Unlock session' : 'Lock session'}
              </Button>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={800}>Prerequisites</Typography>
                {workspace.session.readiness.steps.map((step) => (
                  <Box key={step.key} sx={{ p: 1.25, borderRadius: 2, backgroundColor: 'action.hover' }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" fontWeight={700}>{step.label}</Typography>
                      <Chip size="small" color={chipColorForReadiness(step.state)} label={step.state.toLowerCase()} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{step.summary}</Typography>
                  </Box>
                ))}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={800}>Warnings</Typography>
                {workspace.session.warnings.length ? workspace.session.warnings.map((warning) => (
                  <Alert key={warning} severity="warning" icon={<WarningAmberRoundedIcon />}>
                    {warning}
                  </Alert>
                )) : (
                  <Alert severity="success">No live session warnings right now.</Alert>
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={800}>Live metrics</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" icon={<FlagRoundedIcon />} label={`Trades ${workspace.session.quickStats.tradesTaken}`} />
                  <Chip size="small" icon={<AutoAwesomeRoundedIcon />} label={`Active setups ${workspace.session.quickStats.activeSetupCount}`} />
                  <Chip size="small" label={`PnL ${formatSignedCurrency(workspace.session.quickStats.realizedPnl, baseCurrency)}`} />
                  <Chip size="small" label={`Risk ${formatCurrency(workspace.session.quickStats.riskUsed, baseCurrency)}`} />
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create setup</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Symbol"
              value={createSetupDraft.symbol}
              onChange={(event) => setCreateSetupDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
              autoFocus
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="create-setup-direction-label">Direction</InputLabel>
              <Select
                labelId="create-setup-direction-label"
                label="Direction"
                value={createSetupDraft.direction}
                onChange={(event) => setCreateSetupDraft((current) => ({ ...current, direction: event.target.value as CreateSetupDraft['direction'] }))}
              >
                <MenuItem value="LONG">Long</MenuItem>
                <MenuItem value="SHORT">Short</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Setup title"
              value={createSetupDraft.setupTitle}
              onChange={(event) => setCreateSetupDraft((current) => ({ ...current, setupTitle: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createSetupMutation.mutate({
              sessionId: workspace.session.id,
              data: {
                symbol: createSetupDraft.symbol,
                direction: createSetupDraft.direction,
                setupTitle: createSetupDraft.setupTitle
              }
            })}
            disabled={!createSetupDraft.symbol || !createSetupDraft.setupTitle}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

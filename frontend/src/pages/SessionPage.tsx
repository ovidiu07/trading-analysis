import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
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
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
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

const sessionOptions = ['ASIA', 'LONDON', 'NY_AM', 'NY_PM', 'NY'] as const
const marketOptions = ['FOREX', 'CFD', 'FUTURES', 'CRYPTO', 'STOCK', 'OTHER'] as const
const statusQuickActions: Array<{ value: SetupStatus; label: string; icon: JSX.Element }> = [
  { value: 'WATCHING', label: 'Mark Watching', icon: <RadioButtonCheckedRoundedIcon fontSize="small" /> },
  { value: 'READY', label: 'Mark Ready', icon: <PlaylistAddCheckRoundedIcon fontSize="small" /> },
  { value: 'SKIPPED', label: 'Skip', icon: <SkipNextRoundedIcon fontSize="small" /> },
  { value: 'ARCHIVED', label: 'Archive', icon: <ArchiveRoundedIcon fontSize="small" /> }
]

type WorkflowStepDefinition = {
  description: string
  icon: JSX.Element
  title: string
}

const sessionPageSx = (theme: Theme) => {
  const darkMode = theme.palette.mode === 'dark'
  const panelBorder = alpha(theme.palette.divider, darkMode ? 0.95 : 0.72)
  const softBorder = alpha(theme.palette.divider, darkMode ? 0.72 : 0.56)
  const panelShadow = darkMode ? '0 24px 48px rgba(0, 0, 0, 0.38)' : '0 20px 44px rgba(15, 23, 42, 0.08)'
  const tileBackground = darkMode ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.common.white, 0.92)
  const subtleBackground = darkMode ? alpha(theme.palette.common.white, 0.024) : alpha(theme.palette.primary.main, 0.032)
  const headerBackground = darkMode
    ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.12)} 42%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`
    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.07)} 44%, ${alpha(theme.palette.common.white, 0.96)} 100%)`
  const workflowBackground = darkMode
    ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`
    : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.98)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`

  return {
    '--session-radius-panel': '12px',
    '--session-radius-control': '8px',
    '--session-radius-button': '10px',
    '--session-radius-tile': '10px',
    '& .session-panel': {
      borderRadius: 'var(--session-radius-panel)',
      border: `1px solid ${panelBorder}`,
      background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, darkMode ? 0.96 : 0.98)} 0%, ${alpha(theme.palette.background.paper, darkMode ? 0.88 : 0.94)} 100%)`,
      boxShadow: panelShadow,
      backdropFilter: darkMode ? 'blur(14px) saturate(1.08)' : 'blur(8px)'
    },
    '& .session-panel--header': {
      background: headerBackground
    },
    '& .session-panel--workflow': {
      background: workflowBackground
    },
    '& .session-section-kicker': {
      color: 'text.secondary',
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase'
    },
    '& .session-section-copy': {
      color: 'text.secondary',
      maxWidth: '72ch'
    },
    '& .session-metric-grid': {
      display: 'grid',
      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
      gap: 1.25
    },
    '& .session-metric-card': {
      minWidth: 0,
      padding: theme.spacing(2),
      borderRadius: 'var(--session-radius-tile)',
      border: `1px solid ${softBorder}`,
      background: `linear-gradient(180deg, ${tileBackground} 0%, ${alpha(theme.palette.background.paper, darkMode ? 0.72 : 0.92)} 100%)`
    },
    '& .session-metric-label': {
      color: 'text.secondary',
      fontSize: '0.74rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    },
    '& .session-metric-value': {
      marginTop: theme.spacing(1),
      color: 'text.primary',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      lineHeight: 1.08
    },
    '& .session-workflow-list': {
      listStyle: 'none',
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
      gap: 1.25,
      padding: 0,
      margin: 0
    },
    '& .session-workflow-step': {
      minHeight: '100%',
      padding: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.25),
      borderRadius: 'var(--session-radius-tile)',
      border: `1px solid ${softBorder}`,
      background: `linear-gradient(180deg, ${tileBackground} 0%, ${alpha(theme.palette.background.paper, darkMode ? 0.74 : 0.9)} 100%)`
    },
    '& .session-step-header': {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing(1)
    },
    '& .session-step-index': {
      width: 32,
      height: 32,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '9999px',
      color: theme.palette.primary.contrastText,
      fontSize: '0.78rem',
      fontWeight: 800,
      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
    },
    '& .session-step-icon': {
      width: 34,
      height: 34,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '10px',
      color: 'primary.main',
      backgroundColor: darkMode ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.primary.main, 0.08)
    },
    '& .session-setup-grid': {
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
      gap: 1.25
    },
    '& .session-setup-card': {
      minWidth: 0,
      borderRadius: 'var(--session-radius-tile)',
      border: `1px solid ${softBorder}`,
      background: `linear-gradient(180deg, ${subtleBackground} 0%, ${alpha(theme.palette.background.paper, darkMode ? 0.8 : 0.92)} 100%)`,
      transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease'
    },
    '& .session-setup-card:hover': {
      transform: 'translateY(-1px)',
      boxShadow: darkMode ? '0 16px 30px rgba(0, 0, 0, 0.26)' : '0 12px 24px rgba(15, 23, 42, 0.08)'
    },
    '& .session-setup-card.is-active': {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.34)}`,
      background: darkMode
        ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`
        : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.common.white, 0.96)} 100%)`
    },
    '& .session-chart-frame': {
      minHeight: 620,
      overflow: 'hidden',
      borderRadius: 'var(--session-radius-panel)',
      border: `1px solid ${panelBorder}`,
      backgroundColor: darkMode ? '#050608' : '#ffffff'
    },
    '& .session-subpanel': {
      padding: theme.spacing(2.5),
      borderRadius: 'var(--session-radius-tile)',
      border: `1px solid ${softBorder}`,
      background: `linear-gradient(180deg, ${subtleBackground} 0%, ${alpha(theme.palette.background.paper, darkMode ? 0.78 : 0.94)} 100%)`
    },
    '& .session-empty-state': {
      minHeight: 220,
      padding: theme.spacing(4),
      borderRadius: 'var(--session-radius-panel)',
      borderStyle: 'dashed',
      borderColor: panelBorder,
      background: `linear-gradient(180deg, ${tileBackground} 0%, ${alpha(theme.palette.background.paper, darkMode ? 0.68 : 0.9)} 100%)`
    },
    '& .session-rail-block': {
      padding: theme.spacing(2),
      borderRadius: 'var(--session-radius-tile)',
      border: `1px solid ${softBorder}`,
      background: `linear-gradient(180deg, ${tileBackground} 0%, ${alpha(theme.palette.background.paper, darkMode ? 0.78 : 0.94)} 100%)`
    },
    '& .session-rail-list-item': {
      padding: theme.spacing(1.5),
      borderRadius: 'var(--session-radius-tile)',
      border: `1px solid ${softBorder}`,
      backgroundColor: darkMode ? alpha(theme.palette.common.white, 0.022) : alpha(theme.palette.common.white, 0.88)
    },
    '& .session-table-wrap': {
      overflow: 'hidden',
      borderRadius: 'var(--session-radius-panel)',
      border: `1px solid ${softBorder}`,
      backgroundColor: alpha(theme.palette.background.paper, darkMode ? 0.84 : 0.95)
    },
    '& .session-create-tile': {
      minHeight: 128,
      borderRadius: 'var(--session-radius-tile)',
      borderStyle: 'dashed'
    },
    '& .MuiButton-root': {
      minHeight: 42,
      borderRadius: 'var(--session-radius-button)',
      fontWeight: 700
    },
    '& .MuiButton-sizeSmall': {
      minHeight: 34
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: 'var(--session-radius-control)',
      backgroundColor: darkMode ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.white, 0.94),
      '& .MuiOutlinedInput-input': {
        fontWeight: 500
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: softBorder
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: panelBorder
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, darkMode ? 0.24 : 0.16)}`
      }
    },
    '& .MuiInputLabel-root': {
      color: 'text.secondary',
      fontWeight: 600
    },
    '& .MuiFormControlLabel-label': {
      color: 'text.primary',
      fontSize: '0.86rem',
      fontWeight: 600
    },
    '& .MuiAlert-root': {
      alignItems: 'flex-start',
      borderRadius: 'var(--session-radius-tile)',
      border: `1px solid ${softBorder}`
    },
    '& .MuiAlertTitle-root': {
      marginBottom: theme.spacing(0.5),
      fontWeight: 800
    },
    '& .MuiAlert-standardWarning': {
      color: 'text.primary',
      backgroundColor: darkMode ? alpha(theme.palette.warning.main, 0.14) : alpha(theme.palette.warning.main, 0.08)
    },
    '& .MuiAlert-standardInfo': {
      color: 'text.primary',
      backgroundColor: darkMode ? alpha(theme.palette.info.main, 0.14) : alpha(theme.palette.info.main, 0.08)
    },
    '& .MuiAlert-standardSuccess': {
      color: 'text.primary',
      backgroundColor: darkMode ? alpha(theme.palette.success.main, 0.14) : alpha(theme.palette.success.main, 0.08)
    },
    '& .MuiDivider-root': {
      borderColor: alpha(theme.palette.divider, 0.82)
    },
    '& .MuiLinearProgress-root': {
      height: 8,
      borderRadius: 9999,
      backgroundColor: darkMode ? alpha(theme.palette.common.white, 0.08) : alpha(theme.palette.primary.main, 0.08)
    }
  }
}

function SurfaceMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Box className="session-metric-card">
      <Typography className="session-metric-label">{label}</Typography>
      <Typography variant="h5" className="metric-value session-metric-value">
        {value}
      </Typography>
    </Box>
  )
}

function WorkflowStepCard({ description, icon, index, title }: WorkflowStepDefinition & { index: number }) {
  return (
    <Box component="li" className="session-workflow-step">
      <Box className="session-step-header">
        <Box className="session-step-index">{index}</Box>
        <Box className="session-step-icon">{icon}</Box>
      </Box>
      <Stack spacing={0.75}>
        <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </Box>
  )
}

const panelContentSx = {
  p: { xs: 2.5, md: 3 },
  '&:last-child': {
    pb: { xs: 2.5, md: 3 }
  }
}

const formGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.5
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
  const { t } = useI18n()
  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const queryClient = useQueryClient()
  const objectiveOptions = [
    { value: 'A_PLUS_ONLY', label: t('today.session.lockIn.objectiveAPlus') },
    { value: 'ONE_TRADE_MAX', label: t('today.session.lockIn.objectiveOne') },
    { value: 'TWO_TRADES_MAX', label: t('today.session.lockIn.objectiveTwo') }
  ]

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
  const isSessionLocked = Boolean(workspace.session.lockedInAt)
  const autoSaveState = updateSetupMutation.isPending || updateSessionMutation.isPending
    ? t('today.session.workspace.autoSaving')
    : t('today.session.workspace.saved')
  const workflowSteps: WorkflowStepDefinition[] = [
    {
      title: t('today.session.workflowGuide.steps.setGuardrails.title'),
      description: t('today.session.workflowGuide.steps.setGuardrails.description'),
      icon: <FlagRoundedIcon fontSize="small" />
    },
    {
      title: t('today.session.workflowGuide.steps.writeNarrative.title'),
      description: t('today.session.workflowGuide.steps.writeNarrative.description'),
      icon: <SchoolRoundedIcon fontSize="small" />
    },
    {
      title: t('today.session.workflowGuide.steps.prepareSetups.title'),
      description: t('today.session.workflowGuide.steps.prepareSetups.description'),
      icon: <PlaylistAddCheckRoundedIcon fontSize="small" />
    },
    {
      title: t('today.session.workflowGuide.steps.lockPlan.title'),
      description: t('today.session.workflowGuide.steps.lockPlan.description'),
      icon: <LockRoundedIcon fontSize="small" />
    },
    {
      title: t('today.session.workflowGuide.steps.executeReview.title'),
      description: t('today.session.workflowGuide.steps.executeReview.description'),
      icon: <PlayArrowRoundedIcon fontSize="small" />
    }
  ]

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
    <Stack spacing={3} sx={(theme) => ({ ...sessionPageSx(theme), minWidth: 0, pb: 3 })}>
      <Card component="section" className="session-panel session-panel--header">
        <CardContent sx={panelContentSx}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              justifyContent="space-between"
              spacing={2.5}
              alignItems={{ xs: 'flex-start', lg: 'center' }}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" color="success" label={t('today.session.workspace.liveWorkspace')} />
                  <Chip
                    size="small"
                    color={isSessionLocked ? 'success' : 'default'}
                    label={isSessionLocked ? t('today.session.workspace.locked') : t('today.session.workspace.unlocked')}
                    icon={isSessionLocked ? <LockRoundedIcon /> : <LockOpenRoundedIcon />}
                  />
                </Stack>
                <Stack spacing={0.75}>
                  <Typography className="session-section-kicker">{t('today.session.title')}</Typography>
                  <Typography
                    component="h1"
                    variant="h3"
                    sx={{ fontSize: { xs: 32, md: 42 }, fontWeight: 800, letterSpacing: '-0.04em' }}
                  >
                    {workspace.session.sessionName || t('today.session.workspace.today')}
                  </Typography>
                  <Typography variant="body1" className="session-section-copy">
                    {t('today.session.workspace.dateLine', { date: formatDate(workspace.session.tradingDate, timezone) })}
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateDialogOpen(true)}>
                  {t('today.session.workspace.actions.addSetup')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={isSessionLocked ? <LockOpenRoundedIcon /> : <LockRoundedIcon />}
                  onClick={() => updateSessionMutation.mutate({
                    sessionId: workspace.session.id,
                    data: {
                      ...toSessionPayload(sessionDraft || toSessionDraft(workspace.session)),
                      lockSession: !isSessionLocked
                    },
                    signature: sessionSignatureRef.current
                  })}
                  disabled={updateSessionMutation.isPending}
                >
                  {isSessionLocked ? t('today.session.workspace.actions.unlockSession') : t('today.session.workspace.actions.lockSession')}
                </Button>
                <Button variant="outlined" startIcon={<SchoolRoundedIcon />} onClick={() => setMentorExpanded((value) => !value)}>
                  {mentorExpanded ? t('today.session.workspace.actions.hideMentor') : t('today.session.workspace.actions.openMentor')}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={startExecutionScroll}
                  disabled={!selectedSetup}
                >
                  {t('today.session.workspace.actions.startExecution')}
                </Button>
              </Stack>
            </Stack>

            <Box className="session-metric-grid">
              <SurfaceMetric label={t('today.session.workspace.metrics.maxLoss')} value={formatCurrency(workspace.session.quickStats.maxLoss, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workspace.metrics.riskUsed')} value={formatCurrency(workspace.session.quickStats.riskUsed, baseCurrency)} />
              <SurfaceMetric label={t('today.session.workspace.metrics.trades')} value={workspace.session.quickStats.tradesTaken} />
              <SurfaceMetric label={t('today.session.workspace.metrics.activeSetups')} value={workspace.session.quickStats.activeSetupCount} />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card component="section" className="session-panel session-panel--workflow" aria-labelledby="session-workflow-title">
        <CardContent sx={panelContentSx}>
          <Stack spacing={2.5}>
            <Stack spacing={0.75}>
              <Typography component="h2" id="session-workflow-title" variant="h5" fontWeight={800}>
                {t('today.session.workflowGuide.title')}
              </Typography>
              <Typography variant="body1" className="session-section-copy">
                {t('today.session.workflowGuide.subtitle')}
              </Typography>
            </Stack>
            <Box component="ol" className="session-workflow-list">
              {workflowSteps.map((step, index) => (
                <WorkflowStepCard key={step.title} index={index + 1} {...step} />
              ))}
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
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.72fr) 360px' },
          gap: 3,
          alignItems: 'start'
        }}
      >
        <Stack spacing={3}>
          <Card component="section" className="session-panel">
            <CardContent sx={panelContentSx}>
              <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Stack spacing={0.75}>
                    <Typography className="session-section-kicker">Live chart</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <CandlestickChartRoundedIcon color="primary" />
                      <Typography component="h2" variant="h5" fontWeight={800}>Chart workspace</Typography>
                      {selectedSetup ? <ReadinessChip state={selectedSetup.readiness.state} score={selectedSetup.readiness.score} /> : null}
                    </Stack>
                    <Typography variant="body2" className="session-section-copy">
                      The selected setup anchors symbol, levels, readiness, and execution.
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {autoSaveState}
                  </Typography>
                </Stack>

                <Box className="session-setup-grid">
                  {workspace.setups.map((setup) => (
                    <Card
                      key={setup.id}
                      className={`session-setup-card${selectedSetup?.id === setup.id ? ' is-active' : ''}`}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Stack spacing={1.25}>
                          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                            <Stack spacing={0.25}>
                              <Typography variant="subtitle1" fontWeight={800}>{setup.setupTitle}</Typography>
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
                    className="session-create-tile"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    {t('today.session.workspace.actions.addNewSetup')}
                  </Button>
                </Box>

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

                    <Box className="session-chart-frame" sx={{ position: { lg: 'sticky' }, top: { lg: 72 }, zIndex: 1 }}>
                      {deferredChartSymbol ? (
                        <TradingViewWidget
                          symbol={deferredChartSymbol}
                          interval={deferredChartInterval}
                          minHeight={620}
                          fallbackMessage="The chart could not be embedded here. Open it in TradingView to keep the workspace running."
                        />
                      ) : (
                        <EmptyState
                          sx={{ height: '100%' }}
                          title="Create your first setup to anchor the chart"
                          description="The chart stays empty until a setup defines the live symbol and execution context."
                          icon={<CandlestickChartRoundedIcon fontSize="inherit" />}
                        />
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
                    sx={{ minHeight: 280 }}
                    title="No setup selected"
                    description="Create your first setup to drive the chart, mentor panel, and execution flow."
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

          <Card component="section" className="session-panel">
            <CardContent sx={panelContentSx}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Stack spacing={0.75}>
                    <Typography className="session-section-kicker">Mentor read</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SchoolRoundedIcon color="primary" />
                      <Typography component="h2" variant="h6" fontWeight={800}>Mentor context</Typography>
                    </Stack>
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
                    <Typography variant="body2" className="session-section-copy">
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
            <Card component="section" className="session-panel">
              <CardContent sx={panelContentSx}>
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                    <Stack spacing={0.5}>
                      <Typography className="session-section-kicker">Execution prep</Typography>
                      <Typography component="h2" variant="h6" fontWeight={800}>Selected setup</Typography>
                      <Typography variant="body2" className="session-section-copy">
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
                      <AlertTitle>Execution blockers</AlertTitle>
                      {`Missing: ${selectedSetup.readiness.blockers.join(', ')}`}
                    </Alert>
                  ) : null}

                  <Box className="session-subpanel">
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={800}>Context</Typography>
                        <Chip size="small" color={chipColorForReadiness(selectedSetup.readiness.steps[0]?.state || 'INCOMPLETE')} label={selectedSetup.readiness.steps[0]?.state || 'INCOMPLETE'} />
                      </Stack>
                      <Typography variant="body2" className="session-section-copy">
                        {selectedSetup.readiness.steps[0]?.summary}
                      </Typography>
                      <Box sx={formGridSx}>
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
                  </Box>

                  <Box className="session-subpanel">
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={800}>Trigger</Typography>
                        <Chip size="small" color={chipColorForReadiness(selectedSetup.readiness.steps[1]?.state || 'INCOMPLETE')} label={selectedSetup.readiness.steps[1]?.state || 'INCOMPLETE'} />
                      </Stack>
                      <Typography variant="body2" className="session-section-copy">
                        {selectedSetup.readiness.steps[1]?.summary}
                      </Typography>
                      <Box sx={formGridSx}>
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
                  </Box>

                  <Box id="execution-step" className="session-subpanel">
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={800}>Execution</Typography>
                        <Chip size="small" color={chipColorForReadiness(selectedSetup.readiness.steps[2]?.state || 'INCOMPLETE')} label={selectedSetup.readiness.steps[2]?.state || 'INCOMPLETE'} />
                      </Stack>
                      <Typography variant="body2" className="session-section-copy">
                        {selectedSetup.readiness.steps[2]?.summary}
                      </Typography>
                      <Box sx={formGridSx}>
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
                        <Alert severity="warning">
                          <AlertTitle>Start trade is blocked</AlertTitle>
                          {selectedSetup.readiness.blockers.join(', ')}
                        </Alert>
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
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          <Card component="section" className="session-panel">
            <CardContent sx={panelContentSx}>
              <Stack spacing={2}>
                <Stack spacing={0.75}>
                  <Typography className="session-section-kicker">Review</Typography>
                  <Typography component="h2" variant="h6" fontWeight={800}>Session activity</Typography>
                  <Typography variant="body2" className="session-section-copy">
                    Started trades stay visible here with their linked setup, risk, and live PnL.
                  </Typography>
                </Stack>
                {workspace.activity.length === 0 ? (
                  <EmptyState
                    title="No trades yet"
                    description="Started trades for this session show up here with their linked setup."
                    icon={<FlagRoundedIcon fontSize="inherit" />}
                  />
                ) : (
                  <TableContainer className="session-table-wrap">
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

        <Card component="aside" className="session-panel" sx={{ position: { xl: 'sticky' }, top: { xl: 88 } }}>
          <CardContent sx={panelContentSx}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Stack spacing={0.5}>
                  <Typography component="h2" variant="h6" fontWeight={800}>{t('today.session.workspace.rail.title')}</Typography>
                  <Typography variant="body2" className="session-section-copy">
                    {t('today.session.workspace.rail.subtitle')}
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  color={chipColorForReadiness(workspace.session.readiness.state)}
                  label={`${workspace.session.readiness.score}%`}
                />
              </Stack>

              <Box className="session-rail-block">
                <Stack spacing={1.25}>
                  <Typography className="session-section-kicker">{t('today.session.workspace.lockState.label')}</Typography>
                  <Typography variant="h6" fontWeight={800}>
                    {isSessionLocked ? t('today.session.workspace.lockState.lockedTitle') : t('today.session.workspace.lockState.unlockedTitle')}
                  </Typography>
                  <Typography variant="body2" className="session-section-copy">
                    {isSessionLocked ? t('today.session.workspace.lockState.lockedBody') : t('today.session.workspace.lockState.unlockedBody')}
                  </Typography>
                  <LinearProgress variant="determinate" value={workspace.session.readiness.score} />
                  <Typography variant="caption" color="text.secondary">
                    {workspace.session.readiness.summary}
                  </Typography>
                </Stack>
              </Box>

              <Box className="session-rail-block">
                <Stack spacing={1.5}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" fontWeight={800}>{t('today.session.workspace.rail.setupTitle')}</Typography>
                    <Typography variant="body2" className="session-section-copy">
                      {t('today.session.workspace.rail.setupSubtitle')}
                    </Typography>
                  </Stack>

                  <FormControl fullWidth>
                    <InputLabel id="session-name-label">{t('today.session.lockIn.sessionLabel')}</InputLabel>
                    <Select
                      labelId="session-name-label"
                      label={t('today.session.lockIn.sessionLabel')}
                      value={sessionDraft?.sessionName || ''}
                      onChange={(event) => setSessionDraft((current) => current ? { ...current, sessionName: event.target.value } : current)}
                    >
                      {sessionOptions.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel id="session-objective-label">{t('today.session.workspace.rail.qualityFilter')}</InputLabel>
                    <Select
                      labelId="session-objective-label"
                      label={t('today.session.workspace.rail.qualityFilter')}
                      value={sessionDraft?.objective || ''}
                      onChange={(event) => setSessionDraft((current) => current ? { ...current, objective: event.target.value } : current)}
                    >
                      {objectiveOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel id="session-bias-label">{t('today.session.lockIn.biasLabel')}</InputLabel>
                    <Select
                      labelId="session-bias-label"
                      label={t('today.session.lockIn.biasLabel')}
                      value={sessionDraft?.bias || ''}
                      onChange={(event) => setSessionDraft((current) => current ? { ...current, bias: event.target.value } : current)}
                    >
                      <MenuItem value="LONG">Long</MenuItem>
                      <MenuItem value="SHORT">Short</MenuItem>
                      <MenuItem value="NEUTRAL">{t('today.session.lockIn.neutral')}</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    label={t('today.session.lockIn.biasReason')}
                    value={sessionDraft?.biasReason || ''}
                    onChange={(event) => setSessionDraft((current) => current ? { ...current, biasReason: event.target.value } : current)}
                    fullWidth
                    multiline
                    minRows={2}
                  />

                  <TextField
                    label={t('today.session.lockIn.dailyMaxLoss')}
                    type="number"
                    inputProps={{ step: '0.01' }}
                    value={sessionDraft?.dailyMaxLoss ?? ''}
                    onChange={(event) => setSessionDraft((current) => current ? { ...current, dailyMaxLoss: parseNumberInput(event.target.value) } : current)}
                    fullWidth
                  />

                  <TextField
                    label={t('today.session.lockIn.maxTrades')}
                    type="number"
                    value={sessionDraft?.maxTrades ?? ''}
                    onChange={(event) => setSessionDraft((current) => current ? { ...current, maxTrades: parseNumberInput(event.target.value) } : current)}
                    fullWidth
                  />

                  <TextField
                    label={t('today.session.workspace.rail.sessionNarrative')}
                    value={sessionDraft?.narrative || ''}
                    onChange={(event) => setSessionDraft((current) => current ? { ...current, narrative: event.target.value } : current)}
                    fullWidth
                    multiline
                    minRows={4}
                  />

                  <Button
                    variant="contained"
                    startIcon={isSessionLocked ? <LockOpenRoundedIcon /> : <LockRoundedIcon />}
                    onClick={() => updateSessionMutation.mutate({
                      sessionId: workspace.session.id,
                      data: {
                        ...toSessionPayload(sessionDraft || toSessionDraft(workspace.session)),
                        lockSession: !isSessionLocked
                      },
                      signature: sessionSignatureRef.current
                    })}
                  >
                    {isSessionLocked ? t('today.session.workspace.actions.unlockSession') : t('today.session.workspace.actions.lockSession')}
                  </Button>
                </Stack>
              </Box>

              <Box className="session-rail-block">
                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" fontWeight={800}>{t('today.session.workspace.rail.prerequisites')}</Typography>
                  {workspace.session.readiness.steps.map((step) => (
                    <Box key={step.key} className="session-rail-list-item">
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                        <Typography variant="body2" fontWeight={700}>{step.label}</Typography>
                        <Chip size="small" color={chipColorForReadiness(step.state)} label={step.state.toLowerCase()} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{step.summary}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Box className="session-rail-block">
                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" fontWeight={800}>{t('today.session.workspace.rail.warnings')}</Typography>
                  {workspace.session.warnings.length ? workspace.session.warnings.map((warning) => (
                    <Alert key={warning} severity="warning" icon={<WarningAmberRoundedIcon />}>
                      <AlertTitle>Action required</AlertTitle>
                      {warning}
                    </Alert>
                  )) : (
                    <Alert severity="success">{t('today.session.workspace.rail.noWarnings')}</Alert>
                  )}
                </Stack>
              </Box>

              <Box className="session-rail-block">
                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" fontWeight={800}>{t('today.session.workspace.rail.liveMetrics')}</Typography>
                  <Box
                    className="session-metric-grid"
                    sx={{ gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' } }}
                  >
                    <SurfaceMetric label={t('today.session.workspace.metrics.trades')} value={workspace.session.quickStats.tradesTaken} />
                    <SurfaceMetric label={t('today.session.workspace.metrics.activeSetups')} value={workspace.session.quickStats.activeSetupCount} />
                    <SurfaceMetric label={t('today.session.workspace.metrics.realizedPnl')} value={formatSignedCurrency(workspace.session.quickStats.realizedPnl, baseCurrency)} />
                    <SurfaceMetric label={t('today.session.workspace.metrics.riskUsed')} value={formatCurrency(workspace.session.quickStats.riskUsed, baseCurrency)} />
                  </Box>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: '12px',
            border: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
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
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
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

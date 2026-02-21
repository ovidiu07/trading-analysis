import { ClipboardEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
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
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded'
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded'
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import PhotoCameraBackRoundedIcon from '@mui/icons-material/PhotoCameraBackRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import MarkdownContent from '../components/ui/MarkdownContent'
import RichTextContent from '../components/ui/RichTextContent'
import SecureAssetImage from '../components/assets/SecureAssetImage'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import {
  closeTradeFromSession,
  getTodaySession,
  saveTodaySessionConfig,
  saveTradeEntryJournal,
  startTradeFromSession,
  updateTodaySessionPlannedTickers,
  type TodaySessionResponse
} from '../api/session'
import { uploadAsset, type AssetItem } from '../api/assets'
import { listDailyPlans, type DailyPlan } from '../api/plans'
import { listStrategies } from '../api/strategies'
import { fetchFxRate } from '../api/fx'
import { FEELING_OPTIONS, RULE_BREAK_OPTIONS } from '../constants/tradeTaxonomy'
import { formatCurrency, formatNumber, formatSignedCurrency } from '../utils/format'

const SELECTED_PLAN_STORAGE_KEY = 'today.session.selectedPlanId'
const SESSION_CHART_SYMBOL_KEY = 'sessionMode.chartSymbol'
const SESSION_CHART_INTERVAL_KEY = 'sessionMode.chartInterval'
const RR_THRESHOLD = 1.5

const LOCK_IN_SESSION_OPTIONS = [
  { value: 'LONDON', label: 'London' },
  { value: 'NY_AM', label: 'NY AM' }
] as const

type LockInSession = (typeof LOCK_IN_SESSION_OPTIONS)[number]['value']
type LockInBias = 'LONG' | 'SHORT' | 'NEUTRAL' | ''
type LockInObjective = 'A_PLUS_ONLY' | 'ONE_TRADE_MAX' | 'TWO_TRADES_MAX' | ''

type LockInState = {
  session: LockInSession | ''
  dailyMaxLoss: string
  maxTrades: string
  objective: LockInObjective
  bias: LockInBias
  biasReason: string
}

type PrerequisitesState = {
  newsChecked: boolean
  redNewsWindow: string
  keyLevelsMarked: boolean
  keyLevelsNotes: string
}

type TriggerState = {
  sweepLevel: string
  sweepConfirmed: boolean
  displacementConfirmed: boolean
  mssConfirmed: boolean
  entryZoneConfirmed: boolean
}

type StrategyOption = {
  id: string
  source: 'MY' | 'MENTOR'
  name: string
  model: string
  entryConditionsRich?: string | null
  entryConditions: string[]
  invalidationLogic: string
  tpFramework: string
  noTradeRules?: string | null
  sessionSuitability: string[]
  tags: string[]
  snapshotAssetId?: string | null
  snapshotAsset?: {
    id: string
    originalFileName: string
    url?: string | null
    viewUrl?: string | null
  } | null
}

type SessionPanelId = 'progress' | 'checklist' | 'chart' | 'mentor' | 'planner'
type LayoutPreset = 'default' | 'execution' | 'study'

type SessionLayoutState = {
  collapsed: Record<SessionPanelId, boolean>
  maximized: SessionPanelId | null
  preset: LayoutPreset
}

const DEFAULT_LAYOUT_STATE: SessionLayoutState = {
  collapsed: {
    progress: false,
    checklist: false,
    chart: false,
    mentor: false,
    planner: false
  },
  maximized: null,
  preset: 'default'
}

const DEFAULT_LOCK_IN_STATE: LockInState = {
  session: '',
  dailyMaxLoss: '',
  maxTrades: '',
  objective: '',
  bias: '',
  biasReason: ''
}

const DEFAULT_PREREQS: PrerequisitesState = {
  newsChecked: false,
  redNewsWindow: '',
  keyLevelsMarked: false,
  keyLevelsNotes: ''
}

const DEFAULT_TRIGGERS: TriggerState = {
  sweepLevel: '',
  sweepConfirmed: false,
  displacementConfirmed: false,
  mssConfirmed: false,
  entryZoneConfirmed: false
}

const toBullets = (value?: string | null) => {
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s*/, ''))
    .filter(Boolean)
}

const toTimestamp = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

const isPlanEligibleNow = (plan: DailyPlan, nowTs: number) => {
  const visibleFrom = toTimestamp(plan.visibleFrom)
  const visibleUntil = toTimestamp(plan.visibleUntil)
  if (visibleFrom !== null && visibleFrom > nowTs) {
    return false
  }
  if (visibleUntil !== null && nowTs > visibleUntil) {
    return false
  }
  return true
}

const sortPlansForSession = (plans: DailyPlan[]) => {
  return [...plans].sort((a, b) => {
    const aVisibleFrom = toTimestamp(a.visibleFrom) ?? 0
    const bVisibleFrom = toTimestamp(b.visibleFrom) ?? 0
    if (aVisibleFrom !== bVisibleFrom) {
      return bVisibleFrom - aVisibleFrom
    }
    const aUpdatedAt = toTimestamp(a.updatedAt) ?? 0
    const bUpdatedAt = toTimestamp(b.updatedAt) ?? 0
    return bUpdatedAt - aUpdatedAt
  })
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toSessionProgress = (session: TodaySessionResponse) => {
  const pnlFloor = -Math.abs(session.lossLimit || 0)
  const pnlCeiling = Math.abs(session.profitTarget || 0)
  const range = pnlCeiling - pnlFloor
  const pnlValue = session.realizedPnl || 0
  const pnlProgress = range <= 0 ? 0 : clamp(((pnlValue - pnlFloor) / range) * 100, 0, 100)
  const tradeProgress = session.maxTrades <= 0 ? 0 : clamp((session.closedTradesCount / session.maxTrades) * 100, 0, 100)
  return { pnlProgress, tradeProgress }
}

const buildLayoutStorageKey = (userId?: string | null) => `sessionMode.layoutState.${userId || 'anon'}`

const readSessionLayoutState = (storageKey: string): SessionLayoutState => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return DEFAULT_LAYOUT_STATE
    const parsed = JSON.parse(raw) as Partial<SessionLayoutState>
    return {
      collapsed: {
        progress: Boolean(parsed.collapsed?.progress),
        checklist: Boolean(parsed.collapsed?.checklist),
        chart: Boolean(parsed.collapsed?.chart),
        mentor: Boolean(parsed.collapsed?.mentor),
        planner: Boolean(parsed.collapsed?.planner)
      },
      maximized: parsed.maximized ?? null,
      preset: parsed.preset ?? 'default'
    }
  } catch {
    return DEFAULT_LAYOUT_STATE
  }
}

const normalizeLevel = (value: string) => value.trim().toUpperCase()

export default function SessionPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const baseCurrency = user?.baseCurrency || 'USD'

  const isCompactViewport = useMediaQuery('(max-width:900px)')
  const isMobileViewport = useMediaQuery('(max-width:600px)')
  const isTinyViewport = useMediaQuery('(max-width:480px)')

  const layoutStorageKey = useMemo(() => buildLayoutStorageKey(user?.id), [user?.id])

  const [config, setConfig] = useState({
    profitTarget: '',
    lossLimit: '',
    maxTrades: ''
  })

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [tickerDraft, setTickerDraft] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState(() => localStorage.getItem(SELECTED_PLAN_STORAGE_KEY) || '')

  const [planner, setPlanner] = useState({
    symbol: '',
    direction: 'LONG' as 'LONG' | 'SHORT',
    quantity: '1',
    session: 'LONDON' as 'ASIA' | 'LONDON' | 'NY_AM' | 'NY_PM',
    strategyKey: '',
    tradeCurrency: baseCurrency,
    fxRateTradeToProfile: '',
    fxRateSource: 'MANUAL',
    riskAmount: '',
    entryPrice: '',
    stopLossPrice: '',
    takeProfitPrice: '',
    invalidation: '',
    notes: '',
    feeling: FEELING_OPTIONS[0] as string,
    setupGrade: 'A' as 'A' | 'B' | 'C'
  })

  const [lockIn, setLockIn] = useState<LockInState>(DEFAULT_LOCK_IN_STATE)
  const [prereqs, setPrereqs] = useState<PrerequisitesState>(DEFAULT_PREREQS)
  const [triggers, setTriggers] = useState<TriggerState>(DEFAULT_TRIGGERS)
  const [decisionLevels, setDecisionLevels] = useState<string[]>(['PDH', 'PDL', 'ASIA H', 'ASIA L', 'EQH', 'EQL'])
  const [decisionLevelDraft, setDecisionLevelDraft] = useState('')

  const [closeFormOpen, setCloseFormOpen] = useState(false)
  const [closeDraft, setCloseDraft] = useState({
    exitPrice: '',
    ruleBreaks: [] as string[],
    postTradeNotes: ''
  })

  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [mentorPlanUpdatedNotice, setMentorPlanUpdatedNotice] = useState(false)
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const [mentorFullView, setMentorFullView] = useState(false)
  const [fxAutoFillLoading, setFxAutoFillLoading] = useState(false)
  const [layoutState, setLayoutState] = useState<SessionLayoutState>(DEFAULT_LAYOUT_STATE)
  const [chartSymbolMemory, setChartSymbolMemory] = useState(() => localStorage.getItem(SESSION_CHART_SYMBOL_KEY) || '')
  const [chartIntervalMemory, setChartIntervalMemory] = useState(() => localStorage.getItem(SESSION_CHART_INTERVAL_KEY) || '15')

  const [missingModalOpen, setMissingModalOpen] = useState(false)
  const [screenshotDialogOpen, setScreenshotDialogOpen] = useState(false)
  const [attachedScreenshots, setAttachedScreenshots] = useState<AssetItem[]>([])
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)

  const [entryJournalOpen, setEntryJournalOpen] = useState(false)
  const [entryJournalTradeId, setEntryJournalTradeId] = useState<string | null>(null)
  const [entryJournalDraft, setEntryJournalDraft] = useState({
    text: '',
    invalidation: '',
    emotion: FEELING_OPTIONS[0] ?? 'Focused'
  })

  const [localNow, setLocalNow] = useState(() => new Date())

  const invalidationFieldRef = useRef<HTMLInputElement | null>(null)
  const mentorPanelRef = useRef<HTMLDivElement | null>(null)

  const sessionQuery = useQuery({
    queryKey: ['todaySession'],
    queryFn: () => getTodaySession(),
    refetchOnWindowFocus: true
  })

  const dailyPlansQuery = useQuery({
    queryKey: ['dailyPlans', 60],
    queryFn: () => listDailyPlans({ recentDays: 60 }),
    refetchOnWindowFocus: true
  })

  const strategiesQuery = useQuery({
    queryKey: ['strategies', false],
    queryFn: () => listStrategies({ includeArchived: false })
  })

  const session = sessionQuery.data || null

  useEffect(() => {
    setLayoutState(readSessionLayoutState(layoutStorageKey))
  }, [layoutStorageKey])

  useEffect(() => {
    localStorage.setItem(layoutStorageKey, JSON.stringify(layoutState))
  }, [layoutState, layoutStorageKey])

  useEffect(() => {
    const timer = window.setInterval(() => setLocalNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!session) return
    if (!planner.symbol && (session.plannedTickers || []).length > 0) {
      setPlanner((prev) => ({ ...prev, symbol: session.plannedTickers[0] }))
    }
  }, [planner.symbol, session])

  useEffect(() => {
    if (selectedPlanId) {
      localStorage.setItem(SELECTED_PLAN_STORAGE_KEY, selectedPlanId)
      return
    }
    localStorage.removeItem(SELECTED_PLAN_STORAGE_KEY)
  }, [selectedPlanId])

  useEffect(() => {
    if (!chartSymbolMemory) {
      localStorage.removeItem(SESSION_CHART_SYMBOL_KEY)
      return
    }
    localStorage.setItem(SESSION_CHART_SYMBOL_KEY, chartSymbolMemory)
  }, [chartSymbolMemory])

  useEffect(() => {
    if (!chartIntervalMemory) {
      localStorage.removeItem(SESSION_CHART_INTERVAL_KEY)
      return
    }
    localStorage.setItem(SESSION_CHART_INTERVAL_KEY, chartIntervalMemory)
  }, [chartIntervalMemory])

  useEffect(() => {
    setPlanner((prev) => prev.tradeCurrency
      ? prev
      : {
          ...prev,
          tradeCurrency: baseCurrency
        })
  }, [baseCurrency])

  useEffect(() => {
    if (!session) return
    const sessionDate = session.sessionDate || new Date().toISOString().slice(0, 10)
    const key = `sessionMode.lockIn.${user?.id || 'anon'}.${sessionDate}`
    const defaults: LockInState = {
      ...DEFAULT_LOCK_IN_STATE,
      session: 'LONDON',
      dailyMaxLoss: session.lossLimit > 0 ? String(session.lossLimit) : '',
      maxTrades: session.maxTrades > 0 ? String(session.maxTrades) : ''
    }
    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        setLockIn(defaults)
        return
      }
      const parsed = JSON.parse(raw) as Partial<LockInState>
      setLockIn({
        ...defaults,
        ...parsed,
        biasReason: (parsed.biasReason || '').slice(0, 140)
      })
    } catch {
      setLockIn(defaults)
    }
  }, [session, user?.id])

  useEffect(() => {
    if (!session) return
    const sessionDate = session.sessionDate || new Date().toISOString().slice(0, 10)
    const key = `sessionMode.lockIn.${user?.id || 'anon'}.${sessionDate}`
    localStorage.setItem(key, JSON.stringify(lockIn))
  }, [lockIn, session, user?.id])

  const saveConfigMutation = useMutation({
    mutationFn: saveTodaySessionConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const patchTickersMutation = useMutation({
    mutationFn: updateTodaySessionPlannedTickers,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const startTradeMutation = useMutation({
    mutationFn: startTradeFromSession,
    onSuccess: async (trade) => {
      setApiError('')
      setCloseFormOpen(false)
      setCloseDraft({ exitPrice: '', ruleBreaks: [], postTradeNotes: '' })
      setEntryJournalTradeId(trade.id)
      setEntryJournalDraft({
        text: planner.notes.trim() || 'Entry rationale captured at start.',
        invalidation: planner.invalidation.trim(),
        emotion: planner.feeling
      })
      setEntryJournalOpen(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todaySession'] }),
        queryClient.invalidateQueries({ queryKey: ['recentTrades'] }),
        queryClient.invalidateQueries({ queryKey: ['trades'] })
      ])
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('today.session.errors.startTrade'))
    }
  })

  const saveEntryJournalMutation = useMutation({
    mutationFn: ({ tradeId, payload }: { tradeId: string; payload: { entryJournalText: string; entryInvalidation: string; feeling: string; entryScreenshotAssetIds: string[] } }) =>
      saveTradeEntryJournal(tradeId, payload),
    onSuccess: async () => {
      setEntryJournalOpen(false)
      setSuccessMessage('Entry journal saved.')
      await queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || 'Could not save entry journal.')
    }
  })

  const closeTradeMutation = useMutation({
    mutationFn: ({ tradeId, payload }: { tradeId: string; payload: { exitPrice: number; ruleBreaks: string[]; postTradeNotes: string } }) =>
      closeTradeFromSession(tradeId, payload),
    onSuccess: async () => {
      setApiError('')
      setCloseFormOpen(false)
      setCloseDraft({ exitPrice: '', ruleBreaks: [], postTradeNotes: '' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todaySession'] }),
        queryClient.invalidateQueries({ queryKey: ['recentTrades'] }),
        queryClient.invalidateQueries({ queryKey: ['trades'] })
      ])
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('today.session.errors.closeTrade'))
    }
  })

  const plans = dailyPlansQuery.data || []

  const eligiblePlans = useMemo(() => {
    const nowTs = Date.now()
    return sortPlansForSession(plans.filter((plan) => isPlanEligibleNow(plan, nowTs)))
  }, [plans])

  useEffect(() => {
    if (dailyPlansQuery.isLoading) {
      return
    }

    if (!eligiblePlans.length) {
      if (selectedPlanId) {
        setSelectedPlanId('')
      }
      return
    }

    if (!selectedPlanId) {
      setSelectedPlanId(eligiblePlans[0].id)
      return
    }

    if (eligiblePlans.some((plan) => plan.id === selectedPlanId)) {
      return
    }

    setSelectedPlanId(eligiblePlans[0].id)
    setMentorPlanUpdatedNotice(true)
  }, [dailyPlansQuery.isLoading, eligiblePlans, selectedPlanId])

  const selectedPlan = eligiblePlans.find((item) => item.id === selectedPlanId) || eligiblePlans[0] || null

  useEffect(() => {
    if (!selectedPlan?.keyLevels?.length) return
    setDecisionLevels((prev) => {
      if (prev.length > 0 && prev.join('|') !== 'PDH|PDL|ASIA H|ASIA L|EQH|EQL') {
        return prev
      }
      return selectedPlan.keyLevels as string[]
    })
  }, [selectedPlan?.keyLevels])

  const selectedPlanExecutionBullets = useMemo(
    () => toBullets(selectedPlan?.executionRules),
    [selectedPlan?.executionRules]
  )

  const selectedPlanHasAdvanced = Boolean(
    selectedPlan?.primaryModel ||
    selectedPlan?.liquidityNarrative ||
    selectedPlan?.alternativeScenario ||
    selectedPlan?.context ||
    selectedPlan?.body
  )

  const selectedPlanSnapshotUrl = selectedPlan?.snapshotAsset?.viewUrl || selectedPlan?.snapshotAsset?.url || ''

  const strategyOptions = useMemo<StrategyOption[]>(() => {
    const grouped = strategiesQuery.data
    if (!grouped) return []
    const my = (grouped.myStrategies || []).filter((item) => !item.archived)
    const mentor = grouped.mentorStrategies || []
    return [
      ...my.map((item) => ({ ...item, source: 'MY' as const })),
      ...mentor.map((item) => ({ ...item, source: 'MENTOR' as const }))
    ]
  }, [strategiesQuery.data])

  const strategyByKey = useMemo(() => {
    const map = new Map<string, StrategyOption>()
    strategyOptions.forEach((item) => {
      map.set(`${item.source}:${item.id}`, item)
    })
    return map
  }, [strategyOptions])

  const selectedStrategy = planner.strategyKey ? strategyByKey.get(planner.strategyKey) : undefined
  const strategyInvalidationBullets = useMemo(
    () => toBullets(selectedStrategy?.invalidationLogic),
    [selectedStrategy?.invalidationLogic]
  )

  const strategyManagementBullets = useMemo(
    () => toBullets(selectedStrategy?.tpFramework),
    [selectedStrategy?.tpFramework]
  )

  const strategyNoTradeBullets = useMemo(
    () => toBullets(selectedStrategy?.noTradeRules),
    [selectedStrategy?.noTradeRules]
  )

  const selectedStrategySnapshotUrl = selectedStrategy?.snapshotAsset?.viewUrl || selectedStrategy?.snapshotAsset?.url || ''

  useEffect(() => {
    setTriggers(DEFAULT_TRIGGERS)
  }, [planner.strategyKey])

  const progress = session ? toSessionProgress(session) : { pnlProgress: 0, tradeProgress: 0 }

  const profileCurrency = (baseCurrency || 'USD').trim().toUpperCase()
  const tradeCurrency = (planner.tradeCurrency || profileCurrency).trim().toUpperCase()
  const isCrossCurrency = tradeCurrency !== profileCurrency

  const fxRateForProfile = isCrossCurrency
    ? (() => {
        const parsed = Number(planner.fxRateTradeToProfile)
        if (!Number.isFinite(parsed) || parsed <= 0) return null
        return parsed
      })()
    : 1

  const chartSymbol = (selectedPlan?.tradingViewSymbol
    || (planner.symbol.trim() ? planner.symbol.trim().toUpperCase() : '')
    || chartSymbolMemory
    || 'TVC:DXY')
  const chartInterval = selectedPlan?.tradingViewInterval || chartIntervalMemory || '15'
  const chartAllowSymbolChange = selectedPlan?.tradingViewAllowSymbolChange ?? true
  const chartTheme = selectedPlan?.tradingViewTheme || 'SYSTEM'
  const chartHideControls = selectedPlan?.tradingViewHideControls ?? false

  useEffect(() => {
    if (chartSymbol) {
      setChartSymbolMemory(chartSymbol)
    }
    if (chartInterval) {
      setChartIntervalMemory(chartInterval)
    }
  }, [chartInterval, chartSymbol])

  const riskSnapshot = useMemo(() => {
    const quantity = Number(planner.quantity)
    const entryPrice = Number(planner.entryPrice)
    const stopLossPrice = Number(planner.stopLossPrice)
    const takeProfitPrice = Number(planner.takeProfitPrice)

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { riskAmount: null, rEstimate: null }
    }

    if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(stopLossPrice) || stopLossPrice <= 0) {
      return { riskAmount: null, rEstimate: null }
    }

    const riskPerUnit = Math.abs(entryPrice - stopLossPrice)
    if (riskPerUnit <= 0) {
      return { riskAmount: null, rEstimate: null }
    }

    const riskAmount = riskPerUnit * quantity

    if (!Number.isFinite(takeProfitPrice) || takeProfitPrice <= 0) {
      return { riskAmount, rEstimate: null }
    }

    const rewardPerUnit = planner.direction === 'LONG'
      ? takeProfitPrice - entryPrice
      : entryPrice - takeProfitPrice

    const rEstimate = rewardPerUnit > 0 ? rewardPerUnit / riskPerUnit : null

    return { riskAmount, rEstimate }
  }, [planner.direction, planner.entryPrice, planner.quantity, planner.stopLossPrice, planner.takeProfitPrice])

  const convertedRiskSnapshot = useMemo(() => {
    if (!riskSnapshot.riskAmount || !fxRateForProfile) {
      return null
    }
    return riskSnapshot.riskAmount * fxRateForProfile
  }, [fxRateForProfile, riskSnapshot.riskAmount])

  const manualRisk = useMemo(() => {
    const parsed = Number(planner.riskAmount)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [planner.riskAmount])

  const effectiveRiskInProfile = manualRisk ?? convertedRiskSnapshot ?? riskSnapshot.riskAmount

  const lockInComplete = useMemo(() => {
    const dailyMaxLoss = Number(lockIn.dailyMaxLoss)
    const maxTrades = Number(lockIn.maxTrades)
    return Boolean(
      lockIn.session
      && Number.isFinite(dailyMaxLoss)
      && dailyMaxLoss > 0
      && Number.isFinite(maxTrades)
      && maxTrades > 0
      && lockIn.bias
      && lockIn.biasReason.trim().length > 0
    )
  }, [lockIn])

  const invalidationWritten = planner.invalidation.trim().length > 0
  const rrMet = (riskSnapshot.rEstimate ?? 0) >= RR_THRESHOLD
  const newsSafe = prereqs.newsChecked && prereqs.redNewsWindow.trim().length === 0

  const prerequisiteChecks = {
    news: prereqs.newsChecked,
    keyLevels: prereqs.keyLevelsMarked,
    riskConfirmed: lockInComplete,
    invalidation: invalidationWritten
  }

  const prerequisiteCount = Object.values(prerequisiteChecks).filter(Boolean).length
  const prerequisitesComplete = prerequisiteCount === 4

  const triggerChecks = {
    sweep: triggers.sweepConfirmed && Boolean(triggers.sweepLevel),
    displacement: triggers.displacementConfirmed,
    mss: triggers.mssConfirmed,
    entryZone: triggers.entryZoneConfirmed,
    rr: rrMet
  }

  const triggerCount = Object.values(triggerChecks).filter(Boolean).length
  const triggersComplete = triggerCount === 5

  const setupQualityChecks = [lockInComplete, prerequisitesComplete, triggersComplete, rrMet, newsSafe]
  const setupQualityScore = Math.round((setupQualityChecks.filter(Boolean).length / setupQualityChecks.length) * 100)
  const suggestedSetupGrade = setupQualityScore >= 95 ? 'A+' : (setupQualityScore >= 75 ? 'A' : 'B')

  const canMeetExecutionGate = lockInComplete && prerequisitesComplete && triggersComplete && invalidationWritten
  const canSessionTrade = Boolean(session && session.status === 'ACTIVE' && !session.activeTrade)
  const canStartTrade = canSessionTrade && canMeetExecutionGate
  const canScheduleTrade = canSessionTrade && canMeetExecutionGate

  const missingLockInItems = [
    !lockIn.session ? 'Session selection' : null,
    !lockIn.dailyMaxLoss || Number(lockIn.dailyMaxLoss) <= 0 ? 'Daily max loss' : null,
    !lockIn.maxTrades || Number(lockIn.maxTrades) <= 0 ? 'Max trades' : null,
    !lockIn.bias ? 'Bias' : null,
    !lockIn.biasReason.trim() ? 'Bias reason' : null
  ].filter(Boolean) as string[]

  const missingPrereqs = [
    !prerequisiteChecks.news ? 'News check done' : null,
    !prerequisiteChecks.keyLevels ? 'Key levels marked' : null,
    !prerequisiteChecks.riskConfirmed ? 'Risk & max trades confirmed' : null,
    !prerequisiteChecks.invalidation ? 'Invalidation written' : null
  ].filter(Boolean) as string[]

  const missingTriggers = [
    !triggerChecks.sweep ? 'Liquidity sweep confirmed' : null,
    !triggerChecks.displacement ? 'Displacement close confirmed' : null,
    !triggerChecks.mss ? 'MSS confirmed' : null,
    !triggerChecks.entryZone ? 'Entry zone identified' : null,
    !triggerChecks.rr ? `RR >= ${RR_THRESHOLD.toFixed(1)}R` : null
  ].filter(Boolean) as string[]

  const mentorInvalidation = useMemo(() => {
    const fromRiskNote = selectedPlan?.riskNote?.trim()
    if (fromRiskNote) return fromRiskNote
    if (strategyInvalidationBullets.length > 0) return strategyInvalidationBullets[0]
    return ''
  }, [selectedPlan?.riskNote, strategyInvalidationBullets])

  const flowStep = useMemo(() => {
    if (!lockInComplete) return 1
    if (!prerequisitesComplete || !triggersComplete) return 2
    if (!planner.entryPrice || !planner.stopLossPrice) return 3
    return 4
  }, [lockInComplete, planner.entryPrice, planner.stopLossPrice, prerequisitesComplete, triggersComplete])

  const isPanelVisible = (panelId: SessionPanelId) => !layoutState.maximized || layoutState.maximized === panelId
  const isPanelCollapsed = (panelId: SessionPanelId) => layoutState.collapsed[panelId]

  const togglePanelCollapsed = (panelId: SessionPanelId) => {
    setLayoutState((prev) => ({
      ...prev,
      collapsed: {
        ...prev.collapsed,
        [panelId]: !prev.collapsed[panelId]
      }
    }))
  }

  const togglePanelMaximized = (panelId: SessionPanelId) => {
    setLayoutState((prev) => ({
      ...prev,
      maximized: prev.maximized === panelId ? null : panelId
    }))
  }

  const applyPreset = (preset: LayoutPreset) => {
    if (preset === 'execution') {
      setLayoutState((prev) => ({
        ...prev,
        preset,
        maximized: null,
        collapsed: {
          ...prev.collapsed,
          chart: false,
          planner: false,
          mentor: true
        }
      }))
      return
    }
    if (preset === 'study') {
      setLayoutState((prev) => ({
        ...prev,
        preset,
        maximized: null,
        collapsed: {
          ...prev.collapsed,
          chart: false,
          planner: true,
          mentor: false
        }
      }))
      return
    }
    setLayoutState((prev) => ({
      ...prev,
      preset,
      maximized: null,
      collapsed: {
        progress: false,
        checklist: false,
        chart: false,
        mentor: false,
        planner: false
      }
    }))
  }

  const renderPanelControls = (panelId: SessionPanelId) => (
    <Stack direction="row" spacing={0.5}>
      <Tooltip title={isPanelCollapsed(panelId) ? t('today.session.layout.expand') : t('today.session.layout.collapse')}>
        <IconButton
          size="small"
          onClick={() => togglePanelCollapsed(panelId)}
          aria-expanded={!isPanelCollapsed(panelId)}
          aria-label={isPanelCollapsed(panelId) ? t('today.session.layout.expand') : t('today.session.layout.collapse')}
        >
          {isPanelCollapsed(panelId) ? <UnfoldMoreRoundedIcon fontSize="small" /> : <UnfoldLessRoundedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Tooltip title={layoutState.maximized === panelId ? t('today.session.layout.restore') : t('today.session.layout.maximize')}>
        <IconButton
          size="small"
          onClick={() => togglePanelMaximized(panelId)}
          aria-label={layoutState.maximized === panelId ? t('today.session.layout.restore') : t('today.session.layout.maximize')}
        >
          {layoutState.maximized === panelId ? <CloseFullscreenRoundedIcon fontSize="small" /> : <OpenInFullRoundedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Stack>
  )

  const handleSaveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError('')

    const payload = {
      profitTarget: Number(config.profitTarget),
      lossLimit: Number(config.lossLimit),
      maxTrades: Number(config.maxTrades)
    }

    if (!Number.isFinite(payload.profitTarget) || payload.profitTarget < 0) {
      setApiError(t('today.session.errors.profitTargetRequired'))
      return
    }
    if (!Number.isFinite(payload.lossLimit) || payload.lossLimit < 0) {
      setApiError(t('today.session.errors.lossLimitRequired'))
      return
    }
    if (!Number.isFinite(payload.maxTrades) || payload.maxTrades <= 0) {
      setApiError(t('today.session.errors.maxTradesRequired'))
      return
    }

    await saveConfigMutation.mutateAsync(payload)
  }

  const handleAutoFillFxRate = async () => {
    if (!isCrossCurrency) {
      setPlanner((prev) => ({
        ...prev,
        fxRateTradeToProfile: '1',
        fxRateSource: 'IDENTITY'
      }))
      return
    }
    setFxAutoFillLoading(true)
    try {
      const result = await fetchFxRate(tradeCurrency, profileCurrency)
      setPlanner((prev) => ({
        ...prev,
        fxRateTradeToProfile: String(result.rate),
        fxRateSource: result.source || 'AUTO'
      }))
      setApiError('')
    } catch (error) {
      setApiError((error as Error)?.message || t('today.session.errors.fxAutofillFailed'))
    } finally {
      setFxAutoFillLoading(false)
    }
  }

  const handleAddTicker = async () => {
    if (!session) return
    const ticker = tickerDraft.trim().toUpperCase()
    if (!ticker) return
    const nextTickers = Array.from(new Set([...(session.plannedTickers || []), ticker]))
    setTickerDraft('')
    setScheduleOpen(false)
    await patchTickersMutation.mutateAsync(nextTickers)
  }

  const handleRemoveTicker = async (ticker: string) => {
    if (!session) return
    const nextTickers = (session.plannedTickers || []).filter((item) => item !== ticker)
    await patchTickersMutation.mutateAsync(nextTickers)
  }

  const uploadScreenshotFiles = async (files: File[]) => {
    const candidates = files.filter((file) => file.type.startsWith('image/'))
    if (!candidates.length) {
      setApiError('Please select or paste PNG/JPG image files only.')
      return
    }

    setUploadingScreenshot(true)
    try {
      const uploaded = await Promise.all(
        candidates.map((file) => uploadAsset({
          file,
          scope: 'TRADE',
          tradeId: entryJournalTradeId || undefined
        }))
      )
      setAttachedScreenshots((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]))
        uploaded.forEach((item) => map.set(item.id, item))
        return Array.from(map.values())
      })
      setApiError('')
    } catch (error) {
      setApiError((error as Error)?.message || 'Could not upload screenshot.')
    } finally {
      setUploadingScreenshot(false)
    }
  }

  const handlePasteScreenshots = async (event: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.clipboardData.items || [])
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[]

    if (!items.length) return
    event.preventDefault()
    await uploadScreenshotFiles(items)
  }

  const handleAddDecisionLevel = () => {
    const normalized = normalizeLevel(decisionLevelDraft)
    if (!normalized) return
    setDecisionLevels((prev) => prev.includes(normalized) ? prev : [...prev, normalized])
    setDecisionLevelDraft('')
  }

  const handleStartTrade = async () => {
    if (!session) return

    if (!canMeetExecutionGate) {
      setMissingModalOpen(true)
      return
    }

    if (!planner.symbol.trim()) {
      setApiError(t('today.session.errors.tickerRequired'))
      return
    }

    const quantity = Number(planner.quantity)
    const entryPrice = Number(planner.entryPrice)
    const stopLossPrice = Number(planner.stopLossPrice)

    if (
      !Number.isFinite(quantity)
      || quantity <= 0
      || !Number.isFinite(entryPrice)
      || entryPrice <= 0
      || !Number.isFinite(stopLossPrice)
      || stopLossPrice <= 0
    ) {
      setApiError('Quantity, entry price, and stop-loss are required.')
      return
    }

    if (isCrossCurrency && !fxRateForProfile) {
      setApiError(t('today.session.errors.fxRateRequired'))
      return
    }

    if (!planner.invalidation.trim()) {
      setApiError('Invalidation is required before start.')
      invalidationFieldRef.current?.focus()
      return
    }

    const payload = {
      symbol: planner.symbol.trim().toUpperCase(),
      direction: planner.direction,
      quantity,
      entryPrice,
      takeProfitPrice: planner.takeProfitPrice ? Number(planner.takeProfitPrice) : null,
      stopLossPrice,
      tradeCurrency,
      fxRateTradeToProfile: fxRateForProfile ?? undefined,
      fxRateSource: isCrossCurrency ? (planner.fxRateSource || 'MANUAL') : 'IDENTITY',
      session: planner.session,
      feeling: planner.feeling,
      setupGrade: planner.setupGrade,
      strategyId: selectedStrategy?.id,
      strategyTag: selectedStrategy ? selectedStrategy.name : undefined,
      linkedPlanId: selectedPlan?.id,
      riskAmount: manualRisk ?? undefined,
      initialNotes: planner.notes || undefined,
      entryJournalText: planner.notes.trim() || 'Entry rationale captured at start.',
      entryInvalidation: planner.invalidation.trim(),
      entryScreenshotAssetIds: attachedScreenshots.map((asset) => asset.id)
    }

    await startTradeMutation.mutateAsync(payload)
  }

  const handleCloseTrade = async () => {
    if (!session?.activeTrade) return
    if (!closeDraft.exitPrice) {
      setApiError(t('today.session.errors.exitPriceRequired'))
      return
    }

    await closeTradeMutation.mutateAsync({
      tradeId: session.activeTrade.id,
      payload: {
        exitPrice: Number(closeDraft.exitPrice),
        ruleBreaks: closeDraft.ruleBreaks,
        postTradeNotes: closeDraft.postTradeNotes
      }
    })
  }

  const handleSaveEntryJournal = async () => {
    if (!entryJournalTradeId) {
      setEntryJournalOpen(false)
      return
    }
    if (!entryJournalDraft.text.trim()) {
      setApiError('Entry journal text is required.')
      return
    }
    if (!entryJournalDraft.invalidation.trim()) {
      setApiError('Entry invalidation is required.')
      return
    }

    await saveEntryJournalMutation.mutateAsync({
      tradeId: entryJournalTradeId,
      payload: {
        entryJournalText: entryJournalDraft.text.trim(),
        entryInvalidation: entryJournalDraft.invalidation.trim(),
        feeling: entryJournalDraft.emotion,
        entryScreenshotAssetIds: attachedScreenshots.map((asset) => asset.id)
      }
    })
  }

  const handleResetLockIn = () => {
    if (!session) {
      setLockIn(DEFAULT_LOCK_IN_STATE)
      return
    }
    setLockIn({
      ...DEFAULT_LOCK_IN_STATE,
      session: 'LONDON',
      dailyMaxLoss: String(session.lossLimit || ''),
      maxTrades: String(session.maxTrades || '')
    })
  }

  const focusMentorPanel = () => {
    setLayoutState((prev) => ({
      ...prev,
      maximized: null,
      collapsed: {
        ...prev.collapsed,
        mentor: false
      }
    }))
    mentorPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    mentorPanelRef.current?.focus()
  }

  if (sessionQuery.isLoading) {
    return <LoadingState rows={8} height={26} />
  }

  const visibleKeyLevels = isMobileViewport ? decisionLevels.slice(0, 3) : decisionLevels
  const hiddenKeyLevelsCount = Math.max(0, decisionLevels.length - visibleKeyLevels.length)

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0, overflowX: 'clip', pb: 'max(8px, env(safe-area-inset-bottom))' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t('today.session.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('today.session.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant={layoutState.preset === 'execution' ? 'contained' : 'outlined'}
            startIcon={<CenterFocusStrongRoundedIcon />}
            onClick={() => applyPreset('execution')}
            size="small"
          >
            Execution Focus
          </Button>
          <Button
            variant={layoutState.preset === 'study' ? 'contained' : 'outlined'}
            startIcon={<SchoolRoundedIcon />}
            onClick={() => applyPreset('study')}
            size="small"
          >
            Study Focus
          </Button>
          <Button component={Link} to="/today" variant="outlined">
            {t('today.session.exit')}
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
            {[
              { id: 1, label: '1. Lock-in' },
              { id: 2, label: '2. Checklist' },
              { id: 3, label: '3. Chart' },
              { id: 4, label: '4. Execute' }
            ].map((step) => (
              <Chip
                key={step.id}
                label={step.label}
                color={flowStep === step.id ? 'primary' : (flowStep > step.id ? 'success' : 'default')}
                variant={flowStep > step.id ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {apiError && <Alert severity="error">{apiError}</Alert>}
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {!session ? (
        <Card>
          <CardContent>
            <Stack spacing={2} component="form" onSubmit={handleSaveConfig}>
              <Typography variant="h6">{t('today.session.config.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('today.session.config.subtitle')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={t('today.session.config.profitTarget')}
                    type="number"
                    value={config.profitTarget}
                    onChange={(event) => setConfig((prev) => ({ ...prev, profitTarget: event.target.value }))}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={t('today.session.config.lossLimit')}
                    type="number"
                    value={config.lossLimit}
                    onChange={(event) => setConfig((prev) => ({ ...prev, lossLimit: event.target.value }))}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={t('today.session.config.maxTrades')}
                    type="number"
                    value={config.maxTrades}
                    onChange={(event) => setConfig((prev) => ({ ...prev, maxTrades: event.target.value }))}
                    fullWidth
                    required
                  />
                </Grid>
              </Grid>
              <Button type="submit" variant="contained" disabled={saveConfigMutation.isLoading}>
                {saveConfigMutation.isLoading ? t('today.session.config.saving') : t('today.session.config.submit')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          {isPanelVisible('progress') && (
            <Card sx={{ position: { xs: 'sticky', md: 'static' }, top: { xs: 0, md: 'auto' }, zIndex: 10 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle2">{t('today.session.progress.title')}</Typography>
                      <Typography variant="caption" color="text.secondary">Track guardrails and limits</Typography>
                    </Box>
                    {renderPanelControls('progress')}
                  </Stack>
                  {!isPanelCollapsed('progress') && (
                    <>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                        <Stack spacing={0.35}>
                          <Typography variant="body2" color="text.secondary">
                            {t('today.session.progress.realizedPnl', {
                              realized: formatSignedCurrency(session.realizedPnl || 0, profileCurrency),
                              target: formatCurrency(session.profitTarget || 0, profileCurrency)
                            })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('today.session.progress.trades', {
                              closed: session.closedTradesCount,
                              max: session.maxTrades
                            })}
                          </Typography>
                        </Stack>
                        <Chip
                          color={session.status === 'COMPLETED' ? 'error' : 'success'}
                          label={session.status === 'COMPLETED'
                            ? t('today.session.status.completed')
                            : t('today.session.status.active')}
                          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                        />
                      </Stack>
                      <Stack spacing={0.75}>
                        <Typography variant="caption" color="text.secondary">{t('today.session.progress.pnlGuardrail')}</Typography>
                        <LinearProgress variant="determinate" value={progress.pnlProgress} sx={{ height: 8, borderRadius: 999 }} />
                      </Stack>
                      <Stack spacing={0.75}>
                        <Typography variant="caption" color="text.secondary">{t('today.session.progress.tradeGuardrail')}</Typography>
                        <LinearProgress variant="determinate" value={progress.tradeProgress} sx={{ height: 8, borderRadius: 999 }} />
                      </Stack>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: { xs: 1.5, md: 2 },
              minWidth: 0,
              '& > *': { minWidth: 0 }
            }}
          >
            {isPanelVisible('checklist') && (
              <Card>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PlaylistAddCheckRoundedIcon color="primary" fontSize="small" />
                        <Box>
                          <Typography variant="subtitle1">{t('today.session.checklist.title')}</Typography>
                          <Typography variant="caption" color="text.secondary">Complete prerequisites before executing</Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Prereqs ${prerequisiteCount}/4 • Triggers ${triggerCount}/5`}
                        />
                      </Stack>
                      {renderPanelControls('checklist')}
                    </Stack>

                    {!isPanelCollapsed('checklist') && (
                      <>
                        <Box sx={{ p: 1.25, border: '1px solid', borderColor: lockInComplete ? 'success.light' : 'warning.light', borderRadius: 2 }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle2">Session Lock-In</Typography>
                              <Stack direction="row" spacing={1}>
                                <Chip size="small" color={lockInComplete ? 'success' : 'warning'} label={lockInComplete ? 'Complete' : 'Incomplete'} />
                                <Button size="small" variant="text" startIcon={<RestartAltRoundedIcon />} onClick={handleResetLockIn}>Reset lock-in</Button>
                              </Stack>
                            </Stack>

                            <Grid container spacing={1}>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  select
                                  size="small"
                                  label="Session"
                                  value={lockIn.session}
                                  onChange={(event) => {
                                    const sessionValue = event.target.value as LockInSession
                                    setLockIn((prev) => ({ ...prev, session: sessionValue }))
                                    setPlanner((prev) => ({ ...prev, session: sessionValue as 'LONDON' | 'NY_AM' | 'ASIA' | 'NY_PM' }))
                                  }}
                                  fullWidth
                                >
                                  <MenuItem value="">Select session</MenuItem>
                                  {LOCK_IN_SESSION_OPTIONS.map((item) => (
                                    <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                                  ))}
                                </TextField>
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  size="small"
                                  type="number"
                                  label="Daily max loss"
                                  value={lockIn.dailyMaxLoss}
                                  onChange={(event) => setLockIn((prev) => ({ ...prev, dailyMaxLoss: event.target.value }))}
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  size="small"
                                  type="number"
                                  label="Max trades"
                                  value={lockIn.maxTrades}
                                  onChange={(event) => setLockIn((prev) => ({ ...prev, maxTrades: event.target.value }))}
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                  <Button size="small" variant={lockIn.objective === 'A_PLUS_ONLY' ? 'contained' : 'outlined'} onClick={() => setLockIn((prev) => ({ ...prev, objective: 'A_PLUS_ONLY' }))}>A+ only</Button>
                                  <Button
                                    size="small"
                                    variant={lockIn.objective === 'ONE_TRADE_MAX' ? 'contained' : 'outlined'}
                                    onClick={() => setLockIn((prev) => ({ ...prev, objective: 'ONE_TRADE_MAX', maxTrades: '1' }))}
                                  >
                                    1 trade max
                                  </Button>
                                  <Button
                                    size="small"
                                    variant={lockIn.objective === 'TWO_TRADES_MAX' ? 'contained' : 'outlined'}
                                    onClick={() => setLockIn((prev) => ({ ...prev, objective: 'TWO_TRADES_MAX', maxTrades: '2' }))}
                                  >
                                    2 trades max
                                  </Button>
                                </Stack>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  select
                                  size="small"
                                  label="Bias"
                                  value={lockIn.bias}
                                  onChange={(event) => setLockIn((prev) => ({ ...prev, bias: event.target.value as LockInBias }))}
                                  fullWidth
                                >
                                  <MenuItem value="">Select bias</MenuItem>
                                  <MenuItem value="LONG">Long</MenuItem>
                                  <MenuItem value="SHORT">Short</MenuItem>
                                  <MenuItem value="NEUTRAL">Neutral</MenuItem>
                                </TextField>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  size="small"
                                  label="Bias reason"
                                  value={lockIn.biasReason}
                                  onChange={(event) => setLockIn((prev) => ({ ...prev, biasReason: event.target.value.slice(0, 140) }))}
                                  fullWidth
                                  helperText={`${lockIn.biasReason.length}/140`}
                                />
                              </Grid>
                            </Grid>
                          </Stack>
                        </Box>

                        <Accordion defaultExpanded>
                          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                            <Typography variant="body2">Pre-trade prerequisites</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1}>
                              <FormControlLabel
                                control={<Checkbox checked={prereqs.newsChecked} onChange={(event) => setPrereqs((prev) => ({ ...prev, newsChecked: event.target.checked }))} />}
                                label="News check done"
                              />
                              <TextField
                                size="small"
                                label="Red news within ±10m (optional time)"
                                value={prereqs.redNewsWindow}
                                onChange={(event) => setPrereqs((prev) => ({ ...prev, redNewsWindow: event.target.value }))}
                                fullWidth
                              />
                              <FormControlLabel
                                control={<Checkbox checked={prereqs.keyLevelsMarked} onChange={(event) => setPrereqs((prev) => ({ ...prev, keyLevelsMarked: event.target.checked }))} />}
                                label="Key levels marked (PDH/PDL, Asia H/L, Session H/L, EQH/EQL)"
                              />
                              <TextField
                                size="small"
                                label="Key levels quick notes (optional)"
                                value={prereqs.keyLevelsNotes}
                                onChange={(event) => setPrereqs((prev) => ({ ...prev, keyLevelsNotes: event.target.value }))}
                                fullWidth
                              />
                              <FormControlLabel
                                control={<Checkbox checked={lockInComplete} disabled />}
                                label="Risk & max trades confirmed (auto from lock-in)"
                              />
                              <FormControlLabel
                                control={<Checkbox checked={invalidationWritten} disabled />}
                                label="Invalidation written"
                              />
                              {!invalidationWritten && (
                                <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => invalidationFieldRef.current?.focus()}>
                                  Go to invalidation field
                                </Button>
                              )}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>

                        <Accordion defaultExpanded={Boolean(selectedStrategy) || !isMobileViewport}>
                          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                            <Typography variant="body2">Setup triggers {selectedStrategy ? `(${selectedStrategy.name})` : '(generic)'}</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1}>
                              {!selectedStrategy && (
                                <Alert severity="info" sx={{ mb: 1 }}>
                                  Select strategy to load trigger checklist. Generic trigger set is active.
                                </Alert>
                              )}
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                                <TextField
                                  select
                                  size="small"
                                  label="Liquidity sweep level"
                                  value={triggers.sweepLevel}
                                  onChange={(event) => setTriggers((prev) => ({ ...prev, sweepLevel: event.target.value }))}
                                  sx={{ minWidth: { xs: '100%', sm: 220 } }}
                                >
                                  <MenuItem value="">Select level</MenuItem>
                                  {['PDH', 'PDL', 'ASIA_H', 'ASIA_L', 'SESSION_H', 'SESSION_L', 'EQH', 'EQL'].map((item) => (
                                    <MenuItem key={item} value={item}>{item}</MenuItem>
                                  ))}
                                </TextField>
                                <FormControlLabel
                                  control={<Checkbox checked={triggers.sweepConfirmed} onChange={(event) => setTriggers((prev) => ({ ...prev, sweepConfirmed: event.target.checked }))} />}
                                  label="Liquidity sweep confirmed"
                                />
                              </Stack>

                              <FormControlLabel
                                control={<Checkbox checked={triggers.displacementConfirmed} onChange={(event) => setTriggers((prev) => ({ ...prev, displacementConfirmed: event.target.checked }))} />}
                                label="Displacement close (M5) away from sweep"
                              />
                              <FormControlLabel
                                control={<Checkbox checked={triggers.mssConfirmed} onChange={(event) => setTriggers((prev) => ({ ...prev, mssConfirmed: event.target.checked }))} />}
                                label="MSS confirmed on close"
                              />
                              <FormControlLabel
                                control={<Checkbox checked={triggers.entryZoneConfirmed} onChange={(event) => setTriggers((prev) => ({ ...prev, entryZoneConfirmed: event.target.checked }))} />}
                                label="Entry zone identified (FVG 50%)"
                              />
                              <FormControlLabel
                                control={<Checkbox checked={rrMet} disabled />}
                                label={`RR rule met (>= ${RR_THRESHOLD}R)`}
                              />
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {isPanelVisible('chart') && (
              <Card sx={{ minHeight: 'clamp(260px, 42vh, 420px)' }}>
                <CardContent sx={{ display: 'grid', gap: 1.25 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CandlestickChartRoundedIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="subtitle1">{t('today.session.layout.liveChart')}</Typography>
                        <Typography variant="caption" color="text.secondary">Confirm setup triggers and entry zone</Typography>
                      </Box>
                    </Stack>
                    {renderPanelControls('chart')}
                  </Stack>

                  {!isPanelCollapsed('chart') && (
                    <>
                      <Box sx={{ p: 1.1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Stack spacing={1}>
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ md: 'center' }}>
                            <Chip size="small" label={`Bias: ${lockIn.bias || 'Unset'}`} />
                            <Chip size="small" label={`Session: ${lockIn.session || 'Unset'}`} />
                            <Chip size="small" label={`Local: ${localNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                            <Chip size="small" color={newsSafe ? 'success' : 'warning'} label={newsSafe ? 'News: safe' : 'News: caution'} />
                          </Stack>

                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            {visibleKeyLevels.map((level) => (
                              <Chip key={level} label={level} size="small" onDelete={() => setDecisionLevels((prev) => prev.filter((item) => item !== level))} />
                            ))}
                            {hiddenKeyLevelsCount > 0 && (
                              <Chip size="small" variant="outlined" label={`+${hiddenKeyLevelsCount} more`} />
                            )}
                          </Stack>

                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                            <TextField
                              size="small"
                              label="Add level"
                              value={decisionLevelDraft}
                              onChange={(event) => setDecisionLevelDraft(event.target.value)}
                              sx={{ minWidth: { xs: '100%', sm: 180 } }}
                            />
                            <Button size="small" variant="outlined" onClick={handleAddDecisionLevel}>Add</Button>
                            <Button size="small" variant="outlined" startIcon={<PhotoCameraBackRoundedIcon />} onClick={() => setScreenshotDialogOpen(true)}>
                              Attach screenshot to trade
                            </Button>
                            <Button size="small" variant="outlined" onClick={focusMentorPanel}>Open full mentor plan</Button>
                            <Button size="small" variant="outlined" startIcon={<CenterFocusStrongRoundedIcon />} onClick={() => applyPreset('execution')}>
                              Execution focus mode
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>

                      <TradingViewWidget
                        symbol={chartSymbol}
                        interval={chartInterval}
                        themePreference={chartTheme}
                        hideControls={chartHideControls}
                        allowSymbolChange={chartAllowSymbolChange}
                        minHeight={isCompactViewport ? 260 : 360}
                        fallbackMessage={t('today.session.mentor.liveChartFallback')}
                        fallbackLinkLabel={t('today.session.mentor.openOnTradingView')}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {(isPanelVisible('mentor') || isPanelVisible('planner')) && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: layoutState.maximized ? '1fr' : { xs: '1fr', md: 'minmax(0, 0.95fr) minmax(0, 1.05fr)' },
                  gap: { xs: 1.5, md: 2 },
                  minWidth: 0,
                  '& > *': { minWidth: 0 }
                }}
              >
                {isPanelVisible('mentor') && (
                  <Card ref={mentorPanelRef} tabIndex={-1}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AutoStoriesRoundedIcon color="primary" fontSize="small" />
                            <Box>
                              <Typography variant="subtitle1">{t('today.session.mentor.title')}</Typography>
                              <Typography variant="caption" color="text.secondary">Essentials first; expand for details</Typography>
                            </Box>
                          </Stack>
                          {renderPanelControls('mentor')}
                        </Stack>

                        {!isPanelCollapsed('mentor') && (
                          <>
                            {mentorPlanUpdatedNotice && (
                              <Alert severity="info">
                                {t('today.session.mentor.updated')}
                              </Alert>
                            )}

                            <TextField
                              select
                              size="small"
                              label={t('today.session.mentor.select')}
                              value={selectedPlanId || ''}
                              onChange={(event) => {
                                setSelectedPlanId(event.target.value)
                                setMentorPlanUpdatedNotice(false)
                              }}
                              fullWidth
                              disabled={!eligiblePlans.length}
                            >
                              {eligiblePlans.map((plan) => (
                                <MenuItem key={plan.id} value={plan.id}>{plan.title}</MenuItem>
                              ))}
                            </TextField>

                            {dailyPlansQuery.isLoading ? (
                              <LoadingState rows={8} height={20} />
                            ) : !selectedPlan ? (
                              <EmptyState
                                title={t('today.session.mentor.emptyTitle')}
                                description="Proceed with personal checklist + select strategy."
                              />
                            ) : (
                              <Stack spacing={1.1}>
                                <Typography variant="h6" sx={{ fontSize: 18 }}>{selectedPlan.title}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {selectedPlan.summary || selectedPlan.biasSummary || t('today.session.mentor.emptySummary')}
                                </Typography>

                                <Grid container spacing={1}>
                                  <Grid item xs={12} sm={6}>
                                    <Box sx={{ p: 1.15, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                                      <Typography variant="caption" color="text.secondary">Bias summary</Typography>
                                      <Typography variant="body2">{selectedPlan.biasSummary || selectedPlan.summary || t('today.session.mentor.emptySummary')}</Typography>
                                    </Box>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <Box sx={{ p: 1.15, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                                      <Typography variant="caption" color="text.secondary">Key levels</Typography>
                                      {(selectedPlan.keyLevels || []).length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">{t('today.session.mentor.noKeyLevels')}</Typography>
                                      ) : (
                                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                                          {(selectedPlan.keyLevels || []).slice(0, isTinyViewport ? 4 : 8).map((level) => (
                                            <Chip key={level} size="small" label={level} variant="outlined" />
                                          ))}
                                        </Stack>
                                      )}
                                    </Box>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Box
                                      sx={{
                                        p: 1.15,
                                        border: '1px solid',
                                        borderColor: mentorInvalidation ? 'success.light' : 'warning.light',
                                        backgroundColor: mentorInvalidation ? 'success.50' : 'warning.50',
                                        borderRadius: 2
                                      }}
                                    >
                                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                                        <Box>
                                          <Typography variant="caption" color="text.secondary">Invalidation</Typography>
                                          <Typography variant="body2">
                                            {mentorInvalidation || 'Missing invalidation'}
                                          </Typography>
                                        </Box>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          onClick={() => {
                                            if (!mentorInvalidation) return
                                            setPlanner((prev) => ({ ...prev, invalidation: mentorInvalidation.slice(0, 200) }))
                                          }}
                                          disabled={!mentorInvalidation}
                                        >
                                          Copy invalidation to trade
                                        </Button>
                                      </Stack>
                                    </Box>
                                  </Grid>
                                  <Grid item xs={12}>
                                    <Box sx={{ p: 1.15, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                      <Typography variant="caption" color="text.secondary">Execution rules</Typography>
                                      {selectedPlanExecutionBullets.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">{t('today.session.mentor.noExecutionRules')}</Typography>
                                      ) : (
                                        <Stack spacing={0.35} sx={{ mt: 0.75 }}>
                                          {selectedPlanExecutionBullets.slice(0, mentorFullView ? undefined : 3).map((item, index) => (
                                            <Typography key={`${item}-${index}`} variant="body2">{index + 1}. {item}</Typography>
                                          ))}
                                        </Stack>
                                      )}
                                    </Box>
                                  </Grid>
                                </Grid>

                                <Button size="small" variant="text" sx={{ alignSelf: 'flex-start' }} onClick={() => setMentorFullView((prev) => !prev)}>
                                  {mentorFullView ? 'Show essentials only' : 'Show full plan'}
                                </Button>

                                {mentorFullView && selectedPlanHasAdvanced && (
                                  <Stack spacing={1}>
                                    {selectedPlan.primaryModel && (
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">{t('today.session.mentor.primaryModel')}</Typography>
                                        <Typography variant="body2">{selectedPlan.primaryModel}</Typography>
                                      </Box>
                                    )}
                                    {selectedPlan.liquidityNarrative && (
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">{t('today.session.mentor.liquidityNarrative')}</Typography>
                                        <Typography variant="body2">{selectedPlan.liquidityNarrative}</Typography>
                                      </Box>
                                    )}
                                    {selectedPlan.alternativeScenario && (
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">{t('today.session.mentor.alternativeScenario')}</Typography>
                                        <Typography variant="body2">{selectedPlan.alternativeScenario}</Typography>
                                      </Box>
                                    )}
                                    {selectedPlan.context && (
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">{t('today.session.mentor.context')}</Typography>
                                        <Typography variant="body2">{selectedPlan.context}</Typography>
                                      </Box>
                                    )}
                                    {selectedPlan.body && (
                                      <Box>
                                        <Typography variant="caption" color="text.secondary">{t('today.session.mentor.body')}</Typography>
                                        <MarkdownContent content={selectedPlan.body} />
                                      </Box>
                                    )}
                                  </Stack>
                                )}

                                {selectedPlanSnapshotUrl && (
                                  <Stack spacing={0.75}>
                                    <Typography variant="caption" color="text.secondary">{t('today.session.mentor.chartSnapshot')}</Typography>
                                    <Box
                                      component="button"
                                      type="button"
                                      onClick={() => setSnapshotDialogOpen(true)}
                                      sx={{
                                        width: '100%',
                                        p: 0,
                                        border: 'none',
                                        bgcolor: 'transparent',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        cursor: 'zoom-in'
                                      }}
                                    >
                                      <SecureAssetImage
                                        url={selectedPlanSnapshotUrl}
                                        alt={selectedPlan.title}
                                        sx={{
                                          display: 'block',
                                          width: '100%',
                                          maxHeight: { xs: 220, md: 320 },
                                          objectFit: 'cover',
                                          borderRadius: 2,
                                          border: '1px solid',
                                          borderColor: 'divider'
                                        }}
                                      />
                                    </Box>
                                  </Stack>
                                )}

                                <Button
                                  component={Link}
                                  to={`/insights/${selectedPlan.slug || selectedPlan.id}`}
                                  variant="outlined"
                                  size="small"
                                  startIcon={<OpenInNewRoundedIcon />}
                                  sx={{ alignSelf: 'flex-start' }}
                                >
                                  {t('today.actions.openFullPlan')}
                                </Button>
                              </Stack>
                            )}
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {isPanelVisible('planner') && (
                  <Card>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CandlestickChartRoundedIcon color="primary" fontSize="small" />
                            <Box>
                              <Typography variant="subtitle1">{t('today.session.planner.title')}</Typography>
                              <Typography variant="caption" color="text.secondary">Fill risk + invalidation before start</Typography>
                            </Box>
                          </Stack>
                          {renderPanelControls('planner')}
                        </Stack>

                        {!isPanelCollapsed('planner') && (
                          <>
                            <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>A) Setup</Typography>
                              <Grid container spacing={1}>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    label={t('trades.form.symbol')}
                                    value={planner.symbol}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, symbol: event.target.value }))}
                                    fullWidth
                                    size="small"
                                    required
                                  />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    select
                                    label={t('trades.form.direction')}
                                    value={planner.direction}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, direction: event.target.value as 'LONG' | 'SHORT' }))}
                                    fullWidth
                                    size="small"
                                  >
                                    <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                                    <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    select
                                    label={t('trades.form.session')}
                                    value={planner.session}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, session: event.target.value as 'ASIA' | 'LONDON' | 'NY_AM' | 'NY_PM' }))}
                                    fullWidth
                                    size="small"
                                  >
                                    <MenuItem value="ASIA">{t('trades.form.sessions.ASIA')}</MenuItem>
                                    <MenuItem value="LONDON">{t('trades.form.sessions.LONDON')}</MenuItem>
                                    <MenuItem value="NY_AM">{t('trades.form.sessions.NY_AM')}</MenuItem>
                                    <MenuItem value="NY_PM">{t('trades.form.sessions.NY_PM')}</MenuItem>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    select
                                    label={t('trades.form.strategy')}
                                    value={planner.strategyKey}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, strategyKey: event.target.value }))}
                                    fullWidth
                                    size="small"
                                  >
                                    <MenuItem value="">{t('common.none')}</MenuItem>
                                    <MenuItem disabled value="group-my">{t('today.session.form.myStrategies')}</MenuItem>
                                    {strategyOptions.filter((item) => item.source === 'MY').map((item) => (
                                      <MenuItem key={`MY:${item.id}`} value={`MY:${item.id}`}>{item.name}</MenuItem>
                                    ))}
                                    <MenuItem disabled value="group-mentor">{t('today.session.form.mentorStrategies')}</MenuItem>
                                    {strategyOptions.filter((item) => item.source === 'MENTOR').map((item) => (
                                      <MenuItem key={`MENTOR:${item.id}`} value={`MENTOR:${item.id}`}>{item.name}</MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    label={t('today.session.form.linkedPlan')}
                                    value={selectedPlan?.title || t('common.none')}
                                    fullWidth
                                    size="small"
                                    InputProps={{ readOnly: true }}
                                  />
                                </Grid>
                              </Grid>
                            </Box>

                            <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>B) Risk</Typography>
                              <Grid container spacing={1}>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    label={t('trades.form.quantity')}
                                    type="number"
                                    value={planner.quantity}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, quantity: event.target.value }))}
                                    fullWidth
                                    size="small"
                                  />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    label="Risk $"
                                    type="number"
                                    value={planner.riskAmount}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, riskAmount: event.target.value }))}
                                    fullWidth
                                    size="small"
                                  />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    select
                                    label={t('today.session.form.tradeCurrency')}
                                    value={tradeCurrency}
                                    onChange={(event) => {
                                      const nextCurrency = event.target.value.toUpperCase()
                                      setPlanner((prev) => ({
                                        ...prev,
                                        tradeCurrency: nextCurrency,
                                        fxRateTradeToProfile: nextCurrency === profileCurrency ? '1' : prev.fxRateTradeToProfile,
                                        fxRateSource: nextCurrency === profileCurrency ? 'IDENTITY' : (prev.fxRateSource === 'IDENTITY' ? 'MANUAL' : prev.fxRateSource)
                                      }))
                                    }}
                                    fullWidth
                                    size="small"
                                  >
                                    <MenuItem value="USD">USD</MenuItem>
                                    <MenuItem value="EUR">EUR</MenuItem>
                                  </TextField>
                                </Grid>
                              </Grid>

                              {isCrossCurrency && (
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                                  <TextField
                                    label={t('today.session.form.fxRate')}
                                    type="number"
                                    value={planner.fxRateTradeToProfile}
                                    onChange={(event) => setPlanner((prev) => ({
                                      ...prev,
                                      fxRateTradeToProfile: event.target.value,
                                      fxRateSource: 'MANUAL'
                                    }))}
                                    size="small"
                                    sx={{ flex: 1 }}
                                    helperText={t('today.session.form.fxRateHint', { tradeCurrency, profileCurrency })}
                                  />
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => void handleAutoFillFxRate()}
                                    disabled={fxAutoFillLoading}
                                  >
                                    {fxAutoFillLoading ? t('today.session.form.fxRateLoading') : t('today.session.form.fxRateAutoFill')}
                                  </Button>
                                </Stack>
                              )}

                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                {t('today.session.form.riskSnapshot', {
                                  risk: riskSnapshot.riskAmount === null
                                    ? t('common.na')
                                    : formatCurrency(riskSnapshot.riskAmount, tradeCurrency),
                                  r: riskSnapshot.rEstimate === null
                                    ? t('common.na')
                                    : formatNumber(riskSnapshot.rEstimate, 2)
                                })}
                              </Typography>
                              {convertedRiskSnapshot !== null && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
                                  {t('today.session.form.riskSnapshotConverted', { risk: formatCurrency(convertedRiskSnapshot, profileCurrency) })}
                                </Typography>
                              )}
                              {effectiveRiskInProfile !== null && Number(lockIn.dailyMaxLoss || 0) > 0 && effectiveRiskInProfile > Number(lockIn.dailyMaxLoss) && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                  Risk exceeds lock-in daily max loss.
                                </Alert>
                              )}
                            </Box>

                            <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>C) Prices</Typography>
                              <Grid container spacing={1}>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    label={t('trades.form.entryPrice')}
                                    type="number"
                                    value={planner.entryPrice}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, entryPrice: event.target.value }))}
                                    fullWidth
                                    size="small"
                                    required
                                  />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    label={t('trades.form.stopLossPrice')}
                                    type="number"
                                    value={planner.stopLossPrice}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, stopLossPrice: event.target.value }))}
                                    fullWidth
                                    size="small"
                                    required
                                  />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    label={t('trades.form.takeProfitPrice')}
                                    type="number"
                                    value={planner.takeProfitPrice}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, takeProfitPrice: event.target.value }))}
                                    fullWidth
                                    size="small"
                                  />
                                </Grid>

                                <Grid item xs={12}>
                                  <TextField
                                    label="I'm wrong if..."
                                    value={planner.invalidation}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, invalidation: event.target.value.slice(0, 200) }))}
                                    fullWidth
                                    size="small"
                                    required
                                    inputRef={invalidationFieldRef}
                                    helperText={`${planner.invalidation.length}/200`}
                                  />
                                </Grid>

                                <Grid item xs={12}>
                                  <TextField
                                    label={t('trades.form.notes')}
                                    value={planner.notes}
                                    onChange={(event) => setPlanner((prev) => ({ ...prev, notes: event.target.value }))}
                                    fullWidth
                                    size="small"
                                    multiline
                                    minRows={2}
                                  />
                                </Grid>
                              </Grid>

                              {!rrMet && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                  RR is below {RR_THRESHOLD.toFixed(1)}R. Start is blocked until RR meets threshold.
                                </Alert>
                              )}
                            </Box>

                            <Box sx={{ p: 1.1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                                <Typography variant="body2">Setup quality score: <strong>{setupQualityScore}%</strong> ({suggestedSetupGrade})</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Auto-grade inputs: lock-in, prerequisites, triggers, RR, news safe
                                </Typography>
                              </Stack>
                            </Box>

                            {selectedStrategy && (
                              <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                <Stack spacing={0.8}>
                                  <Typography variant="subtitle2">Strategy preview</Typography>
                                  {selectedStrategySnapshotUrl && (
                                    <SecureAssetImage
                                      url={selectedStrategySnapshotUrl}
                                      alt={selectedStrategy.name}
                                      sx={{
                                        display: 'block',
                                        width: '100%',
                                        maxHeight: 220,
                                        objectFit: 'cover',
                                        borderRadius: 1.5,
                                        border: '1px solid',
                                        borderColor: 'divider'
                                      }}
                                    />
                                  )}
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedStrategy.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{selectedStrategy.model}</Typography>
                                  {selectedStrategy.entryConditionsRich ? (
                                    <RichTextContent html={selectedStrategy.entryConditionsRich} />
                                  ) : (
                                    <Stack spacing={0.35}>
                                      {(selectedStrategy.entryConditions || []).slice(0, 4).map((item) => (
                                        <Typography key={item} variant="body2">• {item}</Typography>
                                      ))}
                                    </Stack>
                                  )}
                                  {strategyManagementBullets.length > 0 && (
                                    <Stack spacing={0.35}>
                                      {strategyManagementBullets.slice(0, 2).map((item) => (
                                        <Typography key={item} variant="body2">• {item}</Typography>
                                      ))}
                                    </Stack>
                                  )}
                                  {strategyNoTradeBullets.length > 0 && (
                                    <Stack spacing={0.35}>
                                      {strategyNoTradeBullets.slice(0, 2).map((item) => (
                                        <Typography key={item} variant="body2">• {item}</Typography>
                                      ))}
                                    </Stack>
                                  )}
                                </Stack>
                              </Box>
                            )}

                            <Divider />

                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AddRoundedIcon />}
                                  onClick={() => setScheduleOpen((prev) => !prev)}
                                  disabled={!canScheduleTrade}
                                >
                                  {t('today.session.planner.scheduleTrade')}
                                </Button>
                                {!canMeetExecutionGate && (
                                  <Button
                                    variant="text"
                                    size="small"
                                    startIcon={<ErrorOutlineRoundedIcon />}
                                    onClick={() => setMissingModalOpen(true)}
                                  >
                                    View missing items
                                  </Button>
                                )}
                              </Stack>

                              {!session.activeTrade ? (
                                <Button
                                  variant="contained"
                                  onClick={handleStartTrade}
                                  disabled={!canStartTrade || startTradeMutation.isLoading}
                                >
                                  {startTradeMutation.isLoading ? t('today.session.planner.startingTrade') : t('today.session.planner.startTrade')}
                                </Button>
                              ) : (
                                <Button variant="outlined" color="error" onClick={() => setCloseFormOpen((prev) => !prev)}>
                                  {t('today.session.planner.stopTrade')}
                                </Button>
                              )}
                            </Stack>

                            {!canMeetExecutionGate && (
                              <Typography variant="caption" color="warning.main">
                                Complete: Lock-in + missing checklist items + invalidation
                              </Typography>
                            )}

                            {scheduleOpen && (
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                <TextField
                                  size="small"
                                  label={t('today.session.planner.scheduleTickerLabel')}
                                  value={tickerDraft}
                                  onChange={(event) => setTickerDraft(event.target.value)}
                                  fullWidth
                                />
                                <Button size="small" variant="contained" onClick={handleAddTicker}>{t('today.session.planner.addTicker')}</Button>
                              </Stack>
                            )}

                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                              {(session.plannedTickers || []).map((ticker) => (
                                <Chip key={ticker} label={ticker} onDelete={() => void handleRemoveTicker(ticker)} size="small" />
                              ))}
                            </Stack>

                            {session.activeTrade && (
                              <Stack spacing={1}>
                                <Alert severity="info">
                                  {t('today.session.planner.activeTrade', {
                                    symbol: session.activeTrade.symbol,
                                    direction: session.activeTrade.direction,
                                    price: formatNumber(session.activeTrade.entryPrice, 4)
                                  })}
                                </Alert>

                                {closeFormOpen && (
                                  <Stack spacing={1.25} sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                    <TextField
                                      label={t('today.session.planner.exitPrice')}
                                      type="number"
                                      value={closeDraft.exitPrice}
                                      onChange={(event) => setCloseDraft((prev) => ({ ...prev, exitPrice: event.target.value }))}
                                      fullWidth
                                      size="small"
                                    />
                                    <TextField
                                      select
                                      label={t('trades.form.ruleBreaks')}
                                      value={closeDraft.ruleBreaks}
                                      onChange={(event) => {
                                        const value = event.target.value
                                        setCloseDraft((prev) => ({
                                          ...prev,
                                          ruleBreaks: typeof value === 'string' ? value.split(',') : value
                                        }))
                                      }}
                                      SelectProps={{
                                        multiple: true,
                                        renderValue: (selected) => (selected as string[]).join(', ')
                                      }}
                                      fullWidth
                                      size="small"
                                    >
                                      {RULE_BREAK_OPTIONS.map((item) => (
                                        <MenuItem key={item} value={item}>{item}</MenuItem>
                                      ))}
                                    </TextField>
                                    <TextField
                                      label={t('today.session.planner.postTradeNotes')}
                                      value={closeDraft.postTradeNotes}
                                      onChange={(event) => setCloseDraft((prev) => ({ ...prev, postTradeNotes: event.target.value }))}
                                      fullWidth
                                      size="small"
                                      multiline
                                      minRows={3}
                                    />
                                    <Button
                                      variant="contained"
                                      color="error"
                                      onClick={handleCloseTrade}
                                      disabled={closeTradeMutation.isLoading}
                                    >
                                      {closeTradeMutation.isLoading ? t('today.session.planner.closingTrade') : t('today.session.planner.confirmCloseTrade')}
                                    </Button>
                                  </Stack>
                                )}
                              </Stack>
                            )}
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}
          </Box>
        </>
      )}

      <Dialog open={missingModalOpen} onClose={() => setMissingModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Execution requirements</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="subtitle2">1) Lock-in</Typography>
              {missingLockInItems.length === 0 ? (
                <Typography variant="body2" color="success.main">Complete</Typography>
              ) : (
                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                  {missingLockInItems.map((item) => (
                    <Typography key={item} variant="body2">• {item}</Typography>
                  ))}
                </Stack>
              )}
            </Box>
            <Box>
              <Typography variant="subtitle2">2) Checklist prerequisites</Typography>
              {missingPrereqs.length === 0 ? (
                <Typography variant="body2" color="success.main">Complete</Typography>
              ) : (
                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                  {missingPrereqs.map((item) => (
                    <Typography key={item} variant="body2">• {item}</Typography>
                  ))}
                </Stack>
              )}
            </Box>
            <Box>
              <Typography variant="subtitle2">3) Setup triggers</Typography>
              {missingTriggers.length === 0 ? (
                <Typography variant="body2" color="success.main">Complete</Typography>
              ) : (
                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                  {missingTriggers.map((item) => (
                    <Typography key={item} variant="body2">• {item}</Typography>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMissingModalOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={screenshotDialogOpen} onClose={() => setScreenshotDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Attach screenshot</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">Upload PNG/JPG or paste directly from clipboard.</Typography>
            <Button variant="outlined" component="label" disabled={uploadingScreenshot}>
              {uploadingScreenshot ? 'Uploading…' : 'Choose files'}
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files || [])
                  void uploadScreenshotFiles(files)
                  event.target.value = ''
                }}
              />
            </Button>
            <Box
              role="textbox"
              aria-label="Paste screenshot"
              tabIndex={0}
              onPaste={(event) => void handlePasteScreenshots(event)}
              sx={{ p: 1.25, border: '1px dashed', borderColor: 'divider', borderRadius: 2, minHeight: 80 }}
            >
              <Typography variant="caption" color="text.secondary">Paste screenshot here (Ctrl/Cmd+V)</Typography>
            </Box>
            <Stack spacing={0.75}>
              {attachedScreenshots.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No screenshots attached yet.</Typography>
              ) : (
                attachedScreenshots.map((asset) => (
                  <Chip
                    key={asset.id}
                    size="small"
                    label={asset.originalFileName || asset.id}
                    onDelete={() => setAttachedScreenshots((prev) => prev.filter((item) => item.id !== asset.id))}
                  />
                ))
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScreenshotDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={entryJournalOpen} onClose={() => setEntryJournalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Entry Journal</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <TextField
              label="What did you see?"
              value={entryJournalDraft.text}
              onChange={(event) => setEntryJournalDraft((prev) => ({ ...prev, text: event.target.value.slice(0, 280) }))}
              fullWidth
              multiline
              minRows={2}
              required
            />
            <TextField
              label="Invalidation confirmation"
              value={entryJournalDraft.invalidation}
              onChange={(event) => setEntryJournalDraft((prev) => ({ ...prev, invalidation: event.target.value.slice(0, 200) }))}
              fullWidth
              required
            />
            <TextField
              select
              label="Emotion"
              value={entryJournalDraft.emotion}
              onChange={(event) => setEntryJournalDraft((prev) => ({ ...prev, emotion: event.target.value }))}
              fullWidth
            >
              {FEELING_OPTIONS.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" startIcon={<PhotoCameraBackRoundedIcon />} onClick={() => setScreenshotDialogOpen(true)}>
              Attach screenshot
            </Button>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {attachedScreenshots.map((asset) => (
                <Chip key={asset.id} size="small" label={asset.originalFileName || asset.id} />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntryJournalOpen(false)}>{t('common.close')}</Button>
          <Button variant="contained" onClick={handleSaveEntryJournal} disabled={saveEntryJournalMutation.isLoading}>
            {saveEntryJournalMutation.isLoading ? 'Saving…' : 'Save journal'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={snapshotDialogOpen && Boolean(selectedPlanSnapshotUrl)}
        onClose={() => setSnapshotDialogOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>{selectedPlan?.title || t('today.session.mentor.chartSnapshot')}</DialogTitle>
        <DialogContent dividers>
          {selectedPlanSnapshotUrl && (
            <SecureAssetImage
              url={selectedPlanSnapshotUrl}
              alt={selectedPlan?.title || t('today.session.mentor.chartSnapshot')}
              sx={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
            />
          )}
          {selectedPlan?.snapshotCaption && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {selectedPlan.snapshotCaption}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSnapshotDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

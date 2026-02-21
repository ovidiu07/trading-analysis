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
  InputAdornment,
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
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
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
  createChecklistTemplate,
  createSessionLevel,
  closeTradeFromSession,
  deleteChecklistTemplate,
  deleteSessionLevel,
  getTodaySession,
  listChecklistTemplates,
  saveTodaySessionConfig,
  saveTradeEntryJournal,
  setActiveSweepLevel,
  startTradeFromSession,
  updateChecklistTemplate,
  updateSessionLevel,
  updateTodaySessionChecklist,
  updateTodaySessionLockIn,
  updateTodaySessionPlannedTickers,
  type ChecklistTemplateResponse,
  type ChecklistTemplateType,
  type ChecklistValueType,
  type SessionChecklistItem,
  type SessionLevel,
  type SessionLevelCategory,
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

const LOCK_IN_SESSION_OPTIONS = ['LONDON', 'NY_AM'] as const

type LockInSession = (typeof LOCK_IN_SESSION_OPTIONS)[number]
type LockInBias = 'LONG' | 'SHORT' | 'NEUTRAL' | ''
type LockInObjective = 'A_PLUS_ONLY' | 'ONE_TRADE_MAX' | 'TWO_TRADES_MAX' | ''

type LockInState = {
  session: LockInSession | ''
  objective: LockInObjective
  bias: LockInBias
  biasReason: string
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
  objective: '',
  bias: '',
  biasReason: ''
}

type ChecklistEditDialogState = {
  open: boolean
  type: ChecklistTemplateType
  items: SessionChecklistItem[]
}

type TemplateDialogState = {
  open: boolean
  mode: 'import' | 'save'
  type: ChecklistTemplateType
}

type LevelDialogState = {
  open: boolean
  editId: string | null
  label: string
  customLabel: string
  price: string
  category: SessionLevelCategory
  notes: string
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

const LEVEL_LABEL_OPTIONS = ['PDH', 'PDL', 'AsiaH', 'AsiaL', 'EQH', 'EQL', 'Custom'] as const

const LEVEL_CATEGORY_OPTIONS: SessionLevelCategory[] = ['LIQUIDITY', 'TARGET', 'INVALIDATION', 'OTHER']

const CHECKLIST_VALUE_TYPES: ChecklistValueType[] = ['TEXT', 'NUMBER', 'TIME']

const emptyChecklistItem = (index: number): SessionChecklistItem => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text: '',
  order: index,
  required: true,
  hasNote: false,
  notePlaceholder: '',
  note: '',
  hasValue: false,
  valueLabel: '',
  valueType: 'TEXT',
  value: '',
  defaultChecked: false,
  completed: false
})

const reorderItems = (items: SessionChecklistItem[], index: number, direction: -1 | 1) => {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(nextIndex, 0, item)
  return next.map((entry, order) => ({ ...entry, order }))
}

const toChecklistTemplateItems = (items: SessionChecklistItem[]) => {
  return items.map((item, index) => ({
    id: item.id,
    text: item.text,
    order: item.order ?? index,
    required: item.required,
    hasNote: item.hasNote,
    notePlaceholder: item.notePlaceholder || null,
    hasValue: item.hasValue,
    valueLabel: item.valueLabel || null,
    valueType: item.valueType,
    defaultChecked: item.defaultChecked
  }))
}

const normalizeChecklistItems = (items: SessionChecklistItem[]) => {
  return items.map((item, index) => ({
    ...item,
    text: item.text.trim(),
    order: index,
    note: item.hasNote ? (item.note || '') : '',
    value: item.hasValue ? (item.value || '') : '',
    valueType: item.hasValue ? item.valueType : 'TEXT',
    notePlaceholder: item.hasNote ? (item.notePlaceholder || '') : '',
    valueLabel: item.hasValue ? (item.valueLabel || '') : '',
    required: item.required
  }))
}

const findSweepChecklistItemIndex = (items: SessionChecklistItem[]) => {
  return items.findIndex((item) => item.text.toLowerCase().includes('sweep'))
}

const parsePlanLevelSuggestions = (plan: DailyPlan | null | undefined) => {
  const tokens = new Set<string>()
  if (!plan) return [] as string[]
  ;(plan.keyLevels || []).forEach((value) => {
    const token = value.trim()
    if (token) tokens.add(token)
  })
  const text = `${plan.summary || ''} ${plan.biasSummary || ''} ${plan.executionRules || ''}`
  ;['PDH', 'PDL', 'ASIAH', 'ASIAL', 'EQH', 'EQL'].forEach((token) => {
    if (new RegExp(`\\b${token}\\b`, 'i').test(text)) {
      tokens.add(token)
    }
  })
  return Array.from(tokens)
}

const getChecklistCompletion = (items: SessionChecklistItem[]) => {
  const requiredItems = items.filter((item) => item.required)
  const completedRequired = requiredItems.filter((item) => item.completed).length
  return {
    requiredTotal: requiredItems.length,
    completedRequired,
    isComplete: requiredItems.length === 0 || completedRequired === requiredItems.length
  }
}

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
  const [prereqChecklist, setPrereqChecklist] = useState<SessionChecklistItem[]>([])
  const [triggerChecklist, setTriggerChecklist] = useState<SessionChecklistItem[]>([])
  const [sessionLevels, setSessionLevels] = useState<SessionLevel[]>([])
  const [activeSweepLevelId, setActiveSweepLevelId] = useState<string | null>(null)

  const [checklistEditDialog, setChecklistEditDialog] = useState<ChecklistEditDialogState>({
    open: false,
    type: 'PREREQS',
    items: []
  })
  const [templateDialog, setTemplateDialog] = useState<TemplateDialogState>({
    open: false,
    mode: 'import',
    type: 'PREREQS'
  })
  const [templateNameDraft, setTemplateNameDraft] = useState('')
  const [templateDefaultDraft, setTemplateDefaultDraft] = useState(false)
  const [selectedImportTemplateId, setSelectedImportTemplateId] = useState('')
  const [levelDialog, setLevelDialog] = useState<LevelDialogState>({
    open: false,
    editId: null,
    label: 'PDH',
    customLabel: '',
    price: '',
    category: 'LIQUIDITY',
    notes: ''
  })
  const [pricePickerTarget, setPricePickerTarget] = useState<'entry' | 'sl' | 'tp' | 'sweep' | null>(null)
  const [settingsEditOpen, setSettingsEditOpen] = useState(false)

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

  const prereqTemplatesQuery = useQuery({
    queryKey: ['checklistTemplates', 'PREREQS'],
    queryFn: () => listChecklistTemplates('PREREQS')
  })

  const triggerTemplatesQuery = useQuery({
    queryKey: ['checklistTemplates', 'TRIGGERS'],
    queryFn: () => listChecklistTemplates('TRIGGERS')
  })

  const session = sessionQuery.data || null
  const prereqTemplates = prereqTemplatesQuery.data || []
  const triggerTemplates = triggerTemplatesQuery.data || []
  const activeTemplates = templateDialog.type === 'PREREQS' ? prereqTemplates : triggerTemplates

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
    setLockIn({
      session: ((session.lockInSession || '') as LockInSession | '') || '',
      objective: ((session.lockInObjective || '') as LockInObjective | '') || '',
      bias: ((session.lockInBias || '') as LockInBias | '') || '',
      biasReason: session.lockInBiasReason || ''
    })
    setPrereqChecklist(normalizeChecklistItems(session.prereqsChecklistItems || []))
    setTriggerChecklist(normalizeChecklistItems(session.triggerChecklistItems || []))
    setSessionLevels(session.levels || [])
    setActiveSweepLevelId(session.activeSweepLevelId || null)
  }, [session])

  useEffect(() => {
    if (!session) return
    setConfig({
      profitTarget: String(session.profitTarget ?? ''),
      lossLimit: String(session.lossLimit ?? ''),
      maxTrades: String(session.maxTrades ?? '')
    })
  }, [session?.id, session?.profitTarget, session?.lossLimit, session?.maxTrades])

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

  const checklistMutation = useMutation({
    mutationFn: updateTodaySessionChecklist,
    onSuccess: async (nextSession) => {
      queryClient.setQueryData(['todaySession'], nextSession)
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const lockInMutation = useMutation({
    mutationFn: updateTodaySessionLockIn,
    onSuccess: async (nextSession) => {
      queryClient.setQueryData(['todaySession'], nextSession)
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const createTemplateMutation = useMutation({
    mutationFn: createChecklistTemplate,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates', 'PREREQS'] }),
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates', 'TRIGGERS'] })
      ])
    }
  })

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateChecklistTemplate>[1] }) =>
      updateChecklistTemplate(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates', 'PREREQS'] }),
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates', 'TRIGGERS'] })
      ])
    }
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: deleteChecklistTemplate,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates', 'PREREQS'] }),
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates', 'TRIGGERS'] })
      ])
    }
  })

  const createLevelMutation = useMutation({
    mutationFn: createSessionLevel,
    onSuccess: async (nextSession) => {
      queryClient.setQueryData(['todaySession'], nextSession)
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const updateLevelMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateSessionLevel>[1] }) =>
      updateSessionLevel(id, payload),
    onSuccess: async (nextSession) => {
      queryClient.setQueryData(['todaySession'], nextSession)
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const deleteLevelMutation = useMutation({
    mutationFn: deleteSessionLevel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const setSweepLevelMutation = useMutation({
    mutationFn: (levelId?: string | null) => setActiveSweepLevel(levelId),
    onSuccess: async (nextSession) => {
      queryClient.setQueryData(['todaySession'], nextSession)
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
        text: planner.notes.trim() || t('today.session.entryJournal.defaultText'),
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
      setSuccessMessage(t('today.session.entryJournal.saved'))
      await queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || t('today.session.entryJournal.saveError'))
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

  const selectedSweepLevel = useMemo(
    () => sessionLevels.find((item) => item.id === activeSweepLevelId) || null,
    [activeSweepLevelId, sessionLevels]
  )

  const effectiveRiskInProfile = manualRisk ?? convertedRiskSnapshot ?? riskSnapshot.riskAmount

  const lockInComplete = useMemo(() => {
    const dailyMaxLoss = Number(session?.lossLimit ?? 0)
    const maxTrades = Number(session?.maxTrades ?? 0)
    return Boolean(
      lockIn.session
      && Number.isFinite(dailyMaxLoss)
      && dailyMaxLoss > 0
      && Number.isFinite(maxTrades)
      && maxTrades > 0
      && lockIn.bias
      && lockIn.biasReason.trim().length > 0
    )
  }, [lockIn, session?.lossLimit, session?.maxTrades])

  const invalidationWritten = planner.invalidation.trim().length > 0
  const rrMet = (riskSnapshot.rEstimate ?? 0) >= RR_THRESHOLD
  const prereqStatus = getChecklistCompletion(prereqChecklist)
  const triggerStatus = getChecklistCompletion(triggerChecklist)
  const prerequisitesComplete = prereqStatus.isComplete
  const triggersComplete = triggerStatus.isComplete
  const prerequisiteCount = prereqStatus.completedRequired
  const triggerCount = triggerStatus.completedRequired

  const newsCheckItem = prereqChecklist.find((item) => item.text.toLowerCase().includes('news check'))
  const redNewsItem = prereqChecklist.find((item) => item.text.toLowerCase().includes('red news'))
  const newsSafe = !newsCheckItem || (newsCheckItem.completed && !(redNewsItem?.value || '').trim())

  const setupQualityChecks = [lockInComplete, prerequisitesComplete, triggersComplete, rrMet, newsSafe]
  const setupQualityScore = Math.round((setupQualityChecks.filter(Boolean).length / setupQualityChecks.length) * 100)
  const suggestedSetupGrade = setupQualityScore >= 95 ? 'A+' : (setupQualityScore >= 75 ? 'A' : 'B')

  const canMeetExecutionGate = lockInComplete && prerequisitesComplete && triggersComplete && invalidationWritten && rrMet
  const canSessionTrade = Boolean(session && session.status === 'ACTIVE' && !session.activeTrade)
  const canStartTrade = canSessionTrade && canMeetExecutionGate
  const canScheduleTrade = canSessionTrade && canMeetExecutionGate

  const missingLockInItems = [
    !lockIn.session ? t('today.session.requirements.lockInSessionSelection') : null,
    !session?.lossLimit || Number(session.lossLimit) <= 0 ? t('today.session.requirements.lockInDailyMaxLoss') : null,
    !session?.maxTrades || Number(session.maxTrades) <= 0 ? t('today.session.requirements.lockInMaxTrades') : null,
    !lockIn.bias ? t('today.session.requirements.lockInBias') : null,
    !lockIn.biasReason.trim() ? t('today.session.requirements.lockInBiasReason') : null
  ].filter(Boolean) as string[]

  const missingPrereqs = prereqChecklist
    .filter((item) => item.required && !item.completed)
    .map((item) => item.text)

  const missingTriggers = [
    ...triggerChecklist
      .filter((item) => item.required && !item.completed)
      .map((item) => item.text),
    ...(!rrMet ? [`RR >= ${RR_THRESHOLD.toFixed(1)}R`] : [])
  ]

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

  const handleSaveSessionSettings = async () => {
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
    setSettingsEditOpen(false)
    setSuccessMessage(t('today.session.lockIn.settingsSaved'))
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
      setApiError(t('today.session.screenshots.onlyImages'))
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
      setApiError((error as Error)?.message || t('today.session.screenshots.uploadError'))
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

  const persistChecklist = async (type: ChecklistTemplateType, items: SessionChecklistItem[]) => {
    const normalized = normalizeChecklistItems(items)
    if (type === 'PREREQS') {
      setPrereqChecklist(normalized)
    } else {
      setTriggerChecklist(normalized)
    }
    await checklistMutation.mutateAsync({ type, items: normalized, activeSweepLevelId: activeSweepLevelId || undefined })
  }

  const handleChecklistFieldChange = (
    type: ChecklistTemplateType,
    itemId: string,
    patch: Partial<SessionChecklistItem>,
    persist = false
  ) => {
    const source = type === 'PREREQS' ? prereqChecklist : triggerChecklist
    const next = source.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    if (type === 'PREREQS') {
      setPrereqChecklist(next)
    } else {
      setTriggerChecklist(next)
    }
    if (persist) {
      void persistChecklist(type, next)
    }
  }

  const handleOpenChecklistEditor = (type: ChecklistTemplateType) => {
    setChecklistEditDialog({
      open: true,
      type,
      items: normalizeChecklistItems(type === 'PREREQS' ? prereqChecklist : triggerChecklist)
    })
  }

  const handleSaveChecklistEditor = async () => {
    const items = normalizeChecklistItems(checklistEditDialog.items)
    if (items.some((item) => !item.text.trim())) {
      setApiError(t('today.session.templates.emptyChecklist'))
      return
    }
    await persistChecklist(checklistEditDialog.type, items)
    setChecklistEditDialog((prev) => ({ ...prev, open: false }))
    setSuccessMessage(t('today.session.checklist.refreshDone'))
  }

  const handleOpenTemplateDialog = (mode: 'import' | 'save', type: ChecklistTemplateType) => {
    setTemplateDialog({ open: true, mode, type })
    setSelectedImportTemplateId('')
    setTemplateNameDraft('')
    setTemplateDefaultDraft(false)
    setApiError('')
  }

  const handleImportTemplate = async () => {
    if (!selectedImportTemplateId) return
    if (!window.confirm(t('today.session.checklist.confirmImport'))) return
    await checklistMutation.mutateAsync({
      type: templateDialog.type,
      templateId: selectedImportTemplateId,
      activeSweepLevelId: activeSweepLevelId || undefined
    })
    setTemplateDialog((prev) => ({ ...prev, open: false }))
    setSuccessMessage(t('today.session.checklist.templateImported'))
  }

  const handleSaveTemplate = async () => {
    const targetItems = templateDialog.type === 'PREREQS' ? prereqChecklist : triggerChecklist
    if (!templateNameDraft.trim()) {
      setApiError(t('today.session.templates.nameRequired'))
      return
    }
    if (targetItems.length === 0) {
      setApiError(t('today.session.templates.emptyChecklist'))
      return
    }
    await createTemplateMutation.mutateAsync({
      name: templateNameDraft.trim(),
      type: templateDialog.type,
      isDefault: templateDefaultDraft,
      items: toChecklistTemplateItems(targetItems)
    })
    setTemplateDialog((prev) => ({ ...prev, open: false }))
    setSuccessMessage(t('today.session.checklist.templateSaved'))
  }

  const handleSetTemplateDefault = async (template: ChecklistTemplateResponse) => {
    await updateTemplateMutation.mutateAsync({
      id: template.id,
      payload: {
        name: template.name,
        type: template.type,
        isDefault: true,
        items: template.items
      }
    })
    setSuccessMessage(t('today.session.checklist.defaultTemplateSet'))
  }

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTemplateMutation.mutateAsync(templateId)
  }

  const openLevelDialog = (level?: SessionLevel) => {
    if (!level) {
      setLevelDialog({
        open: true,
        editId: null,
        label: 'PDH',
        customLabel: '',
        price: '',
        category: 'LIQUIDITY',
        notes: ''
      })
      return
    }

    const normalizedLabel = normalizeLevel(level.label)
    const matchedOption = LEVEL_LABEL_OPTIONS.find((option) => normalizeLevel(option) === normalizedLabel)
    setLevelDialog({
      open: true,
      editId: level.id,
      label: matchedOption || 'Custom',
      customLabel: matchedOption ? '' : level.label,
      price: level.price == null ? '' : String(level.price),
      category: level.category,
      notes: level.notes || ''
    })
  }

  const handleSaveLevel = async () => {
    const rawLabel = levelDialog.label === 'Custom' ? levelDialog.customLabel : levelDialog.label
    const label = rawLabel.trim()
    if (!label) return
    const payload = {
      label,
      price: levelDialog.price ? Number(levelDialog.price) : null,
      category: levelDialog.category,
      notes: levelDialog.notes || null
    }
    if (levelDialog.editId) {
      await updateLevelMutation.mutateAsync({ id: levelDialog.editId, payload })
    } else {
      await createLevelMutation.mutateAsync(payload)
    }
    setLevelDialog((prev) => ({ ...prev, open: false }))
  }

  const handleDeleteLevel = async (levelId: string) => {
    await deleteLevelMutation.mutateAsync(levelId)
  }

  const handleSetSweepLevel = async (levelId?: string | null) => {
    await setSweepLevelMutation.mutateAsync(levelId)
    setActiveSweepLevelId(levelId || null)
  }

  const handleMarkLevelSwept = async (level: SessionLevel, swept: boolean) => {
    await updateLevelMutation.mutateAsync({
      id: level.id,
      payload: {
        label: level.label,
        price: level.price ?? null,
        category: level.category,
        notes: level.notes ?? null,
        swept
      }
    })
  }

  const handleUseLevelPrice = async (target: 'entry' | 'sl' | 'tp', level: SessionLevel) => {
    let nextPrice = level.price ?? null
    if (nextPrice == null) {
      const input = window.prompt(t('today.session.levels.promptPrice'), '')
      if (!input) return
      const parsed = Number(input)
      if (!Number.isFinite(parsed) || parsed <= 0) return
      nextPrice = parsed
      await updateLevelMutation.mutateAsync({
        id: level.id,
        payload: {
          label: level.label,
          price: parsed,
          category: level.category,
          notes: level.notes ?? null
        }
      })
    }

    if (target === 'entry') {
      setPlanner((prev) => ({ ...prev, entryPrice: String(nextPrice) }))
      return
    }
    if (target === 'sl') {
      setPlanner((prev) => ({ ...prev, stopLossPrice: String(nextPrice) }))
      return
    }
    setPlanner((prev) => ({ ...prev, takeProfitPrice: String(nextPrice) }))
  }

  const handleSuggestLevelsFromPlan = async () => {
    const suggestions = parsePlanLevelSuggestions(selectedPlan)
    if (!suggestions.length) return
    const existing = new Set(sessionLevels.map((level) => normalizeLevel(level.label)))
    const missing = suggestions.filter((item) => !existing.has(normalizeLevel(item)))
    if (!missing.length) return
    await Promise.all(
      missing.map((label) => createLevelMutation.mutateAsync({
        label,
        category: 'LIQUIDITY',
        notes: null
      }))
    )
    setSuccessMessage(t('today.session.levels.suggested'))
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
      setApiError(t('today.session.errors.quantityAndEntryRequired'))
      return
    }

    if (isCrossCurrency && !fxRateForProfile) {
      setApiError(t('today.session.errors.fxRateRequired'))
      return
    }

    if (!planner.invalidation.trim()) {
      setApiError(t('today.session.errors.invalidationRequired'))
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
      entryJournalText: planner.notes.trim() || t('today.session.entryJournal.defaultText'),
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
      setApiError(t('today.session.errors.entryJournalRequired'))
      return
    }
    if (!entryJournalDraft.invalidation.trim()) {
      setApiError(t('today.session.errors.entryInvalidationRequired'))
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

  const handleSaveLockIn = async () => {
    const payload = {
      session: lockIn.session || null,
      objective: lockIn.objective || null,
      bias: lockIn.bias || null,
      biasReason: lockIn.biasReason.trim() || null
    }
    await lockInMutation.mutateAsync(payload)
    setSuccessMessage(t('today.session.lockIn.saved'))
  }

  const handleResetLockIn = async () => {
    setLockIn(DEFAULT_LOCK_IN_STATE)
    await lockInMutation.mutateAsync({
      session: null,
      objective: null,
      bias: null,
      biasReason: null
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

  const levelLabels = sessionLevels.map((item) => item.price == null ? item.label : `${item.label} ${formatNumber(item.price, 4)}`)
  const visibleKeyLevels = isMobileViewport ? levelLabels.slice(0, 3) : levelLabels
  const hiddenKeyLevelsCount = Math.max(0, levelLabels.length - visibleKeyLevels.length)

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
            {t('today.session.actions.executionFocus')}
          </Button>
          <Button
            variant={layoutState.preset === 'study' ? 'contained' : 'outlined'}
            startIcon={<SchoolRoundedIcon />}
            onClick={() => applyPreset('study')}
            size="small"
          >
            {t('today.session.actions.studyFocus')}
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
              { id: 1, label: t('today.session.steps.lockIn') },
              { id: 2, label: t('today.session.steps.checklist') },
              { id: 3, label: t('today.session.steps.chart') },
              { id: 4, label: t('today.session.steps.execute') }
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
                      <Typography variant="caption" color="text.secondary">{t('today.session.progress.subtitle')}</Typography>
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
                          <Typography variant="caption" color="text.secondary">{t('today.session.hints.checklist.short')}</Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('today.session.checklist.progressSummary', {
                            prereqs: `${prerequisiteCount}/${prereqStatus.requiredTotal}`,
                            triggers: `${triggerCount}/${triggerStatus.requiredTotal}`
                          })}
                        />
                      </Stack>
                      {renderPanelControls('checklist')}
                    </Stack>

                    {!isPanelCollapsed('checklist') && (
                      <>
                        <Box sx={{ p: 1.25, border: '1px solid', borderColor: lockInComplete ? 'success.light' : 'warning.light', borderRadius: 2 }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Typography variant="subtitle2">{t('today.session.lockIn.title')}</Typography>
                                <Tooltip title={t('today.session.hints.lockIn.short')}>
                                  <InfoOutlinedIcon fontSize="small" color="action" />
                                </Tooltip>
                              </Stack>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  size="small"
                                  color={lockInComplete ? 'success' : 'warning'}
                                  label={lockInComplete ? t('today.session.lockIn.locked') : t('today.session.lockIn.notLocked')}
                                />
                                <Button size="small" variant="text" onClick={() => setSettingsEditOpen(true)}>
                                  {t('today.session.lockIn.editSettings')}
                                </Button>
                                <Button size="small" variant="text" startIcon={<RestartAltRoundedIcon />} onClick={handleResetLockIn}>
                                  {t('today.session.lockIn.reset')}
                                </Button>
                              </Stack>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">{t('today.session.hints.lockIn.short')}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('today.session.hints.lockIn.long')}</Typography>

                            <Grid container spacing={1}>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  select
                                  size="small"
                                  label={t('today.session.lockIn.sessionLabel')}
                                  value={lockIn.session}
                                  onChange={(event) => {
                                    const sessionValue = event.target.value as LockInSession
                                    setLockIn((prev) => ({ ...prev, session: sessionValue }))
                                    setPlanner((prev) => ({ ...prev, session: sessionValue as 'LONDON' | 'NY_AM' | 'ASIA' | 'NY_PM' }))
                                  }}
                                  fullWidth
                                >
                                  <MenuItem value="">{t('today.session.lockIn.selectSession')}</MenuItem>
                                  {LOCK_IN_SESSION_OPTIONS.map((sessionValue) => (
                                    <MenuItem key={sessionValue} value={sessionValue}>
                                      {t(`trades.form.sessions.${sessionValue}`)}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  size="small"
                                  label={t('today.session.lockIn.dailyMaxLoss')}
                                  value={formatCurrency(Number(session.lossLimit || 0), profileCurrency)}
                                  InputProps={{ readOnly: true }}
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  size="small"
                                  label={t('today.session.lockIn.maxTrades')}
                                  value={String(session.maxTrades || 0)}
                                  InputProps={{ readOnly: true }}
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                  <Button
                                    size="small"
                                    variant={lockIn.objective === 'A_PLUS_ONLY' ? 'contained' : 'outlined'}
                                    onClick={() => setLockIn((prev) => ({ ...prev, objective: 'A_PLUS_ONLY' }))}
                                  >
                                    {t('today.session.lockIn.objectiveAPlus')}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant={lockIn.objective === 'ONE_TRADE_MAX' ? 'contained' : 'outlined'}
                                    onClick={() => {
                                      setLockIn((prev) => ({ ...prev, objective: 'ONE_TRADE_MAX' }))
                                      setConfig((prev) => ({ ...prev, maxTrades: '1' }))
                                    }}
                                  >
                                    {t('today.session.lockIn.objectiveOne')}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant={lockIn.objective === 'TWO_TRADES_MAX' ? 'contained' : 'outlined'}
                                    onClick={() => {
                                      setLockIn((prev) => ({ ...prev, objective: 'TWO_TRADES_MAX' }))
                                      setConfig((prev) => ({ ...prev, maxTrades: '2' }))
                                    }}
                                  >
                                    {t('today.session.lockIn.objectiveTwo')}
                                  </Button>
                                </Stack>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  select
                                  size="small"
                                  label={t('today.session.lockIn.biasLabel')}
                                  value={lockIn.bias}
                                  onChange={(event) => setLockIn((prev) => ({ ...prev, bias: event.target.value as LockInBias }))}
                                  fullWidth
                                >
                                  <MenuItem value="">{t('today.session.lockIn.selectBias')}</MenuItem>
                                  <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                                  <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
                                  <MenuItem value="NEUTRAL">{t('today.session.lockIn.neutral')}</MenuItem>
                                </TextField>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  size="small"
                                  label={t('today.session.lockIn.biasReason')}
                                  value={lockIn.biasReason}
                                  onChange={(event) => setLockIn((prev) => ({ ...prev, biasReason: event.target.value.slice(0, 140) }))}
                                  fullWidth
                                  helperText={`${lockIn.biasReason.length}/140`}
                                />
                              </Grid>
                              <Grid item xs={12}>
                                <Button size="small" variant="contained" onClick={() => void handleSaveLockIn()} disabled={lockInMutation.isLoading}>
                                  {t('today.session.lockIn.save')}
                                </Button>
                              </Grid>
                            </Grid>
                          </Stack>
                        </Box>

                        <Accordion defaultExpanded>
                          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', pr: 1 }}>
                              <Typography variant="body2">{t('today.session.checklist.prereqsTitle')}</Typography>
                              <Chip size="small" variant="outlined" label={`${prerequisiteCount}/${prereqStatus.requiredTotal}`} />
                              <Box sx={{ flex: 1 }} />
                              <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); handleOpenChecklistEditor('PREREQS') }}>
                                {t('today.session.checklist.editPrereqs')}
                              </Button>
                              <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); handleOpenTemplateDialog('save', 'PREREQS') }}>
                                {t('today.session.checklist.saveTemplate')}
                              </Button>
                              <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); handleOpenTemplateDialog('import', 'PREREQS') }}>
                                {t('today.session.checklist.importTemplate')}
                              </Button>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1.2}>
                              <Typography variant="caption" color="text.secondary">{t('today.session.hints.prereqsEditor')}</Typography>
                              {prereqChecklist.map((item) => (
                                <Box key={item.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                                  <FormControlLabel
                                    control={(
                                      <Checkbox
                                        checked={item.completed}
                                        onChange={(event) => handleChecklistFieldChange('PREREQS', item.id, { completed: event.target.checked }, true)}
                                      />
                                    )}
                                    label={`${item.text}${item.required ? ' *' : ''}`}
                                  />
                                  {item.hasValue && (
                                    <TextField
                                      size="small"
                                      type={item.valueType === 'NUMBER' ? 'number' : (item.valueType === 'TIME' ? 'time' : 'text')}
                                      label={item.valueLabel || t('today.session.checklist.value')}
                                      value={item.value || ''}
                                      onChange={(event) => handleChecklistFieldChange('PREREQS', item.id, { value: event.target.value }, true)}
                                      fullWidth
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                  {item.hasNote && (
                                    <TextField
                                      size="small"
                                      label={item.notePlaceholder || t('today.session.checklist.note')}
                                      value={item.note || ''}
                                      onChange={(event) => handleChecklistFieldChange('PREREQS', item.id, { note: event.target.value }, true)}
                                      fullWidth
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                </Box>
                              ))}
                              {!invalidationWritten && (
                                <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => invalidationFieldRef.current?.focus()}>
                                  {t('today.session.checklist.goToInvalidation')}
                                </Button>
                              )}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>

                        <Accordion defaultExpanded={Boolean(selectedStrategy) || !isMobileViewport}>
                          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', pr: 1 }}>
                              <Typography variant="body2">
                                {t('today.session.checklist.triggersTitle')} {selectedStrategy ? `(${selectedStrategy.name})` : `(${t('today.session.checklist.generic')})`}
                              </Typography>
                              <Chip size="small" variant="outlined" label={`${triggerCount}/${triggerStatus.requiredTotal}`} />
                              <Box sx={{ flex: 1 }} />
                              <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); handleOpenChecklistEditor('TRIGGERS') }}>
                                {t('today.session.checklist.editTriggers')}
                              </Button>
                              <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); handleOpenTemplateDialog('save', 'TRIGGERS') }}>
                                {t('today.session.checklist.saveTemplate')}
                              </Button>
                              <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); handleOpenTemplateDialog('import', 'TRIGGERS') }}>
                                {t('today.session.checklist.importTemplate')}
                              </Button>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1.2}>
                              <Typography variant="caption" color="text.secondary">{t('today.session.hints.triggersEditor')}</Typography>
                              {!selectedStrategy && (
                                <Alert severity="info" sx={{ mb: 1 }}>
                                  {t('today.session.checklist.strategyHint')}
                                </Alert>
                              )}
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                                <Button size="small" variant="outlined" onClick={() => setPricePickerTarget('sweep')}>
                                  {t('today.session.levels.selectSweep')}
                                </Button>
                                <Typography variant="caption" color="text.secondary">
                                  {selectedSweepLevel ? t('today.session.levels.selectedSweep', { label: selectedSweepLevel.label }) : t('today.session.levels.noSweep')}
                                </Typography>
                              </Stack>
                              {triggerChecklist.map((item) => (
                                <Box key={item.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                                  <FormControlLabel
                                    control={(
                                      <Checkbox
                                        checked={item.completed}
                                        onChange={(event) => handleChecklistFieldChange('TRIGGERS', item.id, { completed: event.target.checked }, true)}
                                      />
                                    )}
                                    label={`${item.text}${item.required ? ' *' : ''}`}
                                  />
                                  {item.hasValue && (
                                    <TextField
                                      size="small"
                                      type={item.valueType === 'NUMBER' ? 'number' : (item.valueType === 'TIME' ? 'time' : 'text')}
                                      label={item.valueLabel || t('today.session.checklist.value')}
                                      value={item.value || ''}
                                      onChange={(event) => handleChecklistFieldChange('TRIGGERS', item.id, { value: event.target.value }, true)}
                                      fullWidth
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                  {item.hasNote && (
                                    <TextField
                                      size="small"
                                      label={item.notePlaceholder || t('today.session.checklist.note')}
                                      value={item.note || ''}
                                      onChange={(event) => handleChecklistFieldChange('TRIGGERS', item.id, { note: event.target.value }, true)}
                                      fullWidth
                                      sx={{ mt: 0.5 }}
                                    />
                                  )}
                                </Box>
                              ))}
                              <FormControlLabel
                                control={<Checkbox checked={rrMet} disabled />}
                                label={`${t('today.session.checklist.rrRule')} (>= ${RR_THRESHOLD}R)`}
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
              <Card sx={{ minHeight: { xs: 'clamp(320px, 48vh, 420px)', md: 'clamp(420px, 48vh, 560px)' } }}>
                <CardContent sx={{ display: 'grid', gap: 1.25 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CandlestickChartRoundedIcon color="primary" fontSize="small" />
                      <Box>
                        <Typography variant="subtitle1">{t('today.session.layout.liveChart')}</Typography>
                        <Typography variant="caption" color="text.secondary">{t('today.session.hints.chart.short')}</Typography>
                      </Box>
                    </Stack>
                    {renderPanelControls('chart')}
                  </Stack>

                  {!isPanelCollapsed('chart') && (
                    <>
                      <Box sx={{ p: 1.1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Stack spacing={1}>
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ md: 'center' }}>
                            <Chip size="small" label={`${t('today.session.chart.bias')}: ${lockIn.bias || t('common.na')}`} />
                            <Chip size="small" label={`${t('today.session.chart.session')}: ${lockIn.session || t('common.na')}`} />
                            <Chip size="small" label={`${t('today.session.chart.local')}: ${localNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                            <Chip size="small" color={newsSafe ? 'success' : 'warning'} label={newsSafe ? t('today.session.chart.newsSafe') : t('today.session.chart.newsCaution')} />
                            {selectedSweepLevel && (
                              <Chip
                                size="small"
                                color="info"
                                label={t('today.session.levels.selectedSweep', { label: selectedSweepLevel.label })}
                              />
                            )}
                          </Stack>

                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            {visibleKeyLevels.map((level) => (
                              <Chip key={level} label={level} size="small" />
                            ))}
                            {hiddenKeyLevelsCount > 0 && (
                              <Chip size="small" variant="outlined" label={`+${hiddenKeyLevelsCount} ${t('today.session.chart.more')}`} />
                            )}
                          </Stack>

                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                            <Button size="small" variant="outlined" onClick={() => openLevelDialog()}>
                              {t('today.session.levels.add')}
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => void handleSuggestLevelsFromPlan()}>
                              {t('today.session.levels.suggestFromPlan')}
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<PhotoCameraBackRoundedIcon />} onClick={() => setScreenshotDialogOpen(true)}>
                              {t('today.session.chart.attachScreenshot')}
                            </Button>
                            <Button size="small" variant="outlined" onClick={focusMentorPanel}>{t('today.session.chart.openMentor')}</Button>
                            <Button size="small" variant="outlined" startIcon={<CenterFocusStrongRoundedIcon />} onClick={() => applyPreset('execution')}>
                              {t('today.session.actions.executionFocus')}
                            </Button>
                          </Stack>

                          <Stack spacing={0.75}>
                            {sessionLevels.length === 0 ? (
                              <Typography variant="caption" color="text.secondary">{t('today.session.levels.empty')}</Typography>
                            ) : (
                              sessionLevels.map((level) => (
                                <Box
                                  key={level.id}
                                  sx={{ p: 0.9, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                                >
                                  <Stack spacing={0.8}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }} justifyContent="space-between">
                                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <Chip size="small" label={level.label} />
                                        {level.price != null && (
                                          <Chip size="small" variant="outlined" label={formatNumber(level.price, 4)} />
                                        )}
                                        <Chip size="small" variant="outlined" label={t(`today.session.levels.categories.${level.category}`)} />
                                        {level.sweptAt && (
                                          <Chip size="small" color="success" label={t('today.session.levels.swept')} />
                                        )}
                                      </Stack>
                                      <Stack direction="row" spacing={0.5}>
                                        <Tooltip title={t('today.session.levels.edit')}>
                                          <IconButton size="small" onClick={() => openLevelDialog(level)}>
                                            <InfoOutlinedIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title={t('today.session.levels.delete')}>
                                          <IconButton size="small" onClick={() => void handleDeleteLevel(level.id)}>
                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </Stack>
                                    </Stack>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5} flexWrap="wrap" useFlexGap>
                                      <Button size="small" variant="text" onClick={() => void handleSetSweepLevel(level.id)}>
                                        {t('today.session.levels.setSweep')}
                                      </Button>
                                      <Button size="small" variant="text" onClick={() => void handleUseLevelPrice('entry', level)}>
                                        {t('today.session.levels.useAsEntry')}
                                      </Button>
                                      <Button size="small" variant="text" onClick={() => void handleUseLevelPrice('sl', level)}>
                                        {t('today.session.levels.useAsSl')}
                                      </Button>
                                      <Button size="small" variant="text" onClick={() => void handleUseLevelPrice('tp', level)}>
                                        {t('today.session.levels.useAsTp')}
                                      </Button>
                                      <Button size="small" variant="text" onClick={() => void handleMarkLevelSwept(level, !level.sweptAt)}>
                                        {level.sweptAt ? t('today.session.levels.unmarkSwept') : t('today.session.levels.markSwept')}
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Box>
                              ))
                            )}
                          </Stack>
                        </Stack>
                      </Box>

                      <TradingViewWidget
                        symbol={chartSymbol}
                        interval={chartInterval}
                        themePreference={chartTheme}
                        hideControls={chartHideControls}
                        allowSymbolChange={chartAllowSymbolChange}
                        minHeight={isCompactViewport ? 320 : 440}
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
                                      <Typography variant="caption" color="text.secondary">{t('today.session.mentor.biasSummary')}</Typography>
                                      <Typography variant="body2">{selectedPlan.biasSummary || selectedPlan.summary || t('today.session.mentor.emptySummary')}</Typography>
                                    </Box>
                                  </Grid>
                                  <Grid item xs={12} sm={6}>
                                    <Box sx={{ p: 1.15, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                                      <Typography variant="caption" color="text.secondary">{t('today.session.mentor.keyLevels')}</Typography>
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
                              <Typography variant="caption" color="text.secondary">{t('today.session.hints.execute.short')}</Typography>
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
                                    label={t('today.session.planner.riskAmount')}
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
                              {effectiveRiskInProfile !== null && Number(session.lossLimit || 0) > 0 && effectiveRiskInProfile > Number(session.lossLimit) && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                  {t('today.session.planner.riskExceeds')}
                                </Alert>
                              )}
                            </Box>

                            <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>C) Prices</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {t('today.session.hints.execute.short')}
                              </Typography>
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
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          <Button size="small" onClick={() => setPricePickerTarget('entry')}>
                                            {t('today.session.levels.pickFromLevels')}
                                          </Button>
                                        </InputAdornment>
                                      )
                                    }}
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
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          <Button size="small" onClick={() => setPricePickerTarget('sl')}>
                                            {t('today.session.levels.pickFromLevels')}
                                          </Button>
                                        </InputAdornment>
                                      )
                                    }}
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
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          <Button size="small" onClick={() => setPricePickerTarget('tp')}>
                                            {t('today.session.levels.pickFromLevels')}
                                          </Button>
                                        </InputAdornment>
                                      )
                                    }}
                                  />
                                </Grid>

                                <Grid item xs={12}>
                                  <TextField
                                    label={t('today.session.planner.invalidation')}
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
                                  {t('today.session.planner.rrBlocked', { rr: RR_THRESHOLD.toFixed(1) })}
                                </Alert>
                              )}
                            </Box>

                            <Box sx={{ p: 1.1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                                <Typography variant="body2">{t('today.session.planner.setupQuality', { score: setupQualityScore, grade: suggestedSetupGrade })}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {t('today.session.planner.autoGradeHint')}
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
                                {t('today.session.planner.completeHint')}
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

      <Dialog open={settingsEditOpen} onClose={() => setSettingsEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('today.session.lockIn.editSettings')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <TextField
              label={t('today.session.config.profitTarget')}
              type="number"
              value={config.profitTarget}
              onChange={(event) => setConfig((prev) => ({ ...prev, profitTarget: event.target.value }))}
              fullWidth
            />
            <TextField
              label={t('today.session.config.lossLimit')}
              type="number"
              value={config.lossLimit}
              onChange={(event) => setConfig((prev) => ({ ...prev, lossLimit: event.target.value }))}
              fullWidth
            />
            <TextField
              label={t('today.session.config.maxTrades')}
              type="number"
              value={config.maxTrades}
              onChange={(event) => setConfig((prev) => ({ ...prev, maxTrades: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsEditOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => void handleSaveSessionSettings()}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={checklistEditDialog.open} onClose={() => setChecklistEditDialog((prev) => ({ ...prev, open: false }))} fullWidth maxWidth="md">
        <DialogTitle>
          {checklistEditDialog.type === 'PREREQS'
            ? t('today.session.checklist.editPrereqs')
            : t('today.session.checklist.editTriggers')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {checklistEditDialog.items.map((item, index) => (
              <Box key={item.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                <Stack spacing={1}>
                  <TextField
                    size="small"
                    label={t('today.session.checklist.itemLabel')}
                    value={item.text}
                    onChange={(event) => {
                      const next = [...checklistEditDialog.items]
                      next[index] = { ...next[index], text: event.target.value }
                      setChecklistEditDialog((prev) => ({ ...prev, items: next }))
                    }}
                    fullWidth
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={item.required}
                          onChange={(event) => {
                            const next = [...checklistEditDialog.items]
                            next[index] = { ...next[index], required: event.target.checked }
                            setChecklistEditDialog((prev) => ({ ...prev, items: next }))
                          }}
                        />
                      )}
                      label={t('today.session.checklist.required')}
                    />
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={item.hasNote}
                          onChange={(event) => {
                            const next = [...checklistEditDialog.items]
                            next[index] = { ...next[index], hasNote: event.target.checked }
                            setChecklistEditDialog((prev) => ({ ...prev, items: next }))
                          }}
                        />
                      )}
                      label={t('today.session.checklist.hasNote')}
                    />
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={item.hasValue}
                          onChange={(event) => {
                            const next = [...checklistEditDialog.items]
                            next[index] = { ...next[index], hasValue: event.target.checked }
                            setChecklistEditDialog((prev) => ({ ...prev, items: next }))
                          }}
                        />
                      )}
                      label={t('today.session.checklist.hasValue')}
                    />
                  </Stack>
                  {item.hasNote && (
                    <TextField
                      size="small"
                      label={t('today.session.checklist.notePlaceholder')}
                      value={item.notePlaceholder || ''}
                      onChange={(event) => {
                        const next = [...checklistEditDialog.items]
                        next[index] = { ...next[index], notePlaceholder: event.target.value }
                        setChecklistEditDialog((prev) => ({ ...prev, items: next }))
                      }}
                      fullWidth
                    />
                  )}
                  {item.hasValue && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                      <TextField
                        size="small"
                        label={t('today.session.checklist.valueLabel')}
                        value={item.valueLabel || ''}
                        onChange={(event) => {
                          const next = [...checklistEditDialog.items]
                          next[index] = { ...next[index], valueLabel: event.target.value }
                          setChecklistEditDialog((prev) => ({ ...prev, items: next }))
                        }}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        select
                        size="small"
                        label={t('today.session.checklist.valueType')}
                        value={item.valueType}
                        onChange={(event) => {
                          const next = [...checklistEditDialog.items]
                          next[index] = { ...next[index], valueType: event.target.value as ChecklistValueType }
                          setChecklistEditDialog((prev) => ({ ...prev, items: next }))
                        }}
                        sx={{ minWidth: 140 }}
                      >
                        {CHECKLIST_VALUE_TYPES.map((valueType) => (
                          <MenuItem key={valueType} value={valueType}>{t(`today.session.checklist.valueTypes.${valueType}`)}</MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  )}
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => setChecklistEditDialog((prev) => ({ ...prev, items: reorderItems(prev.items, index, -1) }))}>
                      <ArrowUpwardRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setChecklistEditDialog((prev) => ({ ...prev, items: reorderItems(prev.items, index, 1) }))}>
                      <ArrowDownwardRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setChecklistEditDialog((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
            <Button
              size="small"
              variant="outlined"
              onClick={() => setChecklistEditDialog((prev) => ({ ...prev, items: [...prev.items, emptyChecklistItem(prev.items.length)] }))}
            >
              {t('today.session.checklist.addItem')}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChecklistEditDialog((prev) => ({ ...prev, open: false }))}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => void handleSaveChecklistEditor()}>{t('today.session.checklist.saveChanges')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={templateDialog.open} onClose={() => setTemplateDialog((prev) => ({ ...prev, open: false }))} fullWidth maxWidth="sm">
        <DialogTitle>
          {templateDialog.mode === 'save'
            ? t('today.session.checklist.saveTemplate')
            : t('today.session.checklist.importTemplate')}
        </DialogTitle>
        <DialogContent dividers>
          {templateDialog.mode === 'save' ? (
            <Stack spacing={1}>
              <TextField
                size="small"
                label={t('today.session.checklist.templateName')}
                value={templateNameDraft}
                onChange={(event) => setTemplateNameDraft(event.target.value)}
                fullWidth
              />
              <FormControlLabel
                control={<Checkbox checked={templateDefaultDraft} onChange={(event) => setTemplateDefaultDraft(event.target.checked)} />}
                label={t('today.session.checklist.setDefault')}
              />
            </Stack>
          ) : (
            <Stack spacing={1}>
              <TextField
                select
                size="small"
                label={t('today.session.checklist.importTemplate')}
                value={selectedImportTemplateId}
                onChange={(event) => setSelectedImportTemplateId(event.target.value)}
                fullWidth
              >
                {activeTemplates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}{template.isDefault ? ` (${t('today.session.checklist.defaultTemplate')})` : ''}
                  </MenuItem>
                ))}
              </TextField>
              {activeTemplates.map((template) => (
                <Stack key={`${template.id}-actions`} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">{template.name}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" variant="text" onClick={() => void handleSetTemplateDefault(template)}>
                      {t('today.session.checklist.setDefault')}
                    </Button>
                    <Button size="small" color="error" variant="text" onClick={() => void handleDeleteTemplate(template.id)}>
                      {t('common.delete')}
                    </Button>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog((prev) => ({ ...prev, open: false }))}>{t('common.cancel')}</Button>
          {templateDialog.mode === 'save' ? (
            <Button variant="contained" onClick={() => void handleSaveTemplate()}>{t('today.session.checklist.saveTemplate')}</Button>
          ) : (
            <Button variant="contained" onClick={() => void handleImportTemplate()}>{t('today.session.checklist.importAction')}</Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={levelDialog.open} onClose={() => setLevelDialog((prev) => ({ ...prev, open: false }))} fullWidth maxWidth="sm" fullScreen={isMobileViewport}>
        <DialogTitle>{levelDialog.editId ? t('today.session.levels.edit') : t('today.session.levels.add')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <TextField
              select
              size="small"
              label={t('today.session.levels.label')}
              value={levelDialog.label}
              onChange={(event) => setLevelDialog((prev) => ({ ...prev, label: event.target.value }))}
              fullWidth
            >
              {LEVEL_LABEL_OPTIONS.map((label) => (
                <MenuItem key={label} value={label}>{label}</MenuItem>
              ))}
            </TextField>
            {levelDialog.label === 'Custom' && (
              <TextField
                size="small"
                label={t('today.session.levels.customLabel')}
                value={levelDialog.customLabel}
                onChange={(event) => setLevelDialog((prev) => ({ ...prev, customLabel: event.target.value }))}
                fullWidth
              />
            )}
            <TextField
              size="small"
              type="number"
              label={t('today.session.levels.price')}
              value={levelDialog.price}
              onChange={(event) => setLevelDialog((prev) => ({ ...prev, price: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              size="small"
              label={t('today.session.levels.category')}
              value={levelDialog.category}
              onChange={(event) => setLevelDialog((prev) => ({ ...prev, category: event.target.value as SessionLevelCategory }))}
              fullWidth
            >
              {LEVEL_CATEGORY_OPTIONS.map((category) => (
                <MenuItem key={category} value={category}>{t(`today.session.levels.categories.${category}`)}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label={t('today.session.levels.notes')}
              value={levelDialog.notes}
              onChange={(event) => setLevelDialog((prev) => ({ ...prev, notes: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLevelDialog((prev) => ({ ...prev, open: false }))}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => void handleSaveLevel()}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(pricePickerTarget)} onClose={() => setPricePickerTarget(null)} fullWidth maxWidth="sm" fullScreen={isMobileViewport}>
        <DialogTitle>{t('today.session.levels.pickFromLevels')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {sessionLevels.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('today.session.levels.empty')}</Typography>
            ) : (
              sessionLevels.map((level) => (
                <Button
                  key={`${pricePickerTarget || 'none'}-${level.id}`}
                  variant="outlined"
                  onClick={async () => {
                    if (pricePickerTarget === 'sweep') {
                      await handleSetSweepLevel(level.id)
                      const sweepIndex = findSweepChecklistItemIndex(triggerChecklist)
                      if (sweepIndex >= 0 && !triggerChecklist[sweepIndex].completed && window.confirm(t('today.session.levels.autoCheckSweepPrompt'))) {
                        const next = triggerChecklist.map((item, index) => index === sweepIndex ? { ...item, completed: true } : item)
                        await persistChecklist('TRIGGERS', next)
                      }
                    } else if (pricePickerTarget) {
                      await handleUseLevelPrice(pricePickerTarget, level)
                    }
                    setPricePickerTarget(null)
                  }}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <span>{level.label}</span>
                  <span>{level.price == null ? t('common.na') : formatNumber(level.price, 4)}</span>
                </Button>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPricePickerTarget(null)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={missingModalOpen} onClose={() => setMissingModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('today.session.requirements.title')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="subtitle2">{t('today.session.steps.lockIn')}</Typography>
              {missingLockInItems.length === 0 ? (
                <Typography variant="body2" color="success.main">{t('today.session.requirements.complete')}</Typography>
              ) : (
                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                  {missingLockInItems.map((item) => (
                    <Typography key={item} variant="body2">• {item}</Typography>
                  ))}
                </Stack>
              )}
            </Box>
            <Box>
              <Typography variant="subtitle2">{t('today.session.requirements.prereqs')}</Typography>
              {missingPrereqs.length === 0 ? (
                <Typography variant="body2" color="success.main">{t('today.session.requirements.complete')}</Typography>
              ) : (
                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                  {missingPrereqs.map((item) => (
                    <Typography key={item} variant="body2">• {item}</Typography>
                  ))}
                </Stack>
              )}
            </Box>
            <Box>
              <Typography variant="subtitle2">{t('today.session.requirements.triggers')}</Typography>
              {missingTriggers.length === 0 ? (
                <Typography variant="body2" color="success.main">{t('today.session.requirements.complete')}</Typography>
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
        <DialogTitle>{t('today.session.screenshots.title')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">{t('today.session.screenshots.subtitle')}</Typography>
            <Button variant="outlined" component="label" disabled={uploadingScreenshot}>
              {uploadingScreenshot ? t('today.session.screenshots.uploading') : t('today.session.screenshots.choose')}
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
              aria-label={t('today.session.screenshots.pasteLabel')}
              tabIndex={0}
              onPaste={(event) => void handlePasteScreenshots(event)}
              sx={{ p: 1.25, border: '1px dashed', borderColor: 'divider', borderRadius: 2, minHeight: 80 }}
            >
              <Typography variant="caption" color="text.secondary">{t('today.session.screenshots.pasteHint')}</Typography>
            </Box>
            <Stack spacing={0.75}>
              {attachedScreenshots.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t('today.session.screenshots.empty')}</Typography>
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
        <DialogTitle>{t('today.session.entryJournal.title')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <TextField
              label={t('today.session.entryJournal.whatSaw')}
              value={entryJournalDraft.text}
              onChange={(event) => setEntryJournalDraft((prev) => ({ ...prev, text: event.target.value.slice(0, 280) }))}
              fullWidth
              multiline
              minRows={2}
              required
            />
            <TextField
              label={t('today.session.entryJournal.invalidation')}
              value={entryJournalDraft.invalidation}
              onChange={(event) => setEntryJournalDraft((prev) => ({ ...prev, invalidation: event.target.value.slice(0, 200) }))}
              fullWidth
              required
            />
            <TextField
              select
              label={t('today.session.entryJournal.emotion')}
              value={entryJournalDraft.emotion}
              onChange={(event) => setEntryJournalDraft((prev) => ({ ...prev, emotion: event.target.value }))}
              fullWidth
            >
              {FEELING_OPTIONS.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" startIcon={<PhotoCameraBackRoundedIcon />} onClick={() => setScreenshotDialogOpen(true)}>
              {t('today.session.screenshots.attach')}
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
            {saveEntryJournalMutation.isLoading ? t('today.session.entryJournal.saving') : t('today.session.entryJournal.save')}
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

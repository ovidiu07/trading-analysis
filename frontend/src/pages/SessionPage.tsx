import { FormEvent, useEffect, useMemo, useState } from 'react'
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
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded'
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded'
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
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
  createChecklistTemplate,
  getTodaySession,
  listChecklistTemplates,
  saveTodaySessionConfig,
  startTradeFromSession,
  updateChecklistTemplate,
  updateTodaySessionChecklist,
  updateTodaySessionPlannedTickers,
  type SessionChecklistItem,
  type TodaySessionResponse
} from '../api/session'
import { resolveAssetUrl } from '../api/assets'
import { fetchChecklistTemplate, type ChecklistTemplateItem } from '../api/checklist'
import { listDailyPlans, type DailyPlan } from '../api/plans'
import { listStrategies } from '../api/strategies'
import { fetchFxRate } from '../api/fx'
import { FEELING_OPTIONS, RULE_BREAK_OPTIONS } from '../constants/tradeTaxonomy'
import { formatCurrency, formatNumber, formatSignedCurrency } from '../utils/format'

const SELECTED_PLAN_STORAGE_KEY = 'today.session.selectedPlanId'
const SESSION_LAYOUT_STORAGE_KEY = 'sessionMode.layoutState'
const SESSION_CHART_SYMBOL_KEY = 'sessionMode.chartSymbol'
const SESSION_CHART_INTERVAL_KEY = 'sessionMode.chartInterval'

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

const normalizeChecklistText = (value?: string | null) => {
  if (!value) return ''
  return value.trim().toLowerCase()
}

const mergeChecklistWithDefinition = (
  sessionItems: SessionChecklistItem[],
  definitionItems: ChecklistTemplateItem[]
): SessionChecklistItem[] => {
  if (!definitionItems.length) {
    return sessionItems
  }

  const completionById = new Map<string, boolean>()
  const completionByText = new Map<string, boolean>()

  sessionItems.forEach((item) => {
    completionById.set(item.id, item.completed)

    const textKey = normalizeChecklistText(item.text)
    if (textKey) {
      completionByText.set(textKey, Boolean(completionByText.get(textKey)) || item.completed)
    }
  })

  return definitionItems
    .filter((item) => item.enabled)
    .map((item) => {
      const idMatch = completionById.get(item.id)
      const textMatch = completionByText.get(normalizeChecklistText(item.text))
      return {
        id: item.id,
        text: item.text,
        completed: idMatch ?? textMatch ?? false
      }
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

const readSessionLayoutState = (): SessionLayoutState => {
  try {
    const raw = localStorage.getItem(SESSION_LAYOUT_STORAGE_KEY)
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
      maximized: parsed.maximized ?? null
    }
  } catch {
    return DEFAULT_LAYOUT_STATE
  }
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

type TemplateSaveMode = 'new' | 'overwrite'
type SessionPanelId = 'progress' | 'checklist' | 'chart' | 'mentor' | 'planner'

type SessionLayoutState = {
  collapsed: Record<SessionPanelId, boolean>
  maximized: SessionPanelId | null
}

const DEFAULT_LAYOUT_STATE: SessionLayoutState = {
  collapsed: {
    progress: false,
    checklist: false,
    chart: false,
    mentor: false,
    planner: false
  },
  maximized: null
}

export default function SessionPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const baseCurrency = user?.baseCurrency || 'USD'
  const isCompactViewport = useMediaQuery('(max-width:900px)')

  const [config, setConfig] = useState({
    profitTarget: '',
    lossLimit: '',
    maxTrades: ''
  })

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [tickerDraft, setTickerDraft] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState(() => localStorage.getItem(SELECTED_PLAN_STORAGE_KEY) || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [templateSaveMode, setTemplateSaveMode] = useState<TemplateSaveMode>('new')
  const [overwriteTemplateId, setOverwriteTemplateId] = useState('')
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [checklistItems, setChecklistItems] = useState<SessionChecklistItem[]>([])

  const [planner, setPlanner] = useState({
    symbol: '',
    direction: 'LONG' as 'LONG' | 'SHORT',
    quantity: '1',
    entryPrice: '',
    takeProfitPrice: '',
    stopLossPrice: '',
    tradeCurrency: baseCurrency,
    fxRateTradeToProfile: '',
    fxRateSource: 'MANUAL',
    session: 'LONDON' as 'ASIA' | 'LONDON' | 'NY_AM' | 'NY_PM',
    feeling: FEELING_OPTIONS[0] as string,
    setupGrade: 'A' as 'A' | 'B' | 'C',
    strategyKey: '',
    notes: ''
  })

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
  const [strategyPreviewExpanded, setStrategyPreviewExpanded] = useState(false)
  const [fxAutoFillLoading, setFxAutoFillLoading] = useState(false)
  const [layoutState, setLayoutState] = useState<SessionLayoutState>(() => readSessionLayoutState())
  const [chartSymbolMemory, setChartSymbolMemory] = useState(() => localStorage.getItem(SESSION_CHART_SYMBOL_KEY) || '')
  const [chartIntervalMemory, setChartIntervalMemory] = useState(() => localStorage.getItem(SESSION_CHART_INTERVAL_KEY) || '15')

  const sessionQuery = useQuery({
    queryKey: ['todaySession'],
    queryFn: () => getTodaySession(),
    refetchOnWindowFocus: true
  })

  const checklistDefinitionQuery = useQuery({
    queryKey: ['checklistTemplate'],
    queryFn: () => fetchChecklistTemplate(),
    refetchOnWindowFocus: true
  })

  const dailyPlansQuery = useQuery({
    queryKey: ['dailyPlans', 60],
    queryFn: () => listDailyPlans({ recentDays: 60 }),
    refetchOnWindowFocus: true
  })

  const templatesQuery = useQuery({
    queryKey: ['checklistTemplates'],
    queryFn: () => listChecklistTemplates(),
    refetchOnWindowFocus: true
  })

  const strategiesQuery = useQuery({
    queryKey: ['strategies', false],
    queryFn: () => listStrategies({ includeArchived: false })
  })

  const session = sessionQuery.data || null

  useEffect(() => {
    if (!session) {
      setChecklistItems([])
      return
    }

    const rawSessionItems = session.checklistItems || []
    if (session.checklistTemplateId) {
      setChecklistItems(rawSessionItems)
      return
    }

    const definitionItems = checklistDefinitionQuery.data || []
    const mergedItems = mergeChecklistWithDefinition(rawSessionItems, definitionItems)
    setChecklistItems(mergedItems)
  }, [checklistDefinitionQuery.data, session])

  useEffect(() => {
    if (!session) return
    if (planner.symbol) return
    if (!session.plannedTickers || session.plannedTickers.length === 0) return
    setPlanner((prev) => ({ ...prev, symbol: session.plannedTickers[0] }))
  }, [planner.symbol, session])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      void queryClient.invalidateQueries({ queryKey: ['todaySession'] })
      void queryClient.invalidateQueries({ queryKey: ['checklistTemplate'] })
      void queryClient.invalidateQueries({ queryKey: ['dailyPlans'] })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [queryClient])

  useEffect(() => {
    if (selectedPlanId) {
      localStorage.setItem(SELECTED_PLAN_STORAGE_KEY, selectedPlanId)
      return
    }
    localStorage.removeItem(SELECTED_PLAN_STORAGE_KEY)
  }, [selectedPlanId])

  useEffect(() => {
    localStorage.setItem(SESSION_LAYOUT_STORAGE_KEY, JSON.stringify(layoutState))
  }, [layoutState])

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

  const patchChecklistMutation = useMutation({
    mutationFn: updateTodaySessionChecklist,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todaySession'] }),
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] }),
        queryClient.invalidateQueries({ queryKey: ['checklistTemplate'] })
      ])
    }
  })

  const createTemplateMutation = useMutation({
    mutationFn: createChecklistTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] })
    }
  })

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; items: string[] } }) => updateChecklistTemplate(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] })
    }
  })

  const startTradeMutation = useMutation({
    mutationFn: startTradeFromSession,
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
      setApiError((error as Error)?.message || t('today.session.errors.startTrade'))
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

  useEffect(() => {
    setStrategyPreviewExpanded(false)
  }, [planner.strategyKey])

  const progress = session ? toSessionProgress(session) : { pnlProgress: 0, tradeProgress: 0 }

  const canStartTrade = Boolean(session && session.status === 'ACTIVE' && !session.activeTrade)

  const checklistCompletedCount = checklistItems.filter((item) => item.completed).length

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

    return {
      riskAmount,
      rEstimate
    }
  }, [planner.direction, planner.entryPrice, planner.quantity, planner.stopLossPrice, planner.takeProfitPrice])

  const convertedRiskSnapshot = useMemo(() => {
    if (!riskSnapshot.riskAmount || !fxRateForProfile) {
      return null
    }
    return riskSnapshot.riskAmount * fxRateForProfile
  }, [fxRateForProfile, riskSnapshot.riskAmount])

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

  const handleRefreshChecklist = async () => {
    await Promise.all([
      sessionQuery.refetch(),
      checklistDefinitionQuery.refetch()
    ])
    setSuccessMessage(t('today.session.checklist.refreshDone'))
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

  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    const nextItems = checklistItems.map((item) => item.id === itemId ? { ...item, completed } : item)
    setChecklistItems(nextItems)
    await patchChecklistMutation.mutateAsync({ items: nextItems })
  }

  const openSaveTemplateDialog = () => {
    setApiError('')
    setSaveTemplateName('')
    setTemplateSaveMode('new')
    setOverwriteTemplateId('')
    setSaveTemplateDialogOpen(true)
  }

  const handleSaveChecklistTemplate = async () => {
    const name = saveTemplateName.trim()
    if (!name) {
      setApiError(t('today.session.templates.nameRequired'))
      return
    }

    const items = checklistItems.map((item) => item.text)
    if (!items.length) {
      setApiError(t('today.session.templates.emptyChecklist'))
      return
    }

    if (templateSaveMode === 'overwrite') {
      if (!overwriteTemplateId) {
        setApiError(t('today.session.templates.selectOverwriteTarget'))
        return
      }
      await updateTemplateMutation.mutateAsync({
        id: overwriteTemplateId,
        payload: {
          name,
          items
        }
      })
    } else {
      await createTemplateMutation.mutateAsync({ name, items })
    }

    setSaveTemplateDialogOpen(false)
    setSuccessMessage(t('today.session.checklist.templateSaved'))
  }

  const handleImportTemplate = () => {
    if (!selectedTemplateId) return
    setImportConfirmOpen(true)
  }

  const handleConfirmImportTemplate = async () => {
    if (!selectedTemplateId) return
    await patchChecklistMutation.mutateAsync({ templateId: selectedTemplateId })
    setImportConfirmOpen(false)
    setSuccessMessage(t('today.session.checklist.templateImported'))
  }

  const handleStartTrade = async () => {
    if (!session) return
    if (!planner.symbol.trim()) {
      setApiError(t('today.session.errors.tickerRequired'))
      return
    }

    const quantity = Number(planner.quantity)
    const entryPrice = Number(planner.entryPrice)

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      setApiError(t('today.session.errors.quantityAndEntryRequired'))
      return
    }

    if (isCrossCurrency && !fxRateForProfile) {
      setApiError(t('today.session.errors.fxRateRequired'))
      return
    }

    const payload = {
      symbol: planner.symbol.trim().toUpperCase(),
      direction: planner.direction,
      quantity,
      entryPrice,
      takeProfitPrice: planner.takeProfitPrice ? Number(planner.takeProfitPrice) : null,
      stopLossPrice: planner.stopLossPrice ? Number(planner.stopLossPrice) : null,
      tradeCurrency: tradeCurrency,
      fxRateTradeToProfile: fxRateForProfile ?? undefined,
      fxRateSource: isCrossCurrency ? (planner.fxRateSource || 'MANUAL') : 'IDENTITY',
      session: planner.session,
      feeling: planner.feeling,
      setupGrade: planner.setupGrade,
      strategyId: selectedStrategy?.id,
      strategyTag: selectedStrategy ? selectedStrategy.name : undefined,
      linkedPlanId: selectedPlan?.id,
      initialNotes: planner.notes || undefined
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

  if (sessionQuery.isLoading) {
    return <LoadingState rows={8} height={26} />
  }

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
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
        <Button component={Link} to="/today" variant="outlined">
          {t('today.session.exit')}
        </Button>
      </Stack>

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
                    <Typography variant="subtitle2">{t('today.session.progress.title')}</Typography>
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
              gridTemplateColumns: layoutState.maximized ? '1fr' : { xs: '1fr', lg: 'minmax(280px, 0.85fr) minmax(0, 1.15fr)' },
              gap: 2,
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
                        <Typography variant="subtitle1">{t('today.session.checklist.title')}</Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t('today.session.checklist.progress', {
                            completed: checklistCompletedCount,
                            total: checklistItems.length
                          })}
                        />
                      </Stack>
                      {renderPanelControls('checklist')}
                    </Stack>
                    {!isPanelCollapsed('checklist') && (
                      <>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
                          <Tooltip title={t('today.session.checklist.refresh')}>
                            <IconButton onClick={() => void handleRefreshChecklist()} size="small" aria-label={t('today.session.checklist.refresh')}>
                              <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Button size="small" variant="outlined" onClick={openSaveTemplateDialog}>
                            {t('today.session.checklist.saveTemplate')}
                          </Button>

                          <TextField
                            select
                            size="small"
                            label={t('today.session.checklist.importTemplate')}
                            value={selectedTemplateId}
                            onChange={(event) => setSelectedTemplateId(event.target.value)}
                            sx={{ minWidth: { xs: '100%', sm: 220 } }}
                          >
                            <MenuItem value="">{t('common.none')}</MenuItem>
                            {(templatesQuery.data || []).map((template) => (
                              <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
                            ))}
                          </TextField>

                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleImportTemplate}
                            disabled={!selectedTemplateId}
                          >
                            {t('today.session.checklist.importAction')}
                          </Button>
                        </Stack>

                        {checklistItems.length === 0 ? (
                          <EmptyState
                            title={t('today.session.checklist.emptyTitle')}
                            description={t('today.session.checklist.emptyBody')}
                          />
                        ) : (
                          <Box
                            sx={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 1,
                              alignItems: 'stretch'
                            }}
                          >
                            {checklistItems.map((item) => (
                              <Box
                                key={item.id}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.75,
                                  minHeight: 40,
                                  px: 1.1,
                                  py: 0.4,
                                  border: '1px solid',
                                  borderColor: item.completed ? 'primary.main' : 'divider',
                                  bgcolor: item.completed ? 'action.selected' : 'background.paper',
                                  borderRadius: 999,
                                  maxWidth: '100%'
                                }}
                              >
                                <Checkbox
                                  size="small"
                                  checked={item.completed}
                                  onChange={(event) => void handleToggleChecklistItem(item.id, event.target.checked)}
                                />
                                <Typography
                                  variant="body2"
                                  sx={{
                                    overflowWrap: 'anywhere',
                                    textDecoration: item.completed ? 'line-through' : 'none',
                                    color: item.completed ? 'text.secondary' : 'text.primary'
                                  }}
                                >
                                  {item.text}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {(isPanelVisible('chart') || isPanelVisible('mentor') || isPanelVisible('planner')) && (
              <Box sx={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 2, minWidth: 0 }}>
                {isPanelVisible('chart') && (
                  <Card>
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CandlestickChartRoundedIcon color="primary" fontSize="small" />
                            <Typography variant="subtitle1">{t('today.session.layout.liveChart')}</Typography>
                          </Stack>
                          {renderPanelControls('chart')}
                        </Stack>
                        {!isPanelCollapsed('chart') && (
                          <TradingViewWidget
                            symbol={chartSymbol}
                            interval={chartInterval}
                            themePreference={chartTheme}
                            hideControls={chartHideControls}
                            allowSymbolChange={chartAllowSymbolChange}
                            minHeight={isCompactViewport ? 320 : 380}
                            fallbackMessage={t('today.session.mentor.liveChartFallback')}
                            fallbackLinkLabel={t('today.session.mentor.openOnTradingView')}
                          />
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {(isPanelVisible('mentor') || isPanelVisible('planner')) && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: layoutState.maximized ? '1fr' : { xs: '1fr', xl: 'minmax(0, 0.95fr) minmax(0, 1.05fr)' },
                      gap: 2,
                      minWidth: 0,
                      '& > *': { minWidth: 0 }
                    }}
                  >
                    {isPanelVisible('mentor') && (
                      <Card>
                        <CardContent>
                          <Stack spacing={1.5}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                              <Stack direction="row" spacing={1} alignItems="center">
                                <AutoStoriesRoundedIcon color="primary" fontSize="small" />
                                <Typography variant="subtitle1">{t('today.session.mentor.title')}</Typography>
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
                                    description={t('today.session.mentor.emptyBody')}
                                  />
                                ) : (
                                  <Stack spacing={1.25}>
                                    <Typography variant="h6" sx={{ fontSize: 18 }}>{selectedPlan.title}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {selectedPlan.summary || selectedPlan.biasSummary || t('today.session.mentor.emptySummary')}
                                    </Typography>

                                    {selectedPlanSnapshotUrl && (
                                      <Stack spacing={0.75}>
                                        <Typography variant="caption" color="text.secondary">
                                          {t('today.session.mentor.chartSnapshot')}
                                        </Typography>
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
                                              maxHeight: { xs: 260, md: 340 },
                                              objectFit: 'cover',
                                              borderRadius: 2,
                                              border: '1px solid',
                                              borderColor: 'divider'
                                            }}
                                          />
                                        </Box>
                                        {selectedPlan.snapshotCaption && (
                                          <Typography variant="caption" color="text.secondary">
                                            {selectedPlan.snapshotCaption}
                                          </Typography>
                                        )}
                                      </Stack>
                                    )}

                                    <Stack spacing={0.75}>
                                      <Typography variant="caption" color="text.secondary">
                                        {t('today.session.mentor.essentials')}
                                      </Typography>
                                      <Grid container spacing={1.1}>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                                            <Typography variant="caption" color="text.secondary">{t('today.session.mentor.biasSummary')}</Typography>
                                            <Typography variant="body2">{selectedPlan.biasSummary || selectedPlan.summary || t('today.session.mentor.emptySummary')}</Typography>
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                                            <Typography variant="caption" color="text.secondary">{t('today.session.mentor.keyLevels')}</Typography>
                                            {(selectedPlan.keyLevels || []).length === 0 ? (
                                              <Typography variant="body2" color="text.secondary">{t('today.session.mentor.noKeyLevels')}</Typography>
                                            ) : (
                                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                                                {(selectedPlan.keyLevels || []).map((level) => (
                                                  <Chip key={level} size="small" label={level} variant="outlined" />
                                                ))}
                                              </Stack>
                                            )}
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                                            <Typography variant="caption" color="text.secondary">{t('today.session.mentor.executionRules')}</Typography>
                                            {selectedPlanExecutionBullets.length === 0 ? (
                                              <Typography variant="body2" color="text.secondary">{t('today.session.mentor.noExecutionRules')}</Typography>
                                            ) : (
                                              <Stack spacing={0.35} sx={{ mt: 0.75 }}>
                                                {selectedPlanExecutionBullets.map((item, index) => (
                                                  <Typography key={`${item}-${index}`} variant="body2">{index + 1}. {item}</Typography>
                                                ))}
                                              </Stack>
                                            )}
                                          </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
                                            <Typography variant="caption" color="text.secondary">{t('today.session.mentor.riskNote')}</Typography>
                                            <Typography variant="body2">
                                              {selectedPlan.riskNote || t('today.session.mentor.noRiskNote')}
                                            </Typography>
                                          </Box>
                                        </Grid>
                                      </Grid>
                                    </Stack>

                                    {selectedPlanHasAdvanced && (
                                      <Accordion disableGutters defaultExpanded={false}>
                                        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                                          <Typography variant="body2">{t('today.session.mentor.advanced')}</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                          <Stack spacing={1.1}>
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
                                        </AccordionDetails>
                                      </Accordion>
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
                                <Typography variant="subtitle1">{t('today.session.planner.title')}</Typography>
                              </Stack>
                              {renderPanelControls('planner')}
                            </Stack>

                            {!isPanelCollapsed('planner') && (
                              <>
                                <Grid container spacing={1.5}>
                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      label={t('trades.form.symbol')}
                                      value={planner.symbol}
                                      onChange={(event) => setPlanner((prev) => ({ ...prev, symbol: event.target.value }))}
                                      fullWidth
                                      size="small"
                                      required
                                      helperText={t('today.session.form.requiredField')}
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
                                      required
                                      helperText={t('today.session.form.requiredField')}
                                    >
                                      <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                                      <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
                                    </TextField>
                                  </Grid>

                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      label={t('trades.form.quantity')}
                                      type="number"
                                      value={planner.quantity}
                                      onChange={(event) => setPlanner((prev) => ({ ...prev, quantity: event.target.value }))}
                                      fullWidth
                                      size="small"
                                      required
                                      helperText={t('today.session.form.requiredField')}
                                    />
                                  </Grid>
                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      select
                                      label={t('trades.form.session')}
                                      value={planner.session}
                                      onChange={(event) => setPlanner((prev) => ({ ...prev, session: event.target.value as 'ASIA' | 'LONDON' | 'NY_AM' | 'NY_PM' }))}
                                      fullWidth
                                      size="small"
                                      required
                                      helperText={t('today.session.form.requiredField')}
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
                                      helperText={t('today.session.form.requiredField')}
                                    >
                                      <MenuItem value="USD">USD</MenuItem>
                                      <MenuItem value="EUR">EUR</MenuItem>
                                    </TextField>
                                  </Grid>
                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      label={t('today.session.form.profileCurrency')}
                                      value={profileCurrency}
                                      fullWidth
                                      size="small"
                                      InputProps={{ readOnly: true }}
                                    />
                                  </Grid>

                                  {isCrossCurrency && (
                                    <Grid item xs={12}>
                                      <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                        <Stack
                                          direction={{ xs: 'column', sm: 'row' }}
                                          spacing={1}
                                          alignItems={{ xs: 'stretch', sm: 'center' }}
                                          justifyContent="space-between"
                                        >
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
                                            helperText={t('today.session.form.fxRateHint', {
                                              tradeCurrency,
                                              profileCurrency
                                            })}
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
                                      </Box>
                                    </Grid>
                                  )}

                                  <Grid item xs={12}>
                                    <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('today.session.form.pricesGroup')}</Typography>
                                      <Grid container spacing={1.25}>
                                        <Grid item xs={12} md={4}>
                                          <TextField
                                            label={t('trades.form.entryPrice')}
                                            type="number"
                                            value={planner.entryPrice}
                                            onChange={(event) => setPlanner((prev) => ({ ...prev, entryPrice: event.target.value }))}
                                            fullWidth
                                            size="small"
                                            required
                                            helperText={t('today.session.form.requiredField')}
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
                                            helperText={t('today.session.form.requiredField')}
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
                                            helperText={t('today.session.form.optionalField')}
                                          />
                                        </Grid>
                                      </Grid>

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
                                          {t('today.session.form.riskSnapshotConverted', {
                                            risk: formatCurrency(convertedRiskSnapshot, profileCurrency)
                                          })}
                                        </Typography>
                                      )}
                                    </Box>
                                  </Grid>

                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      select
                                      label={t('trades.form.setupGrade')}
                                      value={planner.setupGrade}
                                      onChange={(event) => setPlanner((prev) => ({ ...prev, setupGrade: event.target.value as 'A' | 'B' | 'C' }))}
                                      fullWidth
                                      size="small"
                                      required
                                      helperText={t('today.session.form.requiredField')}
                                    >
                                      <MenuItem value="A">A</MenuItem>
                                      <MenuItem value="B">B</MenuItem>
                                      <MenuItem value="C">C</MenuItem>
                                    </TextField>
                                  </Grid>

                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      select
                                      label={t('today.session.form.feeling')}
                                      value={planner.feeling}
                                      onChange={(event) => setPlanner((prev) => ({ ...prev, feeling: event.target.value }))}
                                      fullWidth
                                      size="small"
                                      helperText={t('today.session.form.optionalField')}
                                    >
                                      {FEELING_OPTIONS.map((item) => (
                                        <MenuItem key={item} value={item}>{item}</MenuItem>
                                      ))}
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
                                      helperText={t('today.session.form.optionalField')}
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

                                  <Grid item xs={12}>
                                    <TextField
                                      label={t('trades.form.notes')}
                                      value={planner.notes}
                                      onChange={(event) => setPlanner((prev) => ({ ...prev, notes: event.target.value }))}
                                      fullWidth
                                      size="small"
                                      multiline
                                      minRows={2}
                                      helperText={t('today.session.form.optionalField')}
                                    />
                                  </Grid>

                                  {selectedStrategy && (
                                    <Grid item xs={12}>
                                      <Box
                                        sx={{
                                          p: 1.2,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                          borderRadius: 2,
                                          maxHeight: strategyPreviewExpanded ? 540 : 320,
                                          overflowY: 'auto'
                                        }}
                                      >
                                        <Stack spacing={1}>
                                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Typography variant="subtitle2">{t('today.session.strategyDetails.title')}</Typography>
                                            <Button
                                              size="small"
                                              onClick={() => setStrategyPreviewExpanded((prev) => !prev)}
                                            >
                                              {strategyPreviewExpanded
                                                ? t('today.session.strategyDetails.showLess')
                                                : t('today.session.strategyDetails.showMore')}
                                            </Button>
                                          </Stack>

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

                                          <Typography variant="body1" sx={{ fontWeight: 700 }}>{selectedStrategy.name}</Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            {selectedStrategy.model}
                                          </Typography>

                                          <Box>
                                            <Typography variant="caption" color="text.secondary">
                                              {t('today.session.strategyDetails.entryConditions')}
                                            </Typography>
                                            {selectedStrategy.entryConditionsRich ? (
                                              <RichTextContent html={selectedStrategy.entryConditionsRich} />
                                            ) : (
                                              <Stack spacing={0.35} sx={{ mt: 0.6 }}>
                                                {(selectedStrategy.entryConditions || []).map((item) => (
                                                  <Typography key={item} variant="body2">• {item}</Typography>
                                                ))}
                                              </Stack>
                                            )}
                                          </Box>

                                          {strategyInvalidationBullets.length > 0 && (
                                            <Box>
                                              <Typography variant="caption" color="text.secondary">
                                                {t('today.session.strategyDetails.invalidation')}
                                              </Typography>
                                              <Stack spacing={0.35} sx={{ mt: 0.4 }}>
                                                {(strategyPreviewExpanded ? strategyInvalidationBullets : strategyInvalidationBullets.slice(0, 2)).map((item) => (
                                                  <Typography key={item} variant="body2">• {item}</Typography>
                                                ))}
                                              </Stack>
                                            </Box>
                                          )}

                                          {strategyManagementBullets.length > 0 && (
                                            <Box>
                                              <Typography variant="caption" color="text.secondary">
                                                {t('today.session.strategyDetails.management')}
                                              </Typography>
                                              <Stack spacing={0.35} sx={{ mt: 0.4 }}>
                                                {(strategyPreviewExpanded ? strategyManagementBullets : strategyManagementBullets.slice(0, 1)).map((item) => (
                                                  <Typography key={item} variant="body2">• {item}</Typography>
                                                ))}
                                              </Stack>
                                            </Box>
                                          )}

                                          {strategyNoTradeBullets.length > 0 && (
                                            <Box>
                                              <Typography variant="caption" color="text.secondary">
                                                {t('today.session.strategyDetails.noTradeRules')}
                                              </Typography>
                                              <Stack spacing={0.35} sx={{ mt: 0.4 }}>
                                                {(strategyPreviewExpanded ? strategyNoTradeBullets : strategyNoTradeBullets.slice(0, 1)).map((item) => (
                                                  <Typography key={item} variant="body2">• {item}</Typography>
                                                ))}
                                              </Stack>
                                            </Box>
                                          )}

                                          {(selectedStrategy.sessionSuitability || []).length > 0 && (
                                            <Box>
                                              <Typography variant="caption" color="text.secondary">
                                                {t('today.session.strategyDetails.sessionSuitability')}
                                              </Typography>
                                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
                                                {(strategyPreviewExpanded
                                                  ? (selectedStrategy.sessionSuitability || [])
                                                  : (selectedStrategy.sessionSuitability || []).slice(0, 3)).map((item) => (
                                                  <Chip key={item} size="small" label={item} variant="outlined" />
                                                ))}
                                              </Stack>
                                            </Box>
                                          )}

                                          {(selectedStrategy.tags || []).length > 0 && (
                                            <Box>
                                              <Typography variant="caption" color="text.secondary">
                                                {t('today.session.strategyDetails.tags')}
                                              </Typography>
                                              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
                                                {(strategyPreviewExpanded
                                                  ? (selectedStrategy.tags || [])
                                                  : (selectedStrategy.tags || []).slice(0, 4)).map((item) => (
                                                  <Chip key={item} size="small" label={item} />
                                                ))}
                                              </Stack>
                                            </Box>
                                          )}
                                        </Stack>
                                      </Box>
                                    </Grid>
                                  )}
                                </Grid>

                                <Divider />

                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddRoundedIcon />}
                                    onClick={() => setScheduleOpen((prev) => !prev)}
                                  >
                                    {t('today.session.planner.scheduleTrade')}
                                  </Button>

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
            )}
          </Box>
        </>
      )}

      <Dialog open={saveTemplateDialogOpen} onClose={() => setSaveTemplateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('today.session.checklist.saveTemplate')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.75 }}>
            <TextField
              label={t('today.session.checklist.templateName')}
              value={saveTemplateName}
              onChange={(event) => setSaveTemplateName(event.target.value)}
              fullWidth
              required
            />

            <RadioGroup
              value={templateSaveMode}
              onChange={(event) => setTemplateSaveMode(event.target.value as TemplateSaveMode)}
            >
              <FormControlLabel value="new" control={<Radio />} label={t('today.session.checklist.saveAsNew')} />
              <FormControlLabel value="overwrite" control={<Radio />} label={t('today.session.checklist.overwriteTemplate')} />
            </RadioGroup>

            {templateSaveMode === 'overwrite' && (
              <TextField
                select
                label={t('today.session.checklist.overwriteTemplate')}
                value={overwriteTemplateId}
                onChange={(event) => setOverwriteTemplateId(event.target.value)}
                fullWidth
              >
                <MenuItem value="">{t('common.none')}</MenuItem>
                {(templatesQuery.data || []).map((template) => (
                  <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveTemplateDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveChecklistTemplate()}
            disabled={createTemplateMutation.isLoading || updateTemplateMutation.isLoading}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importConfirmOpen} onClose={() => setImportConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('today.session.checklist.importTemplate')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('today.session.checklist.confirmImport')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => void handleConfirmImportTemplate()}>
            {t('today.session.checklist.importAction')}
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

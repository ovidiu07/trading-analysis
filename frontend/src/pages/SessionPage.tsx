import { ClipboardEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
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
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import ReplayCandlestickChart from '../components/charts/ReplayCandlestickChart'
import MarkdownContent from '../components/ui/MarkdownContent'
import RichTextContent from '../components/ui/RichTextContent'
import SecureAssetImage from '../components/assets/SecureAssetImage'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import {
  type BacktestDataSource,
  type BacktestDataset,
  type BacktestDatasetSummary,
  type BacktestRun,
  type BacktestTrade,
  type CsvColumnMapping,
  type CsvUploadResponse,
  createBacktestRun,
  getBacktestCandles,
  getBacktestDataset,
  getBacktestDatasetSummary,
  ingestBacktestCsv,
  getOandaProviderStatus,
  listBacktestDatasets,
  listBacktestTrades,
  loadDemoBacktestDatasets,
  simulateBacktestTrade,
  uploadBacktestCsv
} from '../api/backtest'
import { normalizeBacktestCandlesWithDiagnostics } from '../features/backtest/candleConverter'
import {
  isCsvMappingComplete,
  parseCsvPreview,
  resolveColumnKeyFromHeader,
  resolveHeaderFromColumnKey,
  type CsvPreviewColumn,
  type CsvPreviewResult
} from '../features/backtest/csvPreview'
import {
  createChartProfile,
  deleteChartProfile,
  listChartProfiles,
  setDefaultChartProfile,
  updateChartProfile,
  type ChartEmbedConfig,
  type ChartProfile
} from '../api/chartProfiles'
import {
  type AutoTradeEventType,
  type QuoteSide,
  type SessionAutoTradeEvent,
  createChecklistTemplate,
  createSessionLevel,
  closeTradeFromSession,
  deleteChecklistTemplate,
  deleteSessionLevel,
  deleteSessionPool,
  createSessionPool,
  getTodaySession,
  getSessionNarrative,
  listChecklistTemplates,
  listSessionAutoTradeEvents,
  listSessionPools,
  logSessionAutoTradeEvent,
  saveTodaySessionConfig,
  saveTradeEntryJournal,
  setSessionRoles,
  suggestSessionLevels,
  startTradeFromSession,
  updateSessionNarrative,
  updateSessionPool,
  updateChecklistTemplate,
  updateSessionLevel,
  updateTodaySessionChecklist,
  updateTodaySessionLockIn,
  updateTodaySessionPlannedTickers,
  type LevelStatus,
  type LevelTimeframe,
  type LevelType,
  type ChecklistTemplateResponse,
  type ChecklistTemplateType,
  type ChecklistValueType,
  type SessionChecklistItem,
  type SessionLevel,
  type SessionLevelCategory,
  type SessionLevelRequest,
  type SessionLevelSuggestion,
  type SessionNarrative,
  type SessionPool,
  type TodaySessionResponse
} from '../api/session'
import { fetchLiveQuote, type LiveQuoteResponse } from '../api/quotes'
import { uploadAsset, type AssetItem } from '../api/assets'
import { listDailyPlans, type DailyPlan } from '../api/plans'
import { listStrategies } from '../api/strategies'
import { fetchFxRate } from '../api/fx'
import { FEELING_OPTIONS, RULE_BREAK_OPTIONS } from '../constants/tradeTaxonomy'
import { formatCurrency, formatNumber, formatSignedCurrency } from '../utils/format'

const SELECTED_PLAN_STORAGE_KEY = 'today.session.selectedPlanId'
const SESSION_CHART_SYMBOL_KEY = 'sessionMode.chartSymbol'
const SESSION_CHART_INTERVAL_KEY = 'sessionMode.chartInterval'
const SESSION_CHART_PROFILE_KEY = 'sessionMode.chartProfile'
const SESSION_FOLLOW_PLAN_SYMBOL_KEY = 'sessionMode.followPlanSymbol'
const SESSION_CHART_MODE_KEY = 'sessionMode.chartMode'
const SESSION_AUTO_TRADE_KEY = 'sessionMode.autoTrade'
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
  initialSignature: string
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

type PoolDialogState = {
  open: boolean
  editId: string | null
  poolName: string
  symbol: string
  type: LevelType
  timeframe: LevelTimeframe
  zoneLow: string
  zoneHigh: string
  cleanlinessScore: string
  status: LevelStatus
  levelIds: string[]
  sweepRole: boolean
}

type SuggestedLevelItemBase = {
  label: string
  type: LevelType
  timeframe: LevelTimeframe
  reason: string
  confidence: number
}

type SuggestedPriceLevelItem = SuggestedLevelItemBase & {
  kind: 'PRICE'
  price: number
}

type SuggestedZoneLevelItem = SuggestedLevelItemBase & {
  kind: 'ZONE'
  zoneLow: number
  zoneHigh: number
}

type SuggestedReferenceLevelItem = SuggestedLevelItemBase & {
  kind: 'REFERENCE'
}

type SuggestedLevelItem = SuggestedPriceLevelItem | SuggestedZoneLevelItem | SuggestedReferenceLevelItem

type SessionChartMode = 'LIVE' | 'BACKTEST'

type BacktestSetupState = {
  dataSource: BacktestDataSource
  datasetId: string
  sourceId: string
  symbol: string
  timeframe: 'M1' | 'M5' | 'M15' | 'H1' | 'D1'
  from: string
  to: string
  sessionWindow: string
  spread: string
  slippage: string
}

type BacktestReplayState = 'IDLE' | 'LOADING' | 'READY' | 'EMPTY' | 'ERROR'

type AutoTradeLifecycleStatus = 'DISARMED' | 'ARMED' | 'ACTIVE' | 'CLOSED'

type AutoTradeUiEvent = SessionAutoTradeEvent & {
  localKey: string
}

type CsvUploadItem = CsvUploadResponse & {
  mappingDraft: CsvColumnMapping
  preview: CsvPreviewResult | null
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
const buildChartProfileStorageKey = (userId?: string | null) => `${SESSION_CHART_PROFILE_KEY}.${userId || 'anon'}`
const buildFollowPlanSymbolStorageKey = (userId?: string | null) => `${SESSION_FOLLOW_PLAN_SYMBOL_KEY}.${userId || 'anon'}`
const buildChartModeStorageKey = (userId?: string | null) => `${SESSION_CHART_MODE_KEY}.${userId || 'anon'}`

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

const inferLevelType = (label: string): LevelType => {
  const normalized = normalizeLevel(label)
  if (normalized === 'PDH') return 'PDH'
  if (normalized === 'PDL') return 'PDL'
  if (normalized === 'ASIAH' || normalized === 'ASIA_H') return 'ASIA_H'
  if (normalized === 'ASIAL' || normalized === 'ASIA_L') return 'ASIA_L'
  if (normalized === 'EQH') return 'EQH'
  if (normalized === 'EQL') return 'EQL'
  if (normalized === 'LONDONH' || normalized === 'LONDON_H') return 'LONDON_H'
  if (normalized === 'LONDONL' || normalized === 'LONDON_L') return 'LONDON_L'
  if (normalized === 'NYH' || normalized === 'NY_H') return 'NY_H'
  if (normalized === 'NYL' || normalized === 'NY_L') return 'NY_L'
  return 'OTHER'
}

const isFiniteLevelValue = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const toSuggestedLevelDedupKey = (item: SuggestedLevelItem) => {
  if (item.kind === 'PRICE') {
    return `${item.type}:PRICE:${item.price}`
  }
  if (item.kind === 'ZONE') {
    return `${item.type}:ZONE:${item.zoneLow}:${item.zoneHigh}`
  }
  return `${item.type}:REFERENCE`
}

const toSessionLevelDedupKey = (level: Pick<SessionLevel, 'label' | 'type' | 'price' | 'zoneLow' | 'zoneHigh'>) => {
  const type = level.type || inferLevelType(level.label)
  if (isFiniteLevelValue(level.zoneLow) && isFiniteLevelValue(level.zoneHigh)) {
    return `${type}:ZONE:${level.zoneLow}:${level.zoneHigh}`
  }
  if (isFiniteLevelValue(level.price)) {
    return `${type}:PRICE:${level.price}`
  }
  return `${type}:REFERENCE`
}

const toSuggestedLevelItem = (item: SessionLevelSuggestion): SuggestedLevelItem => {
  const base = {
    label: item.type,
    type: item.type,
    timeframe: item.timeframe,
    reason: item.reason,
    confidence: item.confidence
  }

  if (isFiniteLevelValue(item.zoneLow) && isFiniteLevelValue(item.zoneHigh)) {
    return {
      ...base,
      kind: 'ZONE',
      zoneLow: item.zoneLow,
      zoneHigh: item.zoneHigh
    }
  }

  if (isFiniteLevelValue(item.price)) {
    return {
      ...base,
      kind: 'PRICE',
      price: item.price
    }
  }

  return {
    ...base,
    kind: 'REFERENCE'
  }
}

const toPlanSuggestedLevelItem = (label: string): SuggestedReferenceLevelItem => ({
  kind: 'REFERENCE',
  label,
  type: inferLevelType(label),
  timeframe: 'M15',
  reason: 'Mentor plan level',
  confidence: 0.5
})

const toSuggestedLevelGeometryPayload = (
  item: SuggestedLevelItem
): Pick<SessionLevelRequest, 'price' | 'zoneLow' | 'zoneHigh'> => {
  if (item.kind === 'PRICE') {
    return { price: item.price, zoneLow: null, zoneHigh: null }
  }
  if (item.kind === 'ZONE') {
    return { price: null, zoneLow: item.zoneLow, zoneHigh: item.zoneHigh }
  }
  return { price: null, zoneLow: null, zoneHigh: null }
}

const LEVEL_LABEL_OPTIONS = ['PDH', 'PDL', 'AsiaH', 'AsiaL', 'EQH', 'EQL', 'Custom'] as const

const LEVEL_CATEGORY_OPTIONS: SessionLevelCategory[] = ['LIQUIDITY', 'TARGET', 'INVALIDATION', 'OTHER']
const LEVEL_TYPE_OPTIONS: LevelType[] = [
  'PDH',
  'PDL',
  'ASIA_H',
  'ASIA_L',
  'LONDON_H',
  'LONDON_L',
  'NY_H',
  'NY_L',
  'SESSION_H',
  'SESSION_L',
  'EQH',
  'EQL',
  'HTF_SWING_HIGH',
  'HTF_SWING_LOW',
  'OB_HIGH',
  'OB_LOW',
  'FVG_MID',
  'OTHER'
]
const LEVEL_TIMEFRAME_OPTIONS: LevelTimeframe[] = ['W1', 'D1', 'H4', 'H1', 'M15', 'M5', 'M1']
const LEVEL_STATUS_OPTIONS: LevelStatus[] = ['FRESH', 'TAPPED', 'SWEPT', 'RECLAIMED', 'INVALID']
const LEVEL_EXPECTATION_OPTIONS = ['MAGNET', 'SWEEP_THEN_DISPLACE', 'HOLD', 'TARGET_ONLY'] as const
const NARRATIVE_HTF_OPTIONS: SessionNarrative['htfDraw'][] = ['PDH', 'PDL', 'WEEKLY_H', 'WEEKLY_L', 'DAILY_SWING_HIGH', 'DAILY_SWING_LOW', 'OTHER']
const NARRATIVE_MANIPULATION_OPTIONS: SessionNarrative['expectedManipulation'][] = ['RAID_UP', 'RAID_DOWN', 'NONE']
const NARRATIVE_CONFIRMATION_OPTIONS: SessionNarrative['confirmationModel'][] = ['DISPLACEMENT_M5_MSS_M5', 'DISPLACEMENT_M1_MSS_M1', 'DISPLACEMENT_M15_MSS_M5', 'OTHER']
const NARRATIVE_DELIVERY_OPTIONS: SessionNarrative['deliveryModel'][] = ['ASIA_RAID_LONDON_REVERSAL', 'ASIA_RAID_LONDON_CONTINUATION', 'LONDON_RAID_NY_REVERSAL', 'TREND_DAY', 'OTHER']

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

const checklistStructureSignature = (items: SessionChecklistItem[]) => {
  return JSON.stringify(toChecklistTemplateItems(normalizeChecklistItems(items)))
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

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10)

const defaultBacktestSetup = (): BacktestSetupState => {
  const now = new Date()
  const from = new Date(now.getTime() - (1000 * 60 * 60 * 24 * 14))
  return {
    dataSource: 'OANDA',
    datasetId: '',
    sourceId: '',
    symbol: 'OANDA:EURUSD',
    timeframe: 'M1',
    from: toDateInputValue(from),
    to: toDateInputValue(now),
    sessionWindow: 'LONDON',
    spread: '',
    slippage: ''
  }
}

const emptyCsvMapping = (): CsvColumnMapping => ({
  timeColumn: '',
  openColumn: '',
  highColumn: '',
  lowColumn: '',
  closeColumn: '',
  volumeColumn: '',
  timezone: ''
})

const mappingFromUpload = (upload: CsvUploadResponse, preview: CsvPreviewResult | null): CsvColumnMapping => {
  const previewMapping = preview?.mapping
  if (previewMapping && isCsvMappingComplete(previewMapping)) {
    return {
      timeColumn: previewMapping.timeColumn || '',
      openColumn: previewMapping.openColumn || '',
      highColumn: previewMapping.highColumn || '',
      lowColumn: previewMapping.lowColumn || '',
      closeColumn: previewMapping.closeColumn || '',
      volumeColumn: previewMapping.volumeColumn || '',
      timezone: previewMapping.timezone || ''
    }
  }

  const suggested = upload.suggestedMapping
  if (suggested) {
    const columns = preview?.columns
    return {
      timeColumn: resolveColumnKeyFromHeader(columns, suggested.timeColumn || ''),
      openColumn: resolveColumnKeyFromHeader(columns, suggested.openColumn || ''),
      highColumn: resolveColumnKeyFromHeader(columns, suggested.highColumn || ''),
      lowColumn: resolveColumnKeyFromHeader(columns, suggested.lowColumn || ''),
      closeColumn: resolveColumnKeyFromHeader(columns, suggested.closeColumn || ''),
      volumeColumn: resolveColumnKeyFromHeader(columns, suggested.volumeColumn || ''),
      timezone: suggested.timezone || ''
    }
  }
  return emptyCsvMapping()
}

const mappingToIngestPayload = (upload: CsvUploadItem): CsvColumnMapping => {
  const columns = upload.preview?.columns
  return {
    timeColumn: resolveHeaderFromColumnKey(columns, upload.mappingDraft.timeColumn),
    openColumn: resolveHeaderFromColumnKey(columns, upload.mappingDraft.openColumn),
    highColumn: resolveHeaderFromColumnKey(columns, upload.mappingDraft.highColumn),
    lowColumn: resolveHeaderFromColumnKey(columns, upload.mappingDraft.lowColumn),
    closeColumn: resolveHeaderFromColumnKey(columns, upload.mappingDraft.closeColumn),
    volumeColumn: resolveHeaderFromColumnKey(columns, upload.mappingDraft.volumeColumn),
    timezone: upload.mappingDraft.timezone
  }
}

const uploadPreviewColumns = (upload: CsvUploadItem): CsvPreviewColumn[] => {
  if (upload.preview?.columns?.length) {
    return upload.preview.columns
  }

  const occurrences = new Map<string, number>()
  return (upload.headers || []).map((header, index) => {
    const keyBase = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || `column${index + 1}`
    const occurrence = (occurrences.get(keyBase) || 0) + 1
    occurrences.set(keyBase, occurrence)
    const display = header || `Column ${index + 1}`
    return {
      key: `c${index}`,
      header,
      index,
      occurrence,
      displayName: occurrence > 1 ? `${display} (${occurrence})` : display
    }
  })
}

const toDateInputFromIso = (iso?: string) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const toIsoFromUnknownTimestamp = (value?: string | number) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'number') {
    const ms = value < 10_000_000_000 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }
  const parsedNumber = Number(value)
  if (Number.isFinite(parsedNumber)) {
    const ms = parsedNumber < 10_000_000_000 ? parsedNumber * 1000 : parsedNumber
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

const inferPipSize = (symbolRaw: string) => {
  const symbol = symbolRaw.trim().toUpperCase()
  if (symbol.includes('JPY')) return 0.01
  if (symbol.includes('XAU') || symbol.includes('XAG')) return 0.1
  return 0.0001
}

const isEntryTouched = (
  direction: 'LONG' | 'SHORT',
  quote: LiveQuoteResponse,
  entryPrice: number,
  tolerancePoints: number
) => {
  if (quote.bid == null || quote.ask == null) return false
  if (direction === 'LONG') {
    return quote.ask >= (entryPrice - tolerancePoints)
  }
  return quote.bid <= (entryPrice + tolerancePoints)
}

const isStopLossTouched = (
  direction: 'LONG' | 'SHORT',
  quote: LiveQuoteResponse,
  stopLossPrice: number,
  tolerancePoints: number
) => {
  if (quote.bid == null || quote.ask == null) return false
  if (direction === 'LONG') {
    return quote.bid <= (stopLossPrice + tolerancePoints)
  }
  return quote.ask >= (stopLossPrice - tolerancePoints)
}

const isTakeProfitTouched = (
  direction: 'LONG' | 'SHORT',
  quote: LiveQuoteResponse,
  takeProfitPrice: number,
  tolerancePoints: number
) => {
  if (quote.bid == null || quote.ask == null) return false
  if (direction === 'LONG') {
    return quote.bid >= (takeProfitPrice - tolerancePoints)
  }
  return quote.ask <= (takeProfitPrice + tolerancePoints)
}

const resolveTimeframeWindowDays = (timeframeRaw?: string) => {
  const timeframe = (timeframeRaw || '').trim().toUpperCase()
  if (timeframe === 'M1' || timeframe === 'M5') return 7
  if (timeframe === 'M15' || timeframe === 'H1') return 30
  if (timeframe === 'D1') return 180
  return 30
}

const resolveTimeframePresetDays = (timeframeRaw?: string) => {
  const timeframe = (timeframeRaw || '').trim().toUpperCase()
  if (timeframe === 'M1' || timeframe === 'M5') return [1, 3, 7]
  if (timeframe === 'M15' || timeframe === 'H1') return [3, 7, 30]
  if (timeframe === 'D1') return [30]
  return [1, 3, 7]
}

const resolveDatasetDateRangeDefaults = (dataset: {
  dataFrom?: string
  dataTo?: string
  timeframe?: string
  defaultFromUtc?: string
  defaultToUtc?: string
  recommendedDefaultFromUtc?: string
  recommendedDefaultToUtc?: string
}) => {
  const defaultFromIso = dataset.recommendedDefaultFromUtc || dataset.defaultFromUtc
  const defaultToIso = dataset.recommendedDefaultToUtc || dataset.defaultToUtc
  const defaultFrom = defaultFromIso ? new Date(defaultFromIso) : null
  const defaultTo = defaultToIso ? new Date(defaultToIso) : null
  if (defaultFrom && defaultTo && !Number.isNaN(defaultFrom.getTime()) && !Number.isNaN(defaultTo.getTime())) {
    return {
      from: toDateInputValue(defaultFrom),
      to: toDateInputValue(defaultTo)
    }
  }

  const dataFrom = dataset.dataFrom ? new Date(dataset.dataFrom) : null
  const dataTo = dataset.dataTo ? new Date(dataset.dataTo) : null
  if (!dataFrom || !dataTo || Number.isNaN(dataFrom.getTime()) || Number.isNaN(dataTo.getTime())) {
    return { from: '', to: '' }
  }

  const windowMs = resolveTimeframeWindowDays(dataset.timeframe) * 24 * 60 * 60 * 1000
  const preferredFrom = new Date(dataTo.getTime() - windowMs)
  const fromDate = dataFrom.getTime() > preferredFrom.getTime() ? dataFrom : preferredFrom

  return {
    from: toDateInputValue(fromDate),
    to: toDateInputValue(dataTo)
  }
}

const toDateRangeIso = (value: string, edge: 'start' | 'end') => {
  if (!value) return undefined
  const parsed = new Date(edge === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

export default function SessionPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const baseCurrency = user?.baseCurrency || 'USD'
  const isTestMode = import.meta.env.MODE === 'test'

  const isCompactViewport = useMediaQuery('(max-width:900px)')
  const isMobileViewport = useMediaQuery('(max-width:600px)')
  const isTinyViewport = useMediaQuery('(max-width:430px)')

  const layoutStorageKey = useMemo(() => buildLayoutStorageKey(user?.id), [user?.id])
  const chartProfileStorageKey = useMemo(() => buildChartProfileStorageKey(user?.id), [user?.id])
  const followPlanSymbolStorageKey = useMemo(() => buildFollowPlanSymbolStorageKey(user?.id), [user?.id])
  const chartModeStorageKey = useMemo(() => buildChartModeStorageKey(user?.id), [user?.id])

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
  const [sessionPools, setSessionPools] = useState<SessionPool[]>([])
  const [narrative, setNarrative] = useState<SessionNarrative>({
    sessionId: '',
    htfDraw: null,
    expectedManipulation: null,
    deliveryModel: null,
    confirmationModel: 'DISPLACEMENT_M5_MSS_M5',
    notes: ''
  })
  const [narrativeSaved, setNarrativeSaved] = useState(false)
  const [activeSweepLevelId, setActiveSweepLevelId] = useState<string | null>(null)
  const [activeEntryLevelId, setActiveEntryLevelId] = useState<string | null>(null)
  const [activeSlLevelId, setActiveSlLevelId] = useState<string | null>(null)
  const [activeTpLevelId, setActiveTpLevelId] = useState<string | null>(null)
  const [activeSweepPoolId, setActiveSweepPoolId] = useState<string | null>(null)

  const [checklistEditDialog, setChecklistEditDialog] = useState<ChecklistEditDialogState>({
    open: false,
    type: 'PREREQS',
    items: [],
    initialSignature: ''
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
  const [poolDialog, setPoolDialog] = useState<PoolDialogState>({
    open: false,
    editId: null,
    poolName: '',
    symbol: '',
    type: 'OTHER',
    timeframe: 'M15',
    zoneLow: '',
    zoneHigh: '',
    cleanlinessScore: '3',
    status: 'FRESH',
    levelIds: [],
    sweepRole: false
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
  const [chartMode, setChartMode] = useState<SessionChartMode>(() => {
    const saved = localStorage.getItem(chartModeStorageKey)
    return saved === 'BACKTEST' ? 'BACKTEST' : 'LIVE'
  })
  const [followPlanSymbol, setFollowPlanSymbol] = useState(() => localStorage.getItem(followPlanSymbolStorageKey) !== 'false')
  const [selectedChartProfileId, setSelectedChartProfileId] = useState(() => localStorage.getItem(chartProfileStorageKey) || '')
  const [chartProfiles, setChartProfiles] = useState<ChartProfile[]>([])
  const [chartProfilesLoading, setChartProfilesLoading] = useState(false)
  const [chartProfileManageOpen, setChartProfileManageOpen] = useState(false)
  const [backtestSetup, setBacktestSetup] = useState<BacktestSetupState>(defaultBacktestSetup)
  const [backtestRun, setBacktestRun] = useState<BacktestRun | null>(null)
  const [backtestCandles, setBacktestCandles] = useState<BacktestRun['candles']>([])
  const [backtestCursor, setBacktestCursor] = useState(0)
  const [backtestReplayState, setBacktestReplayState] = useState<BacktestReplayState>('IDLE')
  const [backtestIsPlaying, setBacktestIsPlaying] = useState(false)
  const [backtestReplayMessage, setBacktestReplayMessage] = useState('')
  const [backtestSpeed, setBacktestSpeed] = useState(1)
  const [latestBacktestTrade, setLatestBacktestTrade] = useState<BacktestTrade | null>(null)
  const [backtestTrades, setBacktestTrades] = useState<BacktestTrade[]>([])
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestDatasets, setBacktestDatasets] = useState<BacktestDataset[]>([])
  const [backtestDatasetsLoading, setBacktestDatasetsLoading] = useState(false)
  const [backtestDatasetSummary, setBacktestDatasetSummary] = useState<BacktestDatasetSummary | null>(null)
  const [csvUploads, setCsvUploads] = useState<CsvUploadItem[]>([])
  const [csvIngestingFileId, setCsvIngestingFileId] = useState<string | null>(null)
  const [oandaConnected, setOandaConnected] = useState<boolean | null>(null)

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
  const [liveQuote, setLiveQuote] = useState<LiveQuoteResponse | null>(null)
  const [autoTradeStatus, setAutoTradeStatus] = useState<AutoTradeLifecycleStatus>('DISARMED')
  const [autoTradeTolerancePips, setAutoTradeTolerancePips] = useState('0')
  const [autoTradeTimeoutMinutes, setAutoTradeTimeoutMinutes] = useState('30')
  const [autoTradeArmedAt, setAutoTradeArmedAt] = useState<string | null>(null)
  const [autoTradeEvents, setAutoTradeEvents] = useState<AutoTradeUiEvent[]>([])
  const [autoTradeBusy, setAutoTradeBusy] = useState(false)
  const [autoTradeLogOpen, setAutoTradeLogOpen] = useState(true)
  const [autoTradeTimeoutPrompting, setAutoTradeTimeoutPrompting] = useState(false)

  const invalidationFieldRef = useRef<HTMLInputElement | null>(null)
  const mentorPanelRef = useRef<HTMLDivElement | null>(null)
  const csvUploadInputRef = useRef<HTMLInputElement | null>(null)

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
  const autoTradeStorageKey = useMemo(
    () => (session?.id ? `${SESSION_AUTO_TRADE_KEY}.${user?.id || 'anonymous'}.${session.id}` : ''),
    [session?.id, user?.id]
  )

  const pushAutoTradeEvent = useCallback(async (payload: {
    type: AutoTradeEventType
    side?: QuoteSide
    price?: number
    note?: string
    tradeId?: string | null
  }) => {
    if (!session?.id) return
    const localKey = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimistic: AutoTradeUiEvent = {
      id: localKey,
      sessionId: session.id,
      type: payload.type,
      side: payload.side ?? null,
      price: payload.price ?? null,
      note: payload.note ?? null,
      tradeId: payload.tradeId ?? null,
      tsUtc: new Date().toISOString(),
      localKey
    }
    setAutoTradeEvents((prev) => [optimistic, ...prev].slice(0, 50))
    try {
      const saved = await logSessionAutoTradeEvent(session.id, {
        type: payload.type,
        side: payload.side ?? null,
        price: payload.price ?? null,
        tradeId: payload.tradeId ?? null,
        note: payload.note ?? null
      })
      setAutoTradeEvents((prev) => {
        const withoutOptimistic = prev.filter((item) => item.localKey !== localKey)
        return [{ ...saved, localKey: saved.id }, ...withoutOptimistic].slice(0, 50)
      })
    } catch {
      // keep optimistic row so user still has a visible log even if sync fails
    }
  }, [session?.id])

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
    if (!session?.id) return
    setAutoTradeLogOpen(!isTinyViewport)
    setAutoTradeBusy(false)
    setAutoTradeTimeoutPrompting(false)

    let nextStatus: AutoTradeLifecycleStatus = session.activeTrade ? 'ACTIVE' : 'DISARMED'
    let nextArmedAt: string | null = null
    let nextTolerance = '0'
    let nextTimeoutMinutes = '30'

    if (autoTradeStorageKey) {
      try {
        const raw = localStorage.getItem(autoTradeStorageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as {
            status?: AutoTradeLifecycleStatus
            armedAt?: string | null
            tolerancePips?: string
            timeoutMinutes?: string
          }
          const persistedStatus = parsed.status || nextStatus
          nextStatus = session.activeTrade
            ? 'ACTIVE'
            : (persistedStatus === 'ACTIVE' ? 'DISARMED' : persistedStatus)
          nextArmedAt = parsed.armedAt || null
          nextTolerance = parsed.tolerancePips || nextTolerance
          nextTimeoutMinutes = parsed.timeoutMinutes || nextTimeoutMinutes
        }
      } catch {
        // ignore malformed local storage payload
      }
    }

    setAutoTradeStatus(nextStatus)
    setAutoTradeArmedAt(nextArmedAt)
    setAutoTradeTolerancePips(nextTolerance)
    setAutoTradeTimeoutMinutes(nextTimeoutMinutes)

    let cancelled = false
    void listSessionAutoTradeEvents(session.id)
      .then((rows) => {
        if (cancelled) return
        setAutoTradeEvents((rows || []).map((row) => ({ ...row, localKey: row.id })))
      })
      .catch(() => {
        if (!cancelled) {
          setAutoTradeEvents([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [autoTradeStorageKey, isTinyViewport, session?.activeTrade, session?.id])

  useEffect(() => {
    if (!autoTradeStorageKey) return
    localStorage.setItem(autoTradeStorageKey, JSON.stringify({
      status: autoTradeStatus,
      armedAt: autoTradeArmedAt,
      tolerancePips: autoTradeTolerancePips,
      timeoutMinutes: autoTradeTimeoutMinutes
    }))
  }, [autoTradeArmedAt, autoTradeStatus, autoTradeStorageKey, autoTradeTimeoutMinutes, autoTradeTolerancePips])

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
    const savedMode = localStorage.getItem(chartModeStorageKey)
    setChartMode(savedMode === 'BACKTEST' ? 'BACKTEST' : 'LIVE')
    setFollowPlanSymbol(localStorage.getItem(followPlanSymbolStorageKey) !== 'false')
    setSelectedChartProfileId(localStorage.getItem(chartProfileStorageKey) || '')
  }, [chartModeStorageKey, chartProfileStorageKey, followPlanSymbolStorageKey])

  useEffect(() => {
    localStorage.setItem(chartModeStorageKey, chartMode)
  }, [chartMode, chartModeStorageKey])

  useEffect(() => {
    localStorage.setItem(followPlanSymbolStorageKey, String(followPlanSymbol))
  }, [followPlanSymbol, followPlanSymbolStorageKey])

  useEffect(() => {
    if (!selectedChartProfileId) {
      localStorage.removeItem(chartProfileStorageKey)
      return
    }
    localStorage.setItem(chartProfileStorageKey, selectedChartProfileId)
  }, [chartProfileStorageKey, selectedChartProfileId])

  useEffect(() => {
    let mounted = true
    setChartProfilesLoading(true)
    listChartProfiles('SESSION_MODE')
      .then((profiles) => {
        if (!mounted) return
        setChartProfiles(profiles || [])
        if (selectedChartProfileId && !(profiles || []).some((item) => item.id === selectedChartProfileId)) {
          setSelectedChartProfileId('')
        }
        if (!selectedChartProfileId) {
          const defaultProfile = (profiles || []).find((item) => item.isDefault)
          if (defaultProfile) {
            setSelectedChartProfileId(defaultProfile.id)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setChartProfilesLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [chartProfileStorageKey, selectedChartProfileId])

  useEffect(() => {
    if (!backtestIsPlaying || backtestReplayState !== 'READY' || backtestCandles.length === 0) return undefined
    const intervalMs = Math.max(120, Math.round(850 / Math.max(backtestSpeed, 1)))
    const timer = window.setInterval(() => {
      setBacktestCursor((prev) => {
        const next = prev + 1
        if (next >= backtestCandles.length - 1) {
          setBacktestIsPlaying(false)
          return Math.max(backtestCandles.length - 1, 0)
        }
        return next
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [backtestIsPlaying, backtestReplayState, backtestCandles, backtestSpeed])

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
    setSessionPools(session.pools || [])
    setActiveSweepLevelId(session.activeSweepLevelId || null)
    setActiveEntryLevelId(session.activeEntryLevelId || null)
    setActiveSlLevelId(session.activeSlLevelId || null)
    setActiveTpLevelId(session.activeTpLevelId || null)
    setActiveSweepPoolId(session.activeSweepPoolId || null)
    setNarrative({
      sessionId: session.id,
      htfDraw: session.narrative?.htfDraw || null,
      expectedManipulation: session.narrative?.expectedManipulation || null,
      deliveryModel: session.narrative?.deliveryModel || null,
      confirmationModel: session.narrative?.confirmationModel || 'DISPLACEMENT_M5_MSS_M5',
      notes: session.narrative?.notes || ''
    })
    setNarrativeSaved(Boolean(session.narrative))
  }, [session])

  useEffect(() => {
    if (!session?.id) return
    let cancelled = false
    if (session.pools && session.narrative) return
    void Promise.all([
      listSessionPools(session.id),
      getSessionNarrative(session.id)
    ]).then(([pools, narrativeData]) => {
      if (cancelled) return
      if (!session.pools) {
        setSessionPools(pools || [])
      }
      if (!session.narrative && narrativeData) {
        setNarrative({
          sessionId: session.id,
          htfDraw: narrativeData.htfDraw || null,
          expectedManipulation: narrativeData.expectedManipulation || null,
          deliveryModel: narrativeData.deliveryModel || null,
          confirmationModel: narrativeData.confirmationModel || 'DISPLACEMENT_M5_MSS_M5',
          notes: narrativeData.notes || ''
        })
        setNarrativeSaved(true)
      }
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [session?.id, session?.narrative, session?.pools])

  useEffect(() => {
    if (!isMobileViewport) return
    setLayoutState((prev) => ({
      ...prev,
      collapsed: {
        ...prev.collapsed,
        progress: true
      }
    }))
  }, [isMobileViewport])

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

  const setRolesMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof setSessionRoles>[1]) => {
      if (!session?.id) {
        throw new Error('Session not available')
      }
      return setSessionRoles(session.id, payload)
    },
    onSuccess: async (nextSession) => {
      queryClient.setQueryData(['todaySession'], nextSession)
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const narrativeMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof updateSessionNarrative>[1]) => {
      if (!session?.id) {
        throw new Error('Session not available')
      }
      return updateSessionNarrative(session.id, payload)
    },
    onSuccess: async () => {
      setNarrativeSaved(true)
      if (session?.id) {
        const [freshNarrative, freshPools] = await Promise.all([
          getSessionNarrative(session.id),
          listSessionPools(session.id)
        ])
        setNarrative((prev) => ({
          ...prev,
          sessionId: session.id,
          htfDraw: freshNarrative?.htfDraw || prev.htfDraw,
          expectedManipulation: freshNarrative?.expectedManipulation || prev.expectedManipulation,
          deliveryModel: freshNarrative?.deliveryModel || prev.deliveryModel,
          confirmationModel: freshNarrative?.confirmationModel || prev.confirmationModel,
          notes: freshNarrative?.notes || prev.notes
        }))
        setSessionPools(freshPools || [])
      }
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const createPoolMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createSessionPool>[1]) => {
      if (!session?.id) {
        throw new Error('Session not available')
      }
      return createSessionPool(session.id, payload)
    },
    onSuccess: async () => {
      if (session?.id) {
        setSessionPools(await listSessionPools(session.id))
      }
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const updatePoolMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Parameters<typeof updateSessionPool>[2] }) => {
      if (!session?.id) {
        throw new Error('Session not available')
      }
      return updateSessionPool(session.id, id, payload)
    },
    onSuccess: async () => {
      if (session?.id) {
        setSessionPools(await listSessionPools(session.id))
      }
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const deletePoolMutation = useMutation({
    mutationFn: async (poolId: string) => {
      if (!session?.id) {
        throw new Error('Session not available')
      }
      return deleteSessionPool(session.id, poolId)
    },
    onSuccess: async () => {
      if (session?.id) {
        setSessionPools(await listSessionPools(session.id))
      }
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

  const selectedChartProfile = useMemo(
    () => chartProfiles.find((item) => item.id === selectedChartProfileId) || null,
    [chartProfiles, selectedChartProfileId]
  )

  const chartProfileEmbedConfig = (selectedChartProfile?.embedConfigJson || {}) as ChartEmbedConfig
  const chartProfilePrefs = selectedChartProfile?.tjaPrefsJson || {}
  const chartModeLabel = chartMode === 'LIVE' ? t('today.session.chart.modeLive') : t('today.session.chart.modeBacktest')
  const canReplayPlay = backtestReplayState === 'READY' && backtestCandles.length > 0
  const canReplayStep = backtestReplayState === 'READY' && backtestCandles.length > 0

  const chartSymbol = (() => {
    const planSymbol = selectedPlan?.tradingViewSymbol?.trim()
    if (followPlanSymbol && planSymbol) {
      return planSymbol
    }
    return (chartProfileEmbedConfig.symbol
      || (planner.symbol.trim() ? planner.symbol.trim().toUpperCase() : '')
      || chartSymbolMemory
      || 'TVC:DXY')
  })()
  const chartInterval = (chartProfileEmbedConfig.interval
    || selectedPlan?.tradingViewInterval
    || chartIntervalMemory
    || '15')
  const chartAllowSymbolChange = chartProfileEmbedConfig.allowSymbolChange ?? (selectedPlan?.tradingViewAllowSymbolChange ?? true)
  const chartTheme = chartProfileEmbedConfig.theme || selectedPlan?.tradingViewTheme || 'SYSTEM'
  const chartHideControls = chartProfileEmbedConfig.hideControls ?? (selectedPlan?.tradingViewHideControls ?? false)
  const chartHeightPreference = chartProfileEmbedConfig.chartHeightPref

  useEffect(() => {
    if (chartSymbol) {
      setChartSymbolMemory(chartSymbol)
    }
    if (chartInterval) {
      setChartIntervalMemory(chartInterval)
    }
  }, [chartInterval, chartSymbol])

  useEffect(() => {
    if (!selectedChartProfile) return
    const nextFollowPlan = selectedChartProfile.tjaPrefsJson?.followPlanSymbol
    if (typeof nextFollowPlan === 'boolean') {
      setFollowPlanSymbol(nextFollowPlan)
    }
  }, [selectedChartProfile])

  const buildLiveStartTradePayload = (entryPriceOverride?: number) => {
    const quantity = Number(planner.quantity)
    const entryPrice = entryPriceOverride ?? Number(planner.entryPrice)
    const stopLossPrice = Number(planner.stopLossPrice)
    return {
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
      entryScreenshotAssetIds: attachedScreenshots.map((asset) => asset.id),
      sweepLevelId: activeSweepLevelId || undefined,
      sweepPoolId: activeSweepPoolId || undefined,
      entryLevelId: activeEntryLevelId || undefined,
      slLevelId: activeSlLevelId || undefined,
      tpLevelId: activeTpLevelId || undefined
    }
  }

  useEffect(() => {
    if (chartMode !== 'LIVE') {
      setLiveQuote(null)
      return
    }

    const symbol = chartSymbol.trim()
    if (!symbol) {
      setLiveQuote(null)
      return
    }

    let cancelled = false
    const loadQuote = async () => {
      try {
        const quote = await fetchLiveQuote(symbol)
        if (!cancelled) {
          setLiveQuote(quote)
        }
      } catch {
        if (!cancelled) {
          setLiveQuote({
            symbol,
            available: false,
            reason: t('today.session.autoTrade.quoteUnavailable')
          })
        }
      }
    }

    void loadQuote()
    if (isTestMode) {
      return () => {
        cancelled = true
      }
    }
    const timer = window.setInterval(() => {
      void loadQuote()
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [chartMode, chartSymbol, isTestMode, t])

  useEffect(() => {
    if (autoTradeStatus !== 'ARMED' || !autoTradeArmedAt) return
    const timeoutMinutes = Number(autoTradeTimeoutMinutes)
    if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) return

    const timeoutMs = timeoutMinutes * 60 * 1000
    const timer = window.setInterval(() => {
      if (autoTradeTimeoutPrompting) return
      const armedAtMs = new Date(autoTradeArmedAt).getTime()
      if (!Number.isFinite(armedAtMs)) return
      if ((Date.now() - armedAtMs) < timeoutMs) return

      setAutoTradeTimeoutPrompting(true)
      const keepArmed = window.confirm(t('today.session.autoTrade.timeoutPrompt', { minutes: timeoutMinutes }))
      if (keepArmed) {
        setAutoTradeArmedAt(new Date().toISOString())
        void pushAutoTradeEvent({
          type: 'KEEP_ALIVE',
          note: t('today.session.autoTrade.keepAlive')
        })
      } else {
        setAutoTradeStatus('DISARMED')
        setAutoTradeArmedAt(null)
        void pushAutoTradeEvent({
          type: 'TIMEOUT',
          note: t('today.session.autoTrade.timeoutDisarmed')
        })
      }
      setAutoTradeTimeoutPrompting(false)
    }, 10_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [autoTradeArmedAt, autoTradeStatus, autoTradeTimeoutMinutes, autoTradeTimeoutPrompting, pushAutoTradeEvent, t])

  useEffect(() => {
    if (chartMode !== 'LIVE') return
    if (autoTradeStatus !== 'ARMED' && autoTradeStatus !== 'ACTIVE') return
    if (!liveQuote?.available) return
    if (liveQuote.bid == null || liveQuote.ask == null) return
    if (autoTradeBusy) return

    const symbol = planner.symbol.trim()
    if (!symbol) return

    const direction = planner.direction
    const entryPrice = Number(planner.entryPrice)
    const stopLossPrice = Number(planner.stopLossPrice)
    const takeProfitPrice = Number(planner.takeProfitPrice)
    const tolerancePips = Number(autoTradeTolerancePips)
    const tolerancePoints = (Number.isFinite(tolerancePips) && tolerancePips > 0)
      ? tolerancePips * inferPipSize(symbol)
      : 0

    if (
      !Number.isFinite(entryPrice)
      || entryPrice <= 0
      || !Number.isFinite(stopLossPrice)
      || stopLossPrice <= 0
      || !Number.isFinite(takeProfitPrice)
      || takeProfitPrice <= 0
    ) {
      return
    }

    if (autoTradeStatus === 'ARMED' && !session?.activeTrade) {
      if (!canMeetExecutionGate) return
      if (!isEntryTouched(direction, liveQuote, entryPrice, tolerancePoints)) return

      const fillSide: QuoteSide = direction === 'LONG' ? 'ASK' : 'BID'
      const fillPrice = fillSide === 'ASK' ? liveQuote.ask : liveQuote.bid
      setAutoTradeBusy(true)
      void pushAutoTradeEvent({
        type: 'ENTRY_FILLED',
        side: fillSide,
        price: fillPrice,
        note: t('today.session.autoTrade.entryTouched')
      })
      void (async () => {
        try {
          await startTradeMutation.mutateAsync(buildLiveStartTradePayload(fillPrice))
          setAutoTradeStatus('ACTIVE')
        } catch (error) {
          setAutoTradeStatus('DISARMED')
          setAutoTradeArmedAt(null)
          void pushAutoTradeEvent({
            type: 'ERROR',
            note: (error as Error)?.message || t('today.session.autoTrade.entryStartFailed')
          })
        } finally {
          setAutoTradeBusy(false)
        }
      })()
      return
    }

    const activeTrade = session?.activeTrade
    if (!activeTrade) return

    const slTouched = isStopLossTouched(direction, liveQuote, stopLossPrice, tolerancePoints)
    const tpTouched = isTakeProfitTouched(direction, liveQuote, takeProfitPrice, tolerancePoints)
    if (!slTouched && !tpTouched) return

    const bothTouched = slTouched && tpTouched
    const outcome: AutoTradeEventType = (slTouched || bothTouched) ? 'SL_HIT' : 'TP_HIT'
    const closeSide: QuoteSide = direction === 'LONG' ? 'BID' : 'ASK'
    const closePrice = closeSide === 'ASK' ? liveQuote.ask : liveQuote.bid

    setAutoTradeBusy(true)
    void pushAutoTradeEvent({
      type: outcome,
      side: closeSide,
      price: closePrice,
      tradeId: activeTrade.id,
      note: bothTouched
        ? t('today.session.autoTrade.gapAmbiguous')
        : (outcome === 'SL_HIT' ? t('today.session.autoTrade.slTouched') : t('today.session.autoTrade.tpTouched'))
    })
    void (async () => {
      try {
        await closeTradeMutation.mutateAsync({
          tradeId: activeTrade.id,
          payload: {
            exitPrice: closePrice,
            ruleBreaks: [],
            postTradeNotes: outcome === 'SL_HIT'
              ? t('today.session.autoTrade.autoCloseSl')
              : t('today.session.autoTrade.autoCloseTp')
          }
        })
        setAutoTradeStatus('CLOSED')
        setAutoTradeArmedAt(null)
      } catch (error) {
        void pushAutoTradeEvent({
          type: 'ERROR',
          tradeId: activeTrade.id,
          note: (error as Error)?.message || t('today.session.autoTrade.closeFailed')
        })
      } finally {
        setAutoTradeBusy(false)
      }
    })()
  }, [
    autoTradeBusy,
    autoTradeStatus,
    autoTradeTolerancePips,
    buildLiveStartTradePayload,
    chartMode,
    closeTradeMutation,
    liveQuote,
    planner.direction,
    planner.entryPrice,
    planner.stopLossPrice,
    planner.symbol,
    planner.takeProfitPrice,
    pushAutoTradeEvent,
    session?.activeTrade,
    startTradeMutation,
    t
  ])

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
  const selectedEntryLevel = useMemo(
    () => sessionLevels.find((item) => item.id === activeEntryLevelId) || null,
    [activeEntryLevelId, sessionLevels]
  )
  const selectedSlLevel = useMemo(
    () => sessionLevels.find((item) => item.id === activeSlLevelId) || null,
    [activeSlLevelId, sessionLevels]
  )
  const selectedTpLevel = useMemo(
    () => sessionLevels.find((item) => item.id === activeTpLevelId) || null,
    [activeTpLevelId, sessionLevels]
  )
  const selectedSweepPool = useMemo(
    () => sessionPools.find((item) => item.id === activeSweepPoolId) || null,
    [activeSweepPoolId, sessionPools]
  )
  const narrativeComplete = Boolean(narrative.htfDraw && narrative.expectedManipulation && narrative.confirmationModel)
  const rolesComplete = Boolean((selectedSweepLevel || selectedSweepPool) && selectedEntryLevel && selectedSlLevel)

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

  const setupQualityChecks = [lockInComplete, prerequisitesComplete, triggersComplete, narrativeComplete, rolesComplete, rrMet, newsSafe]
  const setupQualityScore = Math.round((setupQualityChecks.filter(Boolean).length / setupQualityChecks.length) * 100)
  const suggestedSetupGrade = setupQualityScore >= 95 ? 'A+' : (setupQualityScore >= 75 ? 'A' : 'B')

  const canMeetExecutionGate = lockInComplete
    && prerequisitesComplete
    && triggersComplete
    && narrativeComplete
    && rolesComplete
    && invalidationWritten
    && rrMet
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

  const missingNarrative = [
    !narrative.htfDraw ? t('today.session.narrative.draw') : null,
    !narrative.expectedManipulation ? t('today.session.narrative.manipulation') : null,
    !narrative.confirmationModel ? t('today.session.narrative.confirmation') : null
  ].filter(Boolean) as string[]

  const missingRoles = [
    !(selectedSweepLevel || selectedSweepPool) ? t('today.session.roles.sweep') : null,
    !selectedEntryLevel ? t('today.session.roles.entry') : null,
    !selectedSlLevel ? t('today.session.roles.sl') : null
  ].filter(Boolean) as string[]

  const groupedLevels = useMemo(() => {
    const htfDrawTypes = new Set<LevelType>(['PDH', 'PDL', 'HTF_SWING_HIGH', 'HTF_SWING_LOW'])
    const sessionRangeTypes = new Set<LevelType>(['ASIA_H', 'ASIA_L', 'LONDON_H', 'LONDON_L', 'NY_H', 'NY_L', 'SESSION_H', 'SESSION_L'])
    const poolTypes = new Set<LevelType>(['EQH', 'EQL', 'OB_HIGH', 'OB_LOW', 'FVG_MID'])

    return {
      htf: sessionLevels.filter((level) => htfDrawTypes.has(level.type || inferLevelType(level.label))),
      sessionRange: sessionLevels.filter((level) => sessionRangeTypes.has(level.type || inferLevelType(level.label))),
      pool: sessionLevels.filter((level) => poolTypes.has(level.type || inferLevelType(level.label))),
      other: sessionLevels.filter((level) => {
        const type = level.type || inferLevelType(level.label)
        return !htfDrawTypes.has(type) && !sessionRangeTypes.has(type) && !poolTypes.has(type)
      })
    }
  }, [sessionLevels])

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
    const currentItems = normalizeChecklistItems(type === 'PREREQS' ? prereqChecklist : triggerChecklist)
    setChecklistEditDialog({
      open: true,
      type,
      items: currentItems,
      initialSignature: checklistStructureSignature(currentItems)
    })
  }

  const checklistEditorHasChanges = useMemo(() => {
    if (!checklistEditDialog.open) return false
    return checklistStructureSignature(checklistEditDialog.items) !== checklistEditDialog.initialSignature
  }, [checklistEditDialog.initialSignature, checklistEditDialog.items, checklistEditDialog.open])

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
    const symbol = planner.symbol.trim() ? planner.symbol.trim().toUpperCase() : null
    const inferredType = inferLevelType(label)
    const payload = {
      label,
      price: levelDialog.price ? Number(levelDialog.price) : null,
      symbol,
      type: inferredType,
      timeframe: 'M15' as LevelTimeframe,
      status: 'FRESH' as LevelStatus,
      strengthScore: 3,
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
    const level = levelId ? sessionLevels.find((item) => item.id === levelId) : null
    const symbol = level?.symbol || planner.symbol.trim().toUpperCase() || undefined
    const nextSession = await setRolesMutation.mutateAsync({
      symbol,
      sweepLevelId: levelId ?? null
    })
    setActiveSweepLevelId(nextSession.activeSweepLevelId || null)
    setActiveSweepPoolId(nextSession.activeSweepPoolId || null)
  }

  const handleAssignExecutionRole = async (target: 'entry' | 'sl' | 'tp', level: SessionLevel) => {
    const symbol = level.symbol || planner.symbol.trim().toUpperCase() || undefined
    const payload = {
      symbol,
      entryLevelId: target === 'entry' ? level.id : undefined,
      slLevelId: target === 'sl' ? level.id : undefined,
      tpLevelId: target === 'tp' ? level.id : undefined
    }
    const nextSession = await setRolesMutation.mutateAsync(payload)
    setActiveEntryLevelId(nextSession.activeEntryLevelId || null)
    setActiveSlLevelId(nextSession.activeSlLevelId || null)
    setActiveTpLevelId(nextSession.activeTpLevelId || null)
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
      await handleAssignExecutionRole('entry', level)
      return
    }
    if (target === 'sl') {
      setPlanner((prev) => ({ ...prev, stopLossPrice: String(nextPrice) }))
      await handleAssignExecutionRole('sl', level)
      return
    }
    setPlanner((prev) => ({ ...prev, takeProfitPrice: String(nextPrice) }))
    await handleAssignExecutionRole('tp', level)
  }

  const handleSaveNarrative = async () => {
    if (!session) return
    await narrativeMutation.mutateAsync({
      htfDraw: narrative.htfDraw || null,
      expectedManipulation: narrative.expectedManipulation || null,
      deliveryModel: narrative.deliveryModel || null,
      confirmationModel: narrative.confirmationModel || null,
      notes: narrative.notes?.trim() || null
    })
    setSuccessMessage(t('today.session.narrative.saved'))
  }

  const openPoolDialog = (pool?: SessionPool) => {
    if (!pool) {
      setPoolDialog({
        open: true,
        editId: null,
        poolName: '',
        symbol: planner.symbol.trim().toUpperCase() || '',
        type: 'OTHER',
        timeframe: 'M15',
        zoneLow: '',
        zoneHigh: '',
        cleanlinessScore: '3',
        status: 'FRESH',
        levelIds: sessionLevels.slice(0, 2).map((item) => item.id),
        sweepRole: false
      })
      return
    }
    setPoolDialog({
      open: true,
      editId: pool.id,
      poolName: pool.poolName,
      symbol: pool.symbol || planner.symbol.trim().toUpperCase() || '',
      type: pool.type,
      timeframe: pool.timeframe,
      zoneLow: String(pool.zoneLow),
      zoneHigh: String(pool.zoneHigh),
      cleanlinessScore: String(pool.cleanlinessScore ?? 3),
      status: pool.status,
      levelIds: pool.levelIds || [],
      sweepRole: Boolean(pool.sweepRole)
    })
  }

  const handleSavePool = async () => {
    if (!session?.id) return
    const zoneLow = Number(poolDialog.zoneLow)
    const zoneHigh = Number(poolDialog.zoneHigh)
    if (!poolDialog.poolName.trim() || !poolDialog.symbol.trim() || !Number.isFinite(zoneLow) || !Number.isFinite(zoneHigh)) {
      return
    }
    const payload = {
      poolName: poolDialog.poolName.trim(),
      symbol: poolDialog.symbol.trim().toUpperCase(),
      type: poolDialog.type,
      timeframe: poolDialog.timeframe,
      zoneLow,
      zoneHigh,
      cleanlinessScore: Number(poolDialog.cleanlinessScore) || 3,
      status: poolDialog.status,
      sweepRole: poolDialog.sweepRole,
      levelIds: poolDialog.levelIds
    }

    if (poolDialog.editId) {
      await updatePoolMutation.mutateAsync({ id: poolDialog.editId, payload })
    } else {
      await createPoolMutation.mutateAsync(payload)
    }
    setPoolDialog((prev) => ({ ...prev, open: false }))
  }

  const handleDeletePool = async (poolId: string) => {
    await deletePoolMutation.mutateAsync(poolId)
  }

  const handleSetSweepPool = async (pool: SessionPool) => {
    if (!session?.id) return
    const nextSession = await setRolesMutation.mutateAsync({
      symbol: pool.symbol,
      sweepPoolId: pool.id
    })
    setActiveSweepPoolId(nextSession.activeSweepPoolId || null)
    setActiveSweepLevelId(nextSession.activeSweepLevelId || null)
  }

  const handleSuggestLevelsFromPlan = async () => {
    if (!session?.id) return
    const symbol = planner.symbol.trim().toUpperCase() || selectedPlan?.tradingViewSymbol || undefined
    const backendSuggestions = await suggestSessionLevels(session.id, symbol)
    const planSuggestions = parsePlanLevelSuggestions(selectedPlan).map(toPlanSuggestedLevelItem)

    const existing = new Set(sessionLevels.map(toSessionLevelDedupKey))
    const merged = [
      ...backendSuggestions.map(toSuggestedLevelItem),
      ...planSuggestions
    ]

    const seen = new Set<string>()
    const accepted = merged
      .filter((item) => item.confidence >= 0.55 || item.reason === 'Mentor plan level')
      .filter((item) => {
        const key = toSuggestedLevelDedupKey(item)
        if (existing.has(key) || seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
      .slice(0, 6)

    if (!accepted.length) return

    await Promise.all(accepted.map((item) => createLevelMutation.mutateAsync({
      label: item.label,
      symbol: symbol || null,
      type: item.type,
      timeframe: item.timeframe,
      ...toSuggestedLevelGeometryPayload(item),
      originRule: item.reason,
      strengthScore: Math.max(1, Math.min(5, Math.round((item.confidence || 0.5) * 5))),
      status: 'FRESH',
      expectation: 'MAGNET',
      category: 'LIQUIDITY',
      notes: null
    })))

    setSuccessMessage(t('today.session.levels.suggested'))
  }

  const reloadChartProfiles = async (preferredId?: string) => {
    setChartProfilesLoading(true)
    try {
      const profiles = await listChartProfiles('SESSION_MODE')
      setChartProfiles(profiles || [])
      if (preferredId && (profiles || []).some((item) => item.id === preferredId)) {
        setSelectedChartProfileId(preferredId)
        return
      }
      if (selectedChartProfileId && (profiles || []).some((item) => item.id === selectedChartProfileId)) {
        return
      }
      const defaultProfile = (profiles || []).find((item) => item.isDefault)
      setSelectedChartProfileId(defaultProfile?.id || '')
    } finally {
      setChartProfilesLoading(false)
    }
  }

  const buildCurrentChartEmbedConfig = (): ChartEmbedConfig => ({
    symbol: chartSymbol,
    interval: chartInterval,
    theme: chartTheme as 'LIGHT' | 'DARK' | 'SYSTEM',
    allowSymbolChange: chartAllowSymbolChange,
    hideControls: chartHideControls,
    timezone: user?.timezone || 'Europe/Bucharest',
    chartHeightPref: chartHeightPreference || (isCompactViewport ? 320 : 440)
  })

  const buildCurrentChartPrefs = () => ({
    showLevels: chartProfilePrefs.showLevels ?? true,
    followPlanSymbol
  })

  const handleSaveChartProfile = async () => {
    if (!selectedChartProfile) {
      await handleSaveAsChartProfile()
      return
    }
    const updated = await updateChartProfile(selectedChartProfile.id, {
      embedConfigJson: buildCurrentChartEmbedConfig(),
      tjaPrefsJson: buildCurrentChartPrefs()
    })
    await reloadChartProfiles(updated.id)
    setSuccessMessage(t('today.session.chartProfiles.saved'))
  }

  const handleSaveAsChartProfile = async () => {
    const suggested = selectedChartProfile?.name || t('today.session.chartProfiles.newProfile')
    const name = window.prompt(t('today.session.chartProfiles.promptName'), suggested)
    if (!name || !name.trim()) return
    const created = await createChartProfile({
      name: name.trim(),
      scope: 'SESSION_MODE',
      embedConfigJson: buildCurrentChartEmbedConfig(),
      tjaPrefsJson: buildCurrentChartPrefs()
    })
    await reloadChartProfiles(created.id)
    setSuccessMessage(t('today.session.chartProfiles.savedAs'))
  }

  const handleRenameChartProfile = async (profile: ChartProfile) => {
    const name = window.prompt(t('today.session.chartProfiles.promptRename'), profile.name)
    if (!name || !name.trim()) return
    await updateChartProfile(profile.id, { name: name.trim() })
    await reloadChartProfiles(profile.id)
  }

  const handleDeleteChartProfile = async (profile: ChartProfile) => {
    if (!window.confirm(t('today.session.chartProfiles.confirmDelete', { name: profile.name }))) return
    await deleteChartProfile(profile.id)
    await reloadChartProfiles(profile.id === selectedChartProfileId ? undefined : selectedChartProfileId)
  }

  const handleSetDefaultChartProfile = async (profile: ChartProfile) => {
    await setDefaultChartProfile(profile.id)
    await reloadChartProfiles(profile.id)
    setSuccessMessage(t('today.session.chartProfiles.defaultSet'))
  }

  const resetBacktestReplay = (nextState: BacktestReplayState = 'IDLE', message = '') => {
    setBacktestLoading(false)
    setBacktestIsPlaying(false)
    setBacktestReplayState(nextState)
    setBacktestReplayMessage(message)
    setBacktestRun(null)
    setBacktestCandles([])
    setBacktestCursor(0)
    setLatestBacktestTrade(null)
    setBacktestTrades([])
  }

  const applyDatasetDefaults = (
    dataset: Pick<BacktestDataset, 'id' | 'sourceId' | 'symbolDisplay' | 'timeframe' | 'dataFrom' | 'dataTo'>,
    summary?: BacktestDatasetSummary | null
  ) => {
    const range = resolveDatasetDateRangeDefaults({
      dataFrom: summary?.dataFromUtc || dataset.dataFrom,
      dataTo: summary?.dataToUtc || dataset.dataTo,
      timeframe: summary?.timeframe || dataset.timeframe,
      defaultFromUtc: summary?.defaultFromUtc,
      defaultToUtc: summary?.defaultToUtc,
      recommendedDefaultFromUtc: summary?.recommendedDefaultFromUtc,
      recommendedDefaultToUtc: summary?.recommendedDefaultToUtc
    })
    setBacktestSetup((prev) => ({
      ...prev,
      datasetId: dataset.id,
      sourceId: dataset.sourceId,
      symbol: summary?.symbolDisplay || dataset.symbolDisplay || prev.symbol,
      timeframe: ((summary?.timeframe || dataset.timeframe) as BacktestSetupState['timeframe']) || prev.timeframe,
      from: range.from,
      to: range.to
    }))
    resetBacktestReplay()
  }

  const loadBacktestDatasetSummary = async (
    dataset: Pick<BacktestDataset, 'id' | 'sourceId' | 'symbolDisplay' | 'timeframe' | 'dataFrom' | 'dataTo'>
  ) => {
    try {
      const summary = await getBacktestDatasetSummary(dataset.id)
      setBacktestDatasetSummary(summary)
      applyDatasetDefaults(dataset, summary)
      return summary
    } catch {
      setBacktestDatasetSummary(null)
      applyDatasetDefaults(dataset, null)
      return null
    }
  }

  const refreshBacktestDatasets = async () => {
    setBacktestDatasetsLoading(true)
    try {
      const datasets = await listBacktestDatasets()
      setBacktestDatasets(datasets || [])
    } catch (error) {
      const apiErr = error as ApiError
      setApiError(translateApiError(apiErr, t, 'today.session.backtest.errors.loadDatasets'))
    } finally {
      setBacktestDatasetsLoading(false)
    }
  }

  useEffect(() => {
    if (chartMode !== 'BACKTEST') {
      return
    }
    void refreshBacktestDatasets()
  }, [chartMode])

  useEffect(() => {
    if (chartMode !== 'BACKTEST' || backtestSetup.dataSource !== 'OANDA') {
      return
    }
    let mounted = true
    getOandaProviderStatus()
      .then((status) => {
        if (!mounted) return
        setOandaConnected(Boolean(status?.connected))
      })
      .catch(() => {
        if (!mounted) return
        setOandaConnected(null)
      })
    return () => {
      mounted = false
    }
  }, [chartMode, backtestSetup.dataSource])

  const backtestDatasetsForSource = useMemo(() => {
    return backtestDatasets.filter((dataset) => dataset.provider === backtestSetup.dataSource)
  }, [backtestDatasets, backtestSetup.dataSource])

  const selectedBacktestDataset = useMemo(() => {
    if (!backtestSetup.datasetId) return null
    return backtestDatasetsForSource.find((dataset) => dataset.id === backtestSetup.datasetId) || null
  }, [backtestDatasetsForSource, backtestSetup.datasetId])

  useEffect(() => {
    if (!selectedBacktestDataset) {
      setBacktestDatasetSummary(null)
    }
  }, [selectedBacktestDataset?.id])

  useEffect(() => {
    if (!selectedBacktestDataset) return

    let active = true
    getBacktestDataset(selectedBacktestDataset.id)
      .then(async (dataset) => {
        if (!active) return
        await loadBacktestDatasetSummary(dataset)
      })
      .catch(() => {
        if (!active) return
        void loadBacktestDatasetSummary(selectedBacktestDataset)
      })

    return () => {
      active = false
    }
  }, [selectedBacktestDataset?.id])

  const selectedDatasetFromIso = backtestDatasetSummary?.dataFromUtc || selectedBacktestDataset?.dataFrom
  const selectedDatasetToIso = backtestDatasetSummary?.dataToUtc || selectedBacktestDataset?.dataTo
  const selectedDatasetTimeframe = backtestDatasetSummary?.timeframe || selectedBacktestDataset?.timeframe || backtestSetup.timeframe
  const selectedDatasetPresetDays = resolveTimeframePresetDays(selectedDatasetTimeframe)
  const loadedRangeFromIso = backtestRun?.from || toIsoFromUnknownTimestamp(backtestCandles[0]?.timestamp)
  const loadedRangeToIso = backtestRun?.to || toIsoFromUnknownTimestamp(backtestCandles[backtestCandles.length - 1]?.timestamp)

  const applyDefaultBacktestRange = async (autoLoad = false) => {
    const range = resolveDatasetDateRangeDefaults({
      dataFrom: selectedDatasetFromIso,
      dataTo: selectedDatasetToIso,
      timeframe: selectedDatasetTimeframe,
      defaultFromUtc: backtestDatasetSummary?.defaultFromUtc,
      defaultToUtc: backtestDatasetSummary?.defaultToUtc,
      recommendedDefaultFromUtc: backtestDatasetSummary?.recommendedDefaultFromUtc,
      recommendedDefaultToUtc: backtestDatasetSummary?.recommendedDefaultToUtc
    })
    if (!range.from || !range.to) return
    const overrides: Partial<BacktestSetupState> = {
      from: range.from,
      to: range.to
    }
    setBacktestSetup((prev) => ({
      ...prev,
      ...overrides
    }))
    if (autoLoad) {
      await loadBacktestData(overrides)
      return
    }
    resetBacktestReplay()
  }

  const applyBacktestPreset = async (days: number) => {
    if (!selectedDatasetToIso) return
    const toDate = new Date(selectedDatasetToIso)
    if (Number.isNaN(toDate.getTime())) return
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000)
    const minDate = selectedDatasetFromIso ? new Date(selectedDatasetFromIso) : null
    const clampedFrom = minDate && !Number.isNaN(minDate.getTime()) && fromDate.getTime() < minDate.getTime()
      ? minDate
      : fromDate
    const overrides: Partial<BacktestSetupState> = {
      from: toDateInputValue(clampedFrom),
      to: toDateInputValue(toDate)
    }
    setBacktestSetup((prev) => ({
      ...prev,
      ...overrides
    }))
    await loadBacktestData(overrides)
  }

  const handleBacktestSourceChange = (source: BacktestDataSource) => {
    resetBacktestReplay()
    setBacktestDatasetSummary(null)
    setBacktestSetup((prev) => ({
      ...prev,
      dataSource: source,
      datasetId: '',
      sourceId: source === 'DEMO' ? 'DEMO' : '',
      from: source === 'OANDA' ? prev.from : '',
      to: source === 'OANDA' ? prev.to : ''
    }))
    setCsvUploads([])
    if (source === 'DEMO') {
      setBacktestDatasetsLoading(true)
      loadDemoBacktestDatasets()
        .then((rows) => {
          setBacktestDatasets(rows || [])
          if ((rows || []).length > 0) {
            void loadBacktestDatasetSummary(rows[0])
          }
        })
        .catch((error) => {
          const apiErr = error as ApiError
          setApiError(translateApiError(apiErr, t, 'today.session.backtest.errors.loadDemo'))
        })
        .finally(() => {
          setBacktestDatasetsLoading(false)
        })
    }
  }

  const handleCsvFilesSelected = async (files: FileList | null) => {
    if (!files?.length) return
    const nextUploads: CsvUploadItem[] = []
    for (const file of Array.from(files)) {
      try {
        const preview = await parseCsvPreview(file)
        const upload = await uploadBacktestCsv(file)
        const mappingDraft = mappingFromUpload(upload, preview)
        const mergedWarnings = Array.from(new Set([...(upload.warnings || []), ...(preview.warnings || [])]))
        nextUploads.push({
          ...upload,
          mappingRequired: upload.mappingRequired || !isCsvMappingComplete(mappingDraft),
          detectedTimeFormat: upload.detectedTimeFormat || preview.detectedTimeFormat,
          detectedTimeframe: upload.detectedTimeframe || preview.detectedTimeframe,
          dataFrom: upload.dataFrom || preview.dataFrom,
          dataTo: upload.dataTo || preview.dataTo,
          warnings: mergedWarnings,
          mappingDraft,
          preview
        })
      } catch (error) {
        const apiErr = error as ApiError
        setApiError(translateApiError(apiErr, t, 'today.session.backtest.errors.uploadFailed'))
      }
    }
    if (nextUploads.length > 0) {
      setCsvUploads((prev) => [...nextUploads, ...prev])
      setSuccessMessage(t('today.session.backtest.uploaded'))
    }
    if (csvUploadInputRef.current) {
      csvUploadInputRef.current.value = ''
    }
  }

  const handleCsvMappingDraftChange = (fileId: string, field: keyof CsvColumnMapping, value: string) => {
    setCsvUploads((prev) => prev.map((item) => {
      if (item.fileId !== fileId) return item
      return {
        ...item,
        mappingDraft: {
          ...item.mappingDraft,
          [field]: value
        }
      }
    }))
  }

  const loadBacktestData = async (setupOverrides: Partial<BacktestSetupState> = {}) => {
    const effectiveSetup: BacktestSetupState = {
      ...backtestSetup,
      ...setupOverrides
    }
    const requiresDataset = effectiveSetup.dataSource === 'CSV' || effectiveSetup.dataSource === 'DEMO'
    if (!requiresDataset && !effectiveSetup.symbol.trim()) {
      setApiError(t('today.session.backtest.errors.setupRequired'))
      return false
    }
    if (requiresDataset && !effectiveSetup.datasetId) {
      setApiError(t('today.session.backtest.errors.datasetRequired'))
      return false
    }

    const fromIso = toDateRangeIso(effectiveSetup.from, 'start')
    const toIso = toDateRangeIso(effectiveSetup.to, 'end')
    if (!fromIso || !toIso) {
      setApiError(t('today.session.backtest.errors.dateRangeRequired'))
      return false
    }

    setBacktestLoading(true)
    setBacktestIsPlaying(false)
    setBacktestReplayState('LOADING')
    setBacktestReplayMessage('')
    setBacktestCandles([])
    setBacktestCursor(0)
    setBacktestRun(null)
    setBacktestTrades([])
    setLatestBacktestTrade(null)
    setApiError('')
    try {
      const selectedDataset = requiresDataset
        ? backtestDatasets.find((dataset) => dataset.id === effectiveSetup.datasetId)
        : null

      const candlesResponse = requiresDataset
        ? await getBacktestCandles({
          datasetId: selectedDataset?.id || effectiveSetup.datasetId || undefined,
          fromUtc: fromIso,
          toUtc: toIso
        })
        : await getBacktestCandles({
          provider: effectiveSetup.dataSource,
          dataSource: effectiveSetup.dataSource,
          sourceId: selectedDataset?.sourceId || effectiveSetup.sourceId || undefined,
          symbol: selectedDataset?.symbolDisplay || effectiveSetup.symbol || undefined,
          timeframe: selectedDataset?.timeframe || effectiveSetup.timeframe,
          fromUtc: fromIso,
          toUtc: toIso
        })
      const candleNormalization = normalizeBacktestCandlesWithDiagnostics(candlesResponse.candles || [])
      const normalizedCandles = candleNormalization.candles

      const effectiveFrom = candlesResponse.effectiveFromUtc || candlesResponse.from || fromIso
      const effectiveTo = candlesResponse.effectiveToUtc || candlesResponse.to || toIso
      setBacktestSetup((prev) => ({
        ...prev,
        ...setupOverrides,
        from: toDateInputFromIso(effectiveFrom) || prev.from,
        to: toDateInputFromIso(effectiveTo) || prev.to
      }))

      if (candleNormalization.invalidRows > 0) {
        setBacktestReplayState('ERROR')
        const details = candleNormalization.invalidReasons.join(' ')
        setBacktestReplayMessage(
          details
            ? `Candle data invalid for chart rendering. Check CSV format/timezone. ${details}`
            : 'Candle data invalid for chart rendering. Check CSV format/timezone.'
        )
        return false
      }

      if (!normalizedCandles.length) {
        setBacktestReplayState('EMPTY')
        setBacktestReplayMessage(candlesResponse.message || t('today.session.backtest.emptyRange'))
        return false
      }

      const run = await createBacktestRun({
        symbol: (selectedDataset?.symbolDisplay || effectiveSetup.symbol).trim().toUpperCase(),
        timeframe: selectedDataset?.timeframe || effectiveSetup.timeframe,
        from: effectiveFrom,
        to: effectiveTo,
        sessionWindow: effectiveSetup.sessionWindow || undefined,
        spread: effectiveSetup.spread ? Number(effectiveSetup.spread) : undefined,
        slippage: effectiveSetup.slippage ? Number(effectiveSetup.slippage) : undefined,
        dataSource: effectiveSetup.dataSource,
        provider: effectiveSetup.dataSource,
        sourceId: (selectedDataset?.sourceId || effectiveSetup.sourceId || undefined),
        datasetId: selectedDataset?.id || effectiveSetup.datasetId || undefined
      })
      setBacktestRun(run)
      setBacktestCandles(normalizedCandles)
      setBacktestCursor(0)
      setBacktestReplayState('READY')
      if (candleNormalization.warnings.length > 0) {
        setBacktestReplayMessage(`Loaded with warnings. ${candleNormalization.warnings[0]}`)
      }
      const trades = await listBacktestTrades(run.id)
      setBacktestTrades(trades || [])
      if (trades?.length) {
        setLatestBacktestTrade(trades[0])
      }
      setSuccessMessage(t('today.session.backtest.loaded'))
      return true
    } catch (error) {
      setBacktestReplayState('ERROR')
      setBacktestReplayMessage('')
      const apiErr = error as ApiError
      setApiError(translateApiError(apiErr, t, 'today.session.backtest.errors.loadFailed'))
      return false
    } finally {
      setBacktestLoading(false)
    }
  }

  const handleIngestCsvUpload = async (upload: CsvUploadItem) => {
    setCsvIngestingFileId(upload.fileId)
    setApiError('')
    try {
      const mappingPayload = upload.mappingRequired ? mappingToIngestPayload(upload) : undefined
      const ingest = await ingestBacktestCsv(upload.fileId, {
        mapping: mappingPayload,
        symbol: upload.detectedSymbol || undefined,
        timeframe: upload.detectedTimeframe || undefined,
        datasetName: upload.fileName
      })
      await refreshBacktestDatasets()
      let datasetForReplay: BacktestDataset | null = ingest.dataset || null
      const datasetId = ingest.dataset?.id
      if (datasetId) {
        try {
          datasetForReplay = await getBacktestDataset(datasetId)
        } catch {
          datasetForReplay = ingest.dataset
        }
      }

      if (datasetForReplay) {
        const summary = await loadBacktestDatasetSummary(datasetForReplay)
        const defaults = resolveDatasetDateRangeDefaults({
          dataFrom: summary?.dataFromUtc || datasetForReplay.dataFrom,
          dataTo: summary?.dataToUtc || datasetForReplay.dataTo,
          timeframe: summary?.timeframe || datasetForReplay.timeframe,
          defaultFromUtc: summary?.defaultFromUtc,
          defaultToUtc: summary?.defaultToUtc,
          recommendedDefaultFromUtc: summary?.recommendedDefaultFromUtc,
          recommendedDefaultToUtc: summary?.recommendedDefaultToUtc
        })
        const setupOverrides: Partial<BacktestSetupState> = {
          dataSource: 'CSV',
          datasetId: datasetForReplay.id,
          sourceId: datasetForReplay.sourceId,
          symbol: summary?.symbolDisplay || datasetForReplay.symbolDisplay,
          timeframe: ((summary?.timeframe || datasetForReplay.timeframe) as BacktestSetupState['timeframe']) || backtestSetup.timeframe,
          from: defaults.from,
          to: defaults.to
        }
        setBacktestSetup((prev) => ({ ...prev, ...setupOverrides }))
        await loadBacktestData(setupOverrides)
      }

      setCsvUploads((prev) => prev.filter((item) => item.fileId !== upload.fileId))
      setSuccessMessage(t('today.session.backtest.ingested'))
    } catch (error) {
      const apiErr = error as ApiError
      setApiError(translateApiError(apiErr, t, 'today.session.backtest.errors.ingestFailed'))
    } finally {
      setCsvIngestingFileId(null)
    }
  }

  const handleLoadBacktestData = async () => {
    await loadBacktestData()
  }

  const handleResetBacktestReplay = () => {
    resetBacktestReplay()
  }

  const handleStepReplay = (step: number) => {
    if (!backtestCandles.length) return
    setBacktestIsPlaying(false)
    setBacktestCursor((prev) => {
      const max = Math.max(backtestCandles.length - 1, 0)
      return Math.min(Math.max(prev + step, 0), max)
    })
  }

  const handleJumpReplay = () => {
    if (!backtestCandles.length) return
    setBacktestIsPlaying(false)
    const cursorTimestampIso = toIsoFromUnknownTimestamp(backtestCandles[backtestCursor]?.timestamp)
    const input = window.prompt(t('today.session.backtest.jumpPrompt'), cursorTimestampIso || '')
    if (!input) return
    const target = new Date(input).getTime()
    if (!Number.isFinite(target)) return
    const index = backtestCandles.findIndex((candle) => {
      const candleIso = toIsoFromUnknownTimestamp(candle.timestamp)
      if (!candleIso) return false
      return new Date(candleIso).getTime() >= target
    })
    if (index >= 0) {
      setBacktestCursor(index)
    }
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

    if (chartMode === 'BACKTEST') {
      if (!backtestRun) {
        setApiError(t('today.session.backtest.errors.loadDataFirst'))
        return
      }

      const replayCursorTime = toIsoFromUnknownTimestamp(backtestCandles[backtestCursor]?.timestamp)
      if (!replayCursorTime) {
        setApiError(t('today.session.backtest.errors.loadDataFirst'))
        return
      }

      const trade = await simulateBacktestTrade(backtestRun.id, {
        direction: planner.direction,
        orderType: 'MARKET',
        stopLossPrice,
        takeProfitPrice: planner.takeProfitPrice ? Number(planner.takeProfitPrice) : undefined,
        riskAmount: manualRisk ?? undefined,
        invalidationText: planner.invalidation.trim(),
        replayCursorTime,
        conservativeSameBar: true,
        strategyId: selectedStrategy?.id,
        prereqsTemplateId: session.prereqsTemplateId || undefined,
        triggersTemplateId: session.triggerTemplateId || undefined,
        selectedSweepLevelId: activeSweepLevelId || undefined,
        prereqsStatesJson: prereqChecklist,
        triggersStatesJson: triggerChecklist,
        levelsSnapshotJson: sessionLevels,
        lockInSnapshotJson: lockIn,
        qualityScoreInputsJson: {
          setupQualityScore,
          prerequisitesComplete,
          triggersComplete,
          narrativeComplete,
          rolesComplete,
          rrMet,
          newsSafe
        }
      })
      setLatestBacktestTrade(trade)
      const nextTrades = await listBacktestTrades(backtestRun.id)
      setBacktestTrades(nextTrades || [])
      setSuccessMessage(t('today.session.backtest.tradeSimulated'))
      return
    }

    await startTradeMutation.mutateAsync(buildLiveStartTradePayload())
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

  const handleToggleAutoTrade = () => {
    if (autoTradeStatus === 'ARMED' || autoTradeStatus === 'ACTIVE') {
      setAutoTradeStatus('DISARMED')
      setAutoTradeArmedAt(null)
      void pushAutoTradeEvent({
        type: 'DISARMED',
        tradeId: session?.activeTrade?.id || null,
        note: t('today.session.autoTrade.disarmed')
      })
      return
    }

    if (chartMode !== 'LIVE') {
      setApiError(t('today.session.autoTrade.liveOnly'))
      return
    }
    if (!planner.symbol.trim()) {
      setApiError(t('today.session.autoTrade.symbolRequired'))
      return
    }

    const entryPrice = Number(planner.entryPrice)
    const stopLossPrice = Number(planner.stopLossPrice)
    const takeProfitPrice = Number(planner.takeProfitPrice)
    if (
      !Number.isFinite(entryPrice)
      || entryPrice <= 0
      || !Number.isFinite(stopLossPrice)
      || stopLossPrice <= 0
      || !Number.isFinite(takeProfitPrice)
      || takeProfitPrice <= 0
    ) {
      setApiError(t('today.session.autoTrade.levelsRequired'))
      return
    }
    if (!liveQuote?.available || liveQuote.bid == null || liveQuote.ask == null) {
      setApiError(t('today.session.autoTrade.quoteUnavailable'))
      return
    }

    const nowIso = new Date().toISOString()
    setAutoTradeArmedAt(nowIso)
    setAutoTradeStatus(session?.activeTrade ? 'ACTIVE' : 'ARMED')
    setApiError('')
    void pushAutoTradeEvent({
      type: 'ARMED',
      tradeId: session?.activeTrade?.id || null,
      note: session?.activeTrade
        ? t('today.session.autoTrade.armedForClose')
        : t('today.session.autoTrade.armed')
    })
  }

  const handleAutoTradeCloseNow = async () => {
    if (!session?.activeTrade || autoTradeBusy) return
    if (!liveQuote?.available || liveQuote.bid == null || liveQuote.ask == null) {
      setApiError(t('today.session.autoTrade.quoteUnavailable'))
      return
    }
    const closeSide: QuoteSide = planner.direction === 'LONG' ? 'BID' : 'ASK'
    const closePrice = closeSide === 'ASK' ? liveQuote.ask : liveQuote.bid

    setAutoTradeBusy(true)
    void pushAutoTradeEvent({
      type: 'MANUAL_CLOSE',
      side: closeSide,
      price: closePrice,
      tradeId: session.activeTrade.id,
      note: t('today.session.autoTrade.manualClose')
    })
    try {
      await closeTradeMutation.mutateAsync({
        tradeId: session.activeTrade.id,
        payload: {
          exitPrice: closePrice,
          ruleBreaks: [],
          postTradeNotes: t('today.session.autoTrade.manualClose')
        }
      })
      setAutoTradeStatus('CLOSED')
      setAutoTradeArmedAt(null)
    } finally {
      setAutoTradeBusy(false)
    }
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
    <Stack
      spacing={2.5}
      sx={{
        minWidth: 0,
        overflowX: 'clip',
        pb: isMobileViewport
          ? 'max(96px, calc(72px + env(safe-area-inset-bottom)))'
          : 'max(8px, env(safe-area-inset-bottom))'
      }}
    >
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
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
                                  {selectedSweepLevel
                                    ? t('today.session.levels.selectedSweep', { label: selectedSweepLevel.label })
                                    : selectedSweepPool
                                      ? t('today.session.levels.selectedSweep', { label: selectedSweepPool.poolName })
                                      : t('today.session.levels.noSweep')}
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
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ md: 'center' }} justifyContent="space-between">
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} sx={{ minWidth: 0 }}>
                              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
                                <InputLabel id="session-mode-select">{t('today.session.chart.modeLabel')}</InputLabel>
                                <Select
                                  labelId="session-mode-select"
                                  label={t('today.session.chart.modeLabel')}
                                  value={chartMode}
                                  onChange={(event) => {
                                    const nextMode = event.target.value as SessionChartMode
                                    setChartMode(nextMode)
                                    if (nextMode !== 'BACKTEST') {
                                      resetBacktestReplay()
                                    } else {
                                      setBacktestIsPlaying(false)
                                    }
                                  }}
                                >
                                  <MenuItem value="LIVE">{t('today.session.chart.modeLive')}</MenuItem>
                                  <MenuItem value="BACKTEST">{t('today.session.chart.modeBacktest')}</MenuItem>
                                </Select>
                              </FormControl>

                              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                                <InputLabel id="chart-profile-select" shrink>{t('today.session.chartProfiles.label')}</InputLabel>
                                <Select
                                  labelId="chart-profile-select"
                                  label={t('today.session.chartProfiles.label')}
                                  value={selectedChartProfileId}
                                  onChange={(event) => setSelectedChartProfileId(event.target.value)}
                                  displayEmpty
                                >
                                  <MenuItem value="">{t('today.session.chartProfiles.defaultPlaceholder')}</MenuItem>
                                  {chartProfiles.map((profile) => (
                                    <MenuItem key={profile.id} value={profile.id}>
                                      {profile.name}{profile.isDefault ? ` (${t('today.session.chartProfiles.defaultTag')})` : ''}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Stack>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                              <Button size="small" variant="outlined" onClick={() => void handleSaveChartProfile()} disabled={chartProfilesLoading}>
                                {t('today.session.chartProfiles.save')}
                              </Button>
                              <Button size="small" variant="outlined" onClick={() => void handleSaveAsChartProfile()} disabled={chartProfilesLoading}>
                                {t('today.session.chartProfiles.saveAs')}
                              </Button>
                              <Button size="small" variant="outlined" onClick={() => setChartProfileManageOpen(true)} disabled={chartProfilesLoading}>
                                {t('today.session.chartProfiles.manage')}
                              </Button>
                            </Stack>
                          </Stack>

                          <FormControlLabel
                            control={<Checkbox checked={followPlanSymbol} onChange={(event) => setFollowPlanSymbol(event.target.checked)} />}
                            label={t('today.session.chartProfiles.followPlanSymbol')}
                          />

                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ md: 'center' }}>
                            <Chip size="small" label={`${t('today.session.chart.bias')}: ${lockIn.bias || t('common.na')}`} />
                            <Chip size="small" label={`${t('today.session.chart.session')}: ${lockIn.session || t('common.na')}`} />
                            <Chip size="small" variant="outlined" label={`${t('today.session.chart.modeLabel')}: ${chartModeLabel}`} />
                            <Chip size="small" label={`${t('today.session.chart.local')}: ${localNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                            {chartMode === 'LIVE' && (
                              liveQuote?.available && liveQuote.bid != null && liveQuote.ask != null && liveQuote.spread != null ? (
                                <Chip
                                  size="small"
                                  color="info"
                                  label={t('today.session.autoTrade.quoteChip', {
                                    bid: formatNumber(liveQuote.bid, 5),
                                    ask: formatNumber(liveQuote.ask, 5),
                                    spread: formatNumber(liveQuote.spread, 5)
                                  })}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  label={t('today.session.autoTrade.quoteUnavailable')}
                                />
                              )
                            )}
                            {chartMode === 'LIVE' && liveQuote?.available && liveQuote.tsUtc && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t('today.session.autoTrade.quoteTs', {
                                  time: new Date(liveQuote.tsUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                })}
                              />
                            )}
                            <Chip size="small" color={newsSafe ? 'success' : 'warning'} label={newsSafe ? t('today.session.chart.newsSafe') : t('today.session.chart.newsCaution')} />
                            {(selectedSweepLevel || selectedSweepPool) && (
                              <Chip
                                size="small"
                                color="info"
                                label={t('today.session.levels.selectedSweep', { label: selectedSweepLevel?.label || selectedSweepPool?.poolName || '' })}
                              />
                            )}
                          </Stack>

                          <Box sx={{ p: 1, border: '1px solid', borderColor: autoTradeStatus === 'DISARMED' ? 'divider' : 'info.light', borderRadius: 1.5 }}>
                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="subtitle2">{t('today.session.autoTrade.title')}</Typography>
                                <Chip
                                  size="small"
                                  color={autoTradeStatus === 'ACTIVE' ? 'success' : (autoTradeStatus === 'ARMED' ? 'warning' : 'default')}
                                  label={`${t('today.session.autoTrade.statusLabel')}: ${t(`today.session.autoTrade.status.${autoTradeStatus}`)}`}
                                />
                              </Stack>
                              <Alert severity="info">{t('today.session.autoTrade.journalOnly')}</Alert>
                              <Typography variant="caption" color="text.secondary">
                                {t('today.session.autoTrade.tabWarning')}
                              </Typography>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                                <TextField
                                  size="small"
                                  type="number"
                                  label={t('today.session.autoTrade.tolerancePips')}
                                  value={autoTradeTolerancePips}
                                  onChange={(event) => setAutoTradeTolerancePips(event.target.value)}
                                  sx={{ minWidth: { sm: 140 } }}
                                />
                                <TextField
                                  size="small"
                                  type="number"
                                  label={t('today.session.autoTrade.timeoutMinutes')}
                                  value={autoTradeTimeoutMinutes}
                                  onChange={(event) => setAutoTradeTimeoutMinutes(event.target.value)}
                                  sx={{ minWidth: { sm: 140 } }}
                                />
                                <Button
                                  size="small"
                                  variant={autoTradeStatus === 'ARMED' || autoTradeStatus === 'ACTIVE' ? 'outlined' : 'contained'}
                                  color={autoTradeStatus === 'ARMED' || autoTradeStatus === 'ACTIVE' ? 'warning' : 'primary'}
                                  onClick={handleToggleAutoTrade}
                                  disabled={autoTradeBusy}
                                >
                                  {autoTradeStatus === 'ARMED' || autoTradeStatus === 'ACTIVE'
                                    ? t('today.session.autoTrade.disarm')
                                    : t('today.session.autoTrade.arm')}
                                </Button>
                                {autoTradeStatus === 'ARMED' && (
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => {
                                      setAutoTradeStatus('DISARMED')
                                      setAutoTradeArmedAt(null)
                                      void pushAutoTradeEvent({
                                        type: 'DISARMED',
                                        note: t('today.session.autoTrade.notFilled')
                                      })
                                    }}
                                  >
                                    {t('today.session.autoTrade.notFilledAction')}
                                  </Button>
                                )}
                                {session.activeTrade && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => void handleAutoTradeCloseNow()}
                                    disabled={autoTradeBusy}
                                  >
                                    {t('today.session.autoTrade.closeNow')}
                                  </Button>
                                )}
                              </Stack>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
                                {autoTradeArmedAt ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {t('today.session.autoTrade.armedAt', {
                                      time: new Date(autoTradeArmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                    })}
                                  </Typography>
                                ) : (
                                  <span />
                                )}
                                <Button size="small" variant="text" onClick={() => setAutoTradeLogOpen((prev) => !prev)}>
                                  {autoTradeLogOpen ? t('today.session.autoTrade.hideLog') : t('today.session.autoTrade.showLog')}
                                </Button>
                              </Stack>
                              {autoTradeLogOpen && (
                                <Stack spacing={0.5} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.25 }}>
                                  {autoTradeEvents.length === 0 ? (
                                    <Typography variant="caption" color="text.secondary">{t('today.session.autoTrade.logEmpty')}</Typography>
                                  ) : (
                                    autoTradeEvents.slice(0, 14).map((event) => (
                                      <Box key={event.localKey} sx={{ p: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                            {t(`today.session.autoTrade.event.${event.type}`)}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {new Date(event.tsUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                          </Typography>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                          {event.price != null ? `${formatNumber(event.price, 5)} ${event.side ? `(${event.side})` : ''}` : t('common.na')}
                                        </Typography>
                                        {event.note && (
                                          <Typography variant="caption" color="text.secondary">
                                            {event.note}
                                          </Typography>
                                        )}
                                      </Box>
                                    ))
                                  )}
                                </Stack>
                              )}
                            </Stack>
                          </Box>

                          <Box sx={{ p: 1, border: '1px solid', borderColor: narrativeComplete ? 'success.light' : 'divider', borderRadius: 1.5 }}>
                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="subtitle2">{t('today.session.narrative.title')}</Typography>
                                <Chip
                                  size="small"
                                  color={narrativeSaved ? 'success' : 'default'}
                                  label={narrativeSaved ? t('today.session.narrative.saved') : t('today.session.narrative.pending')}
                                />
                              </Stack>
                              <Grid container spacing={1}>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    select
                                    size="small"
                                    label={t('today.session.narrative.draw')}
                                    value={narrative.htfDraw || ''}
                                    onChange={(event) => {
                                      setNarrative((prev) => ({ ...prev, htfDraw: (event.target.value || null) as SessionNarrative['htfDraw'] }))
                                      setNarrativeSaved(false)
                                    }}
                                    fullWidth
                                  >
                                    <MenuItem value="">{t('common.none')}</MenuItem>
                                    {NARRATIVE_HTF_OPTIONS.map((option) => (
                                      <MenuItem key={option} value={option}>{t(`today.session.enums.htfDraw.${option}`)}</MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    select
                                    size="small"
                                    label={t('today.session.narrative.manipulation')}
                                    value={narrative.expectedManipulation || ''}
                                    onChange={(event) => {
                                      setNarrative((prev) => ({ ...prev, expectedManipulation: (event.target.value || null) as SessionNarrative['expectedManipulation'] }))
                                      setNarrativeSaved(false)
                                    }}
                                    fullWidth
                                  >
                                    <MenuItem value="">{t('common.none')}</MenuItem>
                                    {NARRATIVE_MANIPULATION_OPTIONS.map((option) => (
                                      <MenuItem key={option} value={option}>{t(`today.session.enums.manipulation.${option}`)}</MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    select
                                    size="small"
                                    label={t('today.session.narrative.confirmation')}
                                    value={narrative.confirmationModel || 'DISPLACEMENT_M5_MSS_M5'}
                                    onChange={(event) => {
                                      setNarrative((prev) => ({ ...prev, confirmationModel: (event.target.value || null) as SessionNarrative['confirmationModel'] }))
                                      setNarrativeSaved(false)
                                    }}
                                    fullWidth
                                  >
                                    {NARRATIVE_CONFIRMATION_OPTIONS.map((option) => (
                                      <MenuItem key={option} value={option}>{t(`today.session.enums.confirmation.${option}`)}</MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <TextField
                                    select
                                    size="small"
                                    label={t('today.session.narrative.delivery')}
                                    value={narrative.deliveryModel || ''}
                                    onChange={(event) => {
                                      setNarrative((prev) => ({ ...prev, deliveryModel: (event.target.value || null) as SessionNarrative['deliveryModel'] }))
                                      setNarrativeSaved(false)
                                    }}
                                    fullWidth
                                  >
                                    <MenuItem value="">{t('common.none')}</MenuItem>
                                    {NARRATIVE_DELIVERY_OPTIONS.map((option) => (
                                      <MenuItem key={option} value={option}>{t(`today.session.enums.delivery.${option}`)}</MenuItem>
                                    ))}
                                  </TextField>
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    size="small"
                                    label={t('today.session.narrative.notes')}
                                    value={narrative.notes || ''}
                                    onChange={(event) => {
                                      setNarrative((prev) => ({ ...prev, notes: event.target.value.slice(0, 400) }))
                                      setNarrativeSaved(false)
                                    }}
                                    fullWidth
                                  />
                                </Grid>
                              </Grid>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                                <Typography variant="caption" color={narrativeComplete ? 'success.main' : 'text.secondary'}>
                                  {narrativeComplete ? t('today.session.narrative.complete') : t('today.session.narrative.incomplete')}
                                </Typography>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => void handleSaveNarrative()}
                                  disabled={narrativeMutation.isLoading}
                                >
                                  {narrativeMutation.isLoading ? t('today.session.config.saving') : t('today.session.narrative.save')}
                                </Button>
                              </Stack>
                            </Stack>
                          </Box>

                          <Box sx={{ p: 1, border: '1px solid', borderColor: rolesComplete ? 'success.light' : 'divider', borderRadius: 1.5 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} flexWrap="wrap" useFlexGap>
                              <Chip size="small" color={selectedSweepLevel || selectedSweepPool ? 'info' : 'default'} label={`${t('today.session.roles.sweep')}: ${(selectedSweepLevel?.label || selectedSweepPool?.poolName || t('common.none'))}`} />
                              <Chip size="small" color={selectedEntryLevel ? 'success' : 'default'} label={`${t('today.session.roles.entry')}: ${(selectedEntryLevel?.label || t('common.none'))}`} />
                              <Chip size="small" color={selectedSlLevel ? 'warning' : 'default'} label={`${t('today.session.roles.sl')}: ${(selectedSlLevel?.label || t('common.none'))}`} />
                              <Chip size="small" color={selectedTpLevel ? 'secondary' : 'default'} label={`${t('today.session.roles.tp')}: ${(selectedTpLevel?.label || t('common.none'))}`} />
                            </Stack>
                          </Box>

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
                            <Button size="small" variant="outlined" onClick={() => openPoolDialog()}>
                              {t('today.session.pools.create')}
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
                              ([
                                ['htf', t('today.session.levels.groups.htfDraws')],
                                ['sessionRange', t('today.session.levels.groups.sessionRange')],
                                ['pool', t('today.session.levels.groups.liquidityPools')],
                                ['other', t('today.session.levels.groups.other')]
                              ] as const).map(([key, groupLabel]) => {
                                const levels = groupedLevels[key]
                                if (!levels.length) return null
                                return (
                                  <Accordion key={key} disableGutters sx={{ bgcolor: 'transparent' }} defaultExpanded={!isMobileViewport}>
                                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="body2">{groupLabel}</Typography>
                                        <Chip size="small" variant="outlined" label={levels.length} />
                                      </Stack>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                      <Stack spacing={0.75}>
                                        {levels.map((level) => (
                                          <Box
                                            key={level.id}
                                            sx={{ p: 0.9, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                                          >
                                            <Stack spacing={0.8}>
                                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }} justifyContent="space-between">
                                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
                                                  <Chip size="small" label={level.label} sx={{ maxWidth: '100%' }} />
                                                  <Chip size="small" variant="outlined" label={level.type || inferLevelType(level.label)} />
                                                  <Chip size="small" variant="outlined" label={level.timeframe || 'M15'} />
                                                  <Chip size="small" variant="outlined" label={level.status || (level.sweptAt ? 'SWEPT' : 'FRESH')} />
                                                  {level.price != null && (
                                                    <Chip size="small" variant="outlined" label={formatNumber(level.price, 4)} />
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
                                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
                                                <Typography variant="caption" color="text.secondary">
                                                  {t('today.session.levels.strength')}: {level.strengthScore ?? 3}/5
                                                </Typography>
                                                {level.originRule && (
                                                  <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {level.originRule}
                                                  </Typography>
                                                )}
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
                                                <FormControl size="small" sx={{ minWidth: 160 }}>
                                                  <InputLabel>{t('today.session.levels.expectation')}</InputLabel>
                                                  <Select
                                                    label={t('today.session.levels.expectation')}
                                                    value={level.expectation || ''}
                                                    onChange={(event) => {
                                                      void updateLevelMutation.mutateAsync({
                                                        id: level.id,
                                                        payload: {
                                                          label: level.label,
                                                          price: level.price ?? null,
                                                          category: level.category,
                                                          notes: level.notes ?? null,
                                                          expectation: event.target.value || null
                                                        }
                                                      })
                                                    }}
                                                  >
                                                    <MenuItem value="">{t('common.none')}</MenuItem>
                                                    {LEVEL_EXPECTATION_OPTIONS.map((option) => (
                                                      <MenuItem key={option} value={option}>{t(`today.session.levels.expectations.${option}`)}</MenuItem>
                                                    ))}
                                                  </Select>
                                                </FormControl>
                                              </Stack>
                                            </Stack>
                                          </Box>
                                        ))}
                                      </Stack>
                                    </AccordionDetails>
                                  </Accordion>
                                )
                              })
                            )}
                          </Stack>

                          <Stack spacing={0.75}>
                            <Typography variant="subtitle2">{t('today.session.pools.title')}</Typography>
                            {sessionPools.length === 0 ? (
                              <Typography variant="caption" color="text.secondary">{t('today.session.pools.empty')}</Typography>
                            ) : (
                              sessionPools.map((pool) => (
                                <Box key={pool.id} sx={{ p: 0.9, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                                  <Stack spacing={0.75}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        <Chip size="small" label={pool.poolName} />
                                        <Chip size="small" variant="outlined" label={`${formatNumber(pool.zoneLow, 4)} - ${formatNumber(pool.zoneHigh, 4)}`} />
                                        <Chip size="small" variant="outlined" label={pool.status} />
                                        <Chip size="small" variant="outlined" label={`${t('today.session.pools.cleanliness')}: ${pool.cleanlinessScore}/5`} />
                                      </Stack>
                                      <Stack direction="row" spacing={0.5}>
                                        <Button size="small" variant="text" onClick={() => void handleSetSweepPool(pool)}>{t('today.session.pools.setSweep')}</Button>
                                        <Button size="small" variant="text" onClick={() => openPoolDialog(pool)}>{t('today.session.levels.edit')}</Button>
                                        <Button size="small" color="error" variant="text" onClick={() => void handleDeletePool(pool.id)}>{t('today.session.levels.delete')}</Button>
                                      </Stack>
                                    </Stack>
                                  </Stack>
                                </Box>
                              ))
                            )}
                          </Stack>
                        </Stack>
                      </Box>

                      {chartMode === 'LIVE' ? (
                        <TradingViewWidget
                          symbol={chartSymbol}
                          interval={chartInterval}
                          themePreference={chartTheme}
                          hideControls={chartHideControls}
                          allowSymbolChange={chartAllowSymbolChange}
                          minHeight={chartHeightPreference || (isCompactViewport ? 320 : 440)}
                          fallbackMessage={t('today.session.mentor.liveChartFallback')}
                          fallbackLinkLabel={t('today.session.mentor.openOnTradingView')}
                        />
                      ) : (
                        <Stack spacing={1}>
                          <Accordion defaultExpanded={!isMobileViewport}>
                            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                              <Box>
                                <Typography variant="subtitle2">{t('today.session.backtest.setupTitle')}</Typography>
                                <Typography variant="caption" color="text.secondary">{t('today.session.backtest.setupHint')}</Typography>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Stack spacing={1}>
                                <Grid container spacing={1}>
                                  <Grid item xs={12} sm={6} md={3}>
                                    <FormControl fullWidth size="small">
                                      <InputLabel id="backtest-data-source">{t('today.session.backtest.dataSource')}</InputLabel>
                                      <Select
                                        labelId="backtest-data-source"
                                        label={t('today.session.backtest.dataSource')}
                                        value={backtestSetup.dataSource}
                                        onChange={(event) => handleBacktestSourceChange(event.target.value as BacktestDataSource)}
                                      >
                                        <MenuItem value="CSV">{t('today.session.backtest.sources.csv')}</MenuItem>
                                        <MenuItem value="OANDA">{t('today.session.backtest.sources.oanda')}</MenuItem>
                                        <MenuItem value="DEMO">{t('today.session.backtest.sources.demo')}</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>

                                  {backtestSetup.dataSource !== 'OANDA' && (
                                    <Grid item xs={12} sm={6} md={4}>
                                      <FormControl fullWidth size="small">
                                        <InputLabel id="backtest-dataset-id">{t('today.session.backtest.dataset')}</InputLabel>
                                        <Select
                                          labelId="backtest-dataset-id"
                                          label={t('today.session.backtest.dataset')}
                                          value={backtestSetup.datasetId}
                                          onChange={(event) => {
                                            setBacktestDatasetSummary(null)
                                            setBacktestSetup((prev) => ({ ...prev, datasetId: event.target.value }))
                                            resetBacktestReplay()
                                          }}
                                          disabled={backtestDatasetsLoading || backtestDatasetsForSource.length === 0}
                                        >
                                          {backtestDatasetsForSource.map((dataset) => (
                                            <MenuItem key={dataset.id} value={dataset.id}>
                                              {dataset.name}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    </Grid>
                                  )}

                                  {backtestSetup.dataSource === 'OANDA' && (
                                    <>
                                      <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                          size="small"
                                          fullWidth
                                          label={t('trades.form.symbol')}
                                          value={backtestSetup.symbol}
                                          onChange={(event) => setBacktestSetup((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
                                        />
                                      </Grid>
                                      <Grid item xs={6} sm={3} md={2}>
                                        <FormControl fullWidth size="small">
                                          <InputLabel id="backtest-timeframe">{t('today.session.backtest.timeframe')}</InputLabel>
                                          <Select
                                            labelId="backtest-timeframe"
                                            label={t('today.session.backtest.timeframe')}
                                            value={backtestSetup.timeframe}
                                            onChange={(event) => setBacktestSetup((prev) => ({ ...prev, timeframe: event.target.value as BacktestSetupState['timeframe'] }))}
                                          >
                                            <MenuItem value="M1">M1</MenuItem>
                                            <MenuItem value="M5">M5</MenuItem>
                                            <MenuItem value="M15">M15</MenuItem>
                                            <MenuItem value="H1">H1</MenuItem>
                                            <MenuItem value="D1">D1</MenuItem>
                                          </Select>
                                        </FormControl>
                                      </Grid>
                                    </>
                                  )}

                                  {backtestSetup.dataSource !== 'OANDA' && (
                                    <>
                                      <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                          size="small"
                                          fullWidth
                                          label={t('trades.form.symbol')}
                                          value={backtestSetup.symbol}
                                          onChange={(event) => setBacktestSetup((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
                                        />
                                      </Grid>
                                      <Grid item xs={6} sm={3} md={2}>
                                        <TextField
                                          size="small"
                                          fullWidth
                                          label={t('today.session.backtest.timeframe')}
                                          value={backtestSetup.timeframe}
                                          disabled
                                        />
                                      </Grid>
                                    </>
                                  )}

                                  <Grid item xs={6} sm={3} md={2}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      type="date"
                                      label={t('today.session.backtest.from')}
                                      InputLabelProps={{ shrink: true }}
                                      value={backtestSetup.from}
                                      inputProps={{
                                        min: selectedDatasetFromIso ? toDateInputFromIso(selectedDatasetFromIso) : undefined,
                                        max: selectedDatasetToIso ? toDateInputFromIso(selectedDatasetToIso) : undefined
                                      }}
                                      onChange={(event) => setBacktestSetup((prev) => ({ ...prev, from: event.target.value }))}
                                    />
                                  </Grid>
                                  <Grid item xs={6} sm={3} md={2}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      type="date"
                                      label={t('today.session.backtest.to')}
                                      InputLabelProps={{ shrink: true }}
                                      value={backtestSetup.to}
                                      inputProps={{
                                        min: selectedDatasetFromIso ? toDateInputFromIso(selectedDatasetFromIso) : undefined,
                                        max: selectedDatasetToIso ? toDateInputFromIso(selectedDatasetToIso) : undefined
                                      }}
                                      onChange={(event) => setBacktestSetup((prev) => ({ ...prev, to: event.target.value }))}
                                    />
                                  </Grid>
                                  {backtestSetup.dataSource !== 'OANDA' && selectedDatasetFromIso && selectedDatasetToIso && (
                                    <Grid item xs={12}>
                                      <Stack spacing={0.75}>
                                        <Typography variant="caption" color="text.secondary">
                                          {t('today.session.backtest.availableDataInline', {
                                            from: toDateInputFromIso(selectedDatasetFromIso) || t('common.na'),
                                            to: toDateInputFromIso(selectedDatasetToIso) || t('common.na'),
                                            timeframe: selectedDatasetTimeframe
                                          })}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {t('today.session.backtest.defaultWindowInline', {
                                            days: backtestDatasetSummary?.defaultWindowDays || resolveTimeframeWindowDays(selectedDatasetTimeframe)
                                          })}
                                        </Typography>
                                        {(loadedRangeFromIso || loadedRangeToIso) && (
                                          <Typography variant="caption" color="text.secondary">
                                            {t('today.session.backtest.loadedRangeInline', {
                                              from: toDateInputFromIso(loadedRangeFromIso) || t('common.na'),
                                              to: toDateInputFromIso(loadedRangeToIso) || t('common.na'),
                                              count: backtestCandles.length
                                            })}
                                          </Typography>
                                        )}
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                                          {selectedDatasetPresetDays.map((days) => (
                                            <Button
                                              key={days}
                                              size="small"
                                              variant="text"
                                              onClick={() => void applyBacktestPreset(days)}
                                            >
                                              {t('today.session.backtest.presetLastDays', { days })}
                                            </Button>
                                          ))}
                                          <Button size="small" variant="outlined" onClick={() => void applyDefaultBacktestRange()}>
                                            {t('today.session.backtest.useDefaultRange')}
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    </Grid>
                                  )}
                                  <Grid item xs={6} sm={3} md={2}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      label={t('today.session.backtest.sessionWindow')}
                                      value={backtestSetup.sessionWindow}
                                      onChange={(event) => setBacktestSetup((prev) => ({ ...prev, sessionWindow: event.target.value.toUpperCase() }))}
                                    />
                                  </Grid>
                                  <Grid item xs={6} sm={3} md={2}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      label={t('today.session.backtest.spread')}
                                      value={backtestSetup.spread}
                                      onChange={(event) => setBacktestSetup((prev) => ({ ...prev, spread: event.target.value }))}
                                    />
                                  </Grid>
                                  <Grid item xs={6} sm={3} md={2}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      label={t('today.session.backtest.slippage')}
                                      value={backtestSetup.slippage}
                                      onChange={(event) => setBacktestSetup((prev) => ({ ...prev, slippage: event.target.value }))}
                                    />
                                  </Grid>
                                  <Grid item xs={12} md={4}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                                      <Button size="small" variant="contained" onClick={() => void handleLoadBacktestData()} disabled={backtestLoading}>
                                        {t('today.session.backtest.loadData')}
                                      </Button>
                                      <Button size="small" variant="outlined" onClick={handleResetBacktestReplay}>
                                        {t('today.session.backtest.reset')}
                                      </Button>
                                    </Stack>
                                  </Grid>
                                </Grid>

                                {backtestSetup.dataSource === 'OANDA' && oandaConnected === false && (
                                  <Alert severity="warning">
                                    <Typography variant="body2">
                                      {t('today.session.backtest.providerNotConnected')}{' '}
                                      <Link to="/settings">{t('today.session.backtest.openSettings')}</Link>
                                    </Typography>
                                  </Alert>
                                )}

                                {backtestSetup.dataSource === 'DEMO' && (
                                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                                    <Button size="small" variant="outlined" onClick={() => handleBacktestSourceChange('DEMO')} disabled={backtestDatasetsLoading}>
                                      {t('today.session.backtest.loadDemo')}
                                    </Button>
                                    <Typography variant="caption" color="text.secondary">
                                      {t('today.session.backtest.demoHint')}
                                    </Typography>
                                  </Stack>
                                )}

                                {backtestSetup.dataSource === 'CSV' && (
                                  <Stack spacing={1}>
                                    <input
                                      ref={csvUploadInputRef}
                                      type="file"
                                      accept=".csv,text/csv"
                                      multiple
                                      hidden
                                      onChange={(event) => void handleCsvFilesSelected(event.target.files)}
                                    />
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }}>
                                      <Button size="small" variant="outlined" onClick={() => csvUploadInputRef.current?.click()}>
                                        {t('today.session.backtest.uploadCsv')}
                                      </Button>
                                      <Typography variant="caption" color="text.secondary">
                                        {t('today.session.backtest.uploadHint')}
                                      </Typography>
                                    </Stack>

                                    {csvUploads.map((upload) => {
                                      const columnOptions = uploadPreviewColumns(upload)
                                      const mappingUsed = mappingToIngestPayload(upload)
                                      const previewColumns = columnOptions.slice(0, 6)
                                      const previewRows = (upload.preview?.rows || []).slice(0, 5)
                                      return (
                                        <Box key={upload.fileId} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                                          <Stack spacing={0.75}>
                                            <Typography variant="body2" fontWeight={600}>{upload.fileName}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {upload.detectedSymbol || t('common.na')} • {upload.detectedTimeframe || t('common.na')} • {upload.detectedTimeFormat || t('common.na')} • {upload.dataFrom ? new Date(upload.dataFrom).toLocaleDateString() : t('common.na')} - {upload.dataTo ? new Date(upload.dataTo).toLocaleDateString() : t('common.na')}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {t('today.session.backtest.preview.detectedColumns')}: {columnOptions.map((column) => column.displayName).join(', ') || t('common.na')}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {t('today.session.backtest.preview.mappingUsed')}: {mappingUsed.timeColumn || t('common.na')} / {mappingUsed.openColumn || t('common.na')} / {mappingUsed.highColumn || t('common.na')} / {mappingUsed.lowColumn || t('common.na')} / {mappingUsed.closeColumn || t('common.na')}
                                            </Typography>
                                            {upload.warnings?.length > 0 && (
                                              <Typography variant="caption" color="warning.main">
                                                {upload.warnings.join(' ')}
                                              </Typography>
                                            )}
                                            {previewRows.length > 0 && (
                                              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                                <Table size="small" aria-label={t('today.session.backtest.preview.sampleRows')}>
                                                  <TableHead>
                                                    <TableRow>
                                                      {previewColumns.map((column) => (
                                                        <TableCell key={`${upload.fileId}-${column.key}`}>{column.displayName}</TableCell>
                                                      ))}
                                                    </TableRow>
                                                  </TableHead>
                                                  <TableBody>
                                                    {previewRows.map((row) => (
                                                      <TableRow key={`${upload.fileId}-row-${row.rowNumber}`}>
                                                        {previewColumns.map((column) => (
                                                          <TableCell key={`${upload.fileId}-row-${row.rowNumber}-${column.key}`}>
                                                            {row.values[column.index] || ''}
                                                          </TableCell>
                                                        ))}
                                                      </TableRow>
                                                    ))}
                                                  </TableBody>
                                                </Table>
                                              </TableContainer>
                                            )}
                                            {upload.mappingRequired && (
                                              <Grid container spacing={0.75}>
                                                <Grid item xs={6} md={4}>
                                                  <FormControl fullWidth size="small">
                                                    <InputLabel>{t('today.session.backtest.mapping.time')}</InputLabel>
                                                    <Select
                                                      label={t('today.session.backtest.mapping.time')}
                                                      value={upload.mappingDraft.timeColumn}
                                                      onChange={(event) => handleCsvMappingDraftChange(upload.fileId, 'timeColumn', event.target.value)}
                                                    >
                                                      {columnOptions.map((column) => (
                                                        <MenuItem key={`${upload.fileId}-time-${column.key}`} value={column.key}>{column.displayName}</MenuItem>
                                                      ))}
                                                    </Select>
                                                  </FormControl>
                                                </Grid>
                                                <Grid item xs={6} md={4}>
                                                  <FormControl fullWidth size="small">
                                                    <InputLabel>{t('today.session.backtest.mapping.open')}</InputLabel>
                                                    <Select
                                                      label={t('today.session.backtest.mapping.open')}
                                                      value={upload.mappingDraft.openColumn}
                                                      onChange={(event) => handleCsvMappingDraftChange(upload.fileId, 'openColumn', event.target.value)}
                                                    >
                                                      {columnOptions.map((column) => (
                                                        <MenuItem key={`${upload.fileId}-open-${column.key}`} value={column.key}>{column.displayName}</MenuItem>
                                                      ))}
                                                    </Select>
                                                  </FormControl>
                                                </Grid>
                                                <Grid item xs={6} md={4}>
                                                  <FormControl fullWidth size="small">
                                                    <InputLabel>{t('today.session.backtest.mapping.high')}</InputLabel>
                                                    <Select
                                                      label={t('today.session.backtest.mapping.high')}
                                                      value={upload.mappingDraft.highColumn}
                                                      onChange={(event) => handleCsvMappingDraftChange(upload.fileId, 'highColumn', event.target.value)}
                                                    >
                                                      {columnOptions.map((column) => (
                                                        <MenuItem key={`${upload.fileId}-high-${column.key}`} value={column.key}>{column.displayName}</MenuItem>
                                                      ))}
                                                    </Select>
                                                  </FormControl>
                                                </Grid>
                                                <Grid item xs={6} md={4}>
                                                  <FormControl fullWidth size="small">
                                                    <InputLabel>{t('today.session.backtest.mapping.low')}</InputLabel>
                                                    <Select
                                                      label={t('today.session.backtest.mapping.low')}
                                                      value={upload.mappingDraft.lowColumn}
                                                      onChange={(event) => handleCsvMappingDraftChange(upload.fileId, 'lowColumn', event.target.value)}
                                                    >
                                                      {columnOptions.map((column) => (
                                                        <MenuItem key={`${upload.fileId}-low-${column.key}`} value={column.key}>{column.displayName}</MenuItem>
                                                      ))}
                                                    </Select>
                                                  </FormControl>
                                                </Grid>
                                                <Grid item xs={6} md={4}>
                                                  <FormControl fullWidth size="small">
                                                    <InputLabel>{t('today.session.backtest.mapping.close')}</InputLabel>
                                                    <Select
                                                      label={t('today.session.backtest.mapping.close')}
                                                      value={upload.mappingDraft.closeColumn}
                                                      onChange={(event) => handleCsvMappingDraftChange(upload.fileId, 'closeColumn', event.target.value)}
                                                    >
                                                      {columnOptions.map((column) => (
                                                        <MenuItem key={`${upload.fileId}-close-${column.key}`} value={column.key}>{column.displayName}</MenuItem>
                                                      ))}
                                                    </Select>
                                                  </FormControl>
                                                </Grid>
                                              </Grid>
                                            )}
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                                              <Button
                                                size="small"
                                                variant="contained"
                                                onClick={() => void handleIngestCsvUpload(upload)}
                                                disabled={csvIngestingFileId === upload.fileId}
                                              >
                                                {csvIngestingFileId === upload.fileId ? t('today.session.backtest.ingesting') : t('today.session.backtest.ingest')}
                                              </Button>
                                            </Stack>
                                          </Stack>
                                        </Box>
                                      )
                                    })}

                                    {backtestCandles.length > 0 && (
                                      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                        <Table size="small" aria-label={t('today.session.backtest.loadedStats.title')}>
                                          <TableHead>
                                            <TableRow>
                                              <TableCell>{t('today.session.backtest.loadedStats.firstCandle')}</TableCell>
                                              <TableCell>{t('today.session.backtest.loadedStats.lastCandle')}</TableCell>
                                              <TableCell>{t('today.session.backtest.loadedStats.count')}</TableCell>
                                            </TableRow>
                                          </TableHead>
                                          <TableBody>
                                            <TableRow>
                                              <TableCell>{loadedRangeFromIso ? new Date(loadedRangeFromIso).toLocaleString() : t('common.na')}</TableCell>
                                              <TableCell>{loadedRangeToIso ? new Date(loadedRangeToIso).toLocaleString() : t('common.na')}</TableCell>
                                              <TableCell>{backtestCandles.length}</TableCell>
                                            </TableRow>
                                          </TableBody>
                                        </Table>
                                      </TableContainer>
                                    )}
                                  </Stack>
                                )}
                              </Stack>
                            </AccordionDetails>
                          </Accordion>

                          <ReplayCandlestickChart
                            candles={backtestCandles}
                            cursorIndex={backtestCursor}
                            minHeight={isCompactViewport ? 300 : 360}
                            height={isCompactViewport ? 'clamp(300px, 40vh, 480px)' : 'clamp(360px, 45vh, 640px)'}
                            loading={backtestReplayState === 'LOADING'}
                          />

                          {backtestReplayState === 'LOADING' && <LinearProgress />}
                          {backtestReplayMessage && (
                            <Alert severity={backtestReplayState === 'ERROR' ? 'warning' : (backtestReplayState === 'EMPTY' ? 'info' : 'success')}>
                              <Stack spacing={0.5}>
                                <Typography variant="body2">{backtestReplayMessage}</Typography>
                                {backtestReplayState === 'EMPTY' && (backtestDatasetSummary?.dataFromUtc || selectedBacktestDataset?.dataFrom) && (backtestDatasetSummary?.dataToUtc || selectedBacktestDataset?.dataTo) && (
                                  <Typography variant="caption" color="text.secondary">
                                    {t('today.session.backtest.availableDataInline', {
                                      from: toDateInputFromIso(backtestDatasetSummary?.dataFromUtc || selectedBacktestDataset?.dataFrom) || t('common.na'),
                                      to: toDateInputFromIso(backtestDatasetSummary?.dataToUtc || selectedBacktestDataset?.dataTo) || t('common.na'),
                                      timeframe: backtestDatasetSummary?.timeframe || selectedBacktestDataset?.timeframe || backtestSetup.timeframe
                                    })}
                                  </Typography>
                                )}
                                {backtestReplayState === 'EMPTY' && (
                                  <Box>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => void applyDefaultBacktestRange(true)}
                                    >
                                      {t('today.session.backtest.useDefaultRange')}
                                    </Button>
                                  </Box>
                                )}
                              </Stack>
                            </Alert>
                          )}

                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ md: 'center' }} justifyContent="space-between">
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  if (backtestIsPlaying) {
                                    setBacktestIsPlaying(false)
                                    return
                                  }
                                  if (canReplayPlay) {
                                    setBacktestIsPlaying(true)
                                  }
                                }}
                                disabled={!backtestIsPlaying && !canReplayPlay}
                              >
                                {backtestIsPlaying ? t('today.session.backtest.pause') : t('today.session.backtest.play')}
                              </Button>
                              <Button size="small" variant="outlined" onClick={() => handleStepReplay(-5)} disabled={!canReplayStep}>-5</Button>
                              <Button size="small" variant="outlined" onClick={() => handleStepReplay(-1)} disabled={!canReplayStep}>-1</Button>
                              <Button size="small" variant="outlined" onClick={() => handleStepReplay(1)} disabled={!canReplayStep}>+1</Button>
                              <Button size="small" variant="outlined" onClick={() => handleStepReplay(5)} disabled={!canReplayStep}>+5</Button>
                              <Button size="small" variant="outlined" onClick={handleJumpReplay} disabled={!canReplayStep}>
                                {t('today.session.backtest.jump')}
                              </Button>
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }}>
                              <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel id="backtest-speed">{t('today.session.backtest.speed')}</InputLabel>
                                <Select
                                  labelId="backtest-speed"
                                  label={t('today.session.backtest.speed')}
                                  value={String(backtestSpeed)}
                                  onChange={(event) => setBacktestSpeed(Number(event.target.value))}
                                >
                                  <MenuItem value="1">1x</MenuItem>
                                  <MenuItem value="2">2x</MenuItem>
                                  <MenuItem value="5">5x</MenuItem>
                                </Select>
                              </FormControl>
                              <Chip
                                size="small"
                                variant="outlined"
                                sx={{ minWidth: 230 }}
                                label={`${t('today.session.backtest.cursor')}: ${toIsoFromUnknownTimestamp(backtestCandles[backtestCursor]?.timestamp) ? new Date(toIsoFromUnknownTimestamp(backtestCandles[backtestCursor]?.timestamp)).toLocaleString() : t('common.na')}`}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                data-testid="backtest-replay-state"
                                label={`State: ${backtestReplayState}`}
                              />
                            </Stack>
                          </Stack>

                          <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>{t('today.session.backtest.summaryTitle')}</Typography>
                            {latestBacktestTrade ? (
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} useFlexGap flexWrap="wrap">
                                <Chip size="small" label={`${t('today.session.backtest.result')}: ${latestBacktestTrade.exitReason || 'OPEN'}`} />
                                <Chip size="small" label={`R: ${latestBacktestTrade.rMultiple != null ? Number(latestBacktestTrade.rMultiple).toFixed(2) : t('common.na')}`} />
                                <Chip size="small" label={`MAE: ${latestBacktestTrade.maeR != null ? Number(latestBacktestTrade.maeR).toFixed(2) : t('common.na')}`} />
                                <Chip size="small" label={`MFE: ${latestBacktestTrade.mfeR != null ? Number(latestBacktestTrade.mfeR).toFixed(2) : t('common.na')}`} />
                                <Chip size="small" label={`${t('today.session.backtest.tradesCount')}: ${backtestTrades.length}`} />
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">{t('today.session.backtest.noTradesYet')}</Typography>
                            )}
                          </Box>
                        </Stack>
                      )}
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
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end" data-testid="entry-price-adornment">
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setPricePickerTarget('entry')}
                                            sx={{ minWidth: 0, px: 0.75, whiteSpace: 'nowrap' }}
                                          >
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
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end" data-testid="sl-price-adornment">
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setPricePickerTarget('sl')}
                                            sx={{ minWidth: 0, px: 0.75, whiteSpace: 'nowrap' }}
                                          >
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
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                      endAdornment: (
                                        <InputAdornment position="end" data-testid="tp-price-adornment">
                                          <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setPricePickerTarget('tp')}
                                            sx={{ minWidth: 0, px: 0.75, whiteSpace: 'nowrap' }}
                                          >
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

      {session && isMobileViewport && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1300,
            px: 1,
            py: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => setMissingModalOpen(true)}
            >
              {t('today.session.mobile.viewMissing')}
            </Button>
            {!session.activeTrade ? (
              <Button
                variant="contained"
                size="small"
                fullWidth
                onClick={handleStartTrade}
                disabled={!canStartTrade || startTradeMutation.isLoading}
              >
                {startTradeMutation.isLoading ? t('today.session.planner.startingTrade') : t('today.session.planner.startTrade')}
              </Button>
            ) : (
              <Button variant="outlined" color="error" size="small" fullWidth onClick={() => setCloseFormOpen((prev) => !prev)}>
                {t('today.session.planner.stopTrade')}
              </Button>
            )}
          </Stack>
        </Box>
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
          <Button
            variant="contained"
            onClick={() => void handleSaveChecklistEditor()}
            disabled={!checklistEditorHasChanges}
          >
            {t('today.session.checklist.saveChanges')}
          </Button>
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

      <Dialog open={chartProfileManageOpen} onClose={() => setChartProfileManageOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('today.session.chartProfiles.manageTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">{t('today.session.chartProfiles.manageHint')}</Typography>
            {chartProfiles.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('today.session.chartProfiles.empty')}</Typography>
            ) : (
              chartProfiles.map((profile) => (
                <Box key={profile.id} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2">
                        {profile.name}
                      </Typography>
                      {profile.isDefault && (
                        <Chip size="small" color="primary" label={t('today.session.chartProfiles.defaultTag')} />
                      )}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void handleRenameChartProfile(profile)}
                      >
                        {t('common.rename')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void handleSetDefaultChartProfile(profile)}
                        disabled={profile.isDefault}
                      >
                        {t('today.session.chartProfiles.setDefault')}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        onClick={() => void handleDeleteChartProfile(profile)}
                      >
                        {t('common.delete')}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChartProfileManageOpen(false)}>{t('common.close')}</Button>
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

      <Dialog open={poolDialog.open} onClose={() => setPoolDialog((prev) => ({ ...prev, open: false }))} fullWidth maxWidth="sm" fullScreen={isMobileViewport}>
        <DialogTitle>{poolDialog.editId ? t('today.session.pools.edit') : t('today.session.pools.create')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <TextField
              size="small"
              label={t('today.session.pools.name')}
              value={poolDialog.poolName}
              onChange={(event) => setPoolDialog((prev) => ({ ...prev, poolName: event.target.value }))}
              fullWidth
            />
            <TextField
              size="small"
              label={t('trades.form.symbol')}
              value={poolDialog.symbol}
              onChange={(event) => setPoolDialog((prev) => ({ ...prev, symbol: event.target.value }))}
              fullWidth
            />
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  size="small"
                  label={t('today.session.levels.type')}
                  value={poolDialog.type}
                  onChange={(event) => setPoolDialog((prev) => ({ ...prev, type: event.target.value as LevelType }))}
                  fullWidth
                >
                  {LEVEL_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  size="small"
                  label={t('today.session.levels.timeframe')}
                  value={poolDialog.timeframe}
                  onChange={(event) => setPoolDialog((prev) => ({ ...prev, timeframe: event.target.value as LevelTimeframe }))}
                  fullWidth
                >
                  {LEVEL_TIMEFRAME_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  type="number"
                  label={t('today.session.pools.zoneLow')}
                  value={poolDialog.zoneLow}
                  onChange={(event) => setPoolDialog((prev) => ({ ...prev, zoneLow: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  type="number"
                  label={t('today.session.pools.zoneHigh')}
                  value={poolDialog.zoneHigh}
                  onChange={(event) => setPoolDialog((prev) => ({ ...prev, zoneHigh: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  type="number"
                  label={t('today.session.pools.cleanliness')}
                  value={poolDialog.cleanlinessScore}
                  onChange={(event) => setPoolDialog((prev) => ({ ...prev, cleanlinessScore: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  size="small"
                  label={t('today.session.levels.status')}
                  value={poolDialog.status}
                  onChange={(event) => setPoolDialog((prev) => ({ ...prev, status: event.target.value as LevelStatus }))}
                  fullWidth
                >
                  {LEVEL_STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="session-pool-levels-label">{t('today.session.pools.levels')}</InputLabel>
                  <Select<string[]>
                    labelId="session-pool-levels-label"
                    multiple
                    label={t('today.session.pools.levels')}
                    value={poolDialog.levelIds}
                    onChange={(event: SelectChangeEvent<string[]>) => {
                      const value = event.target.value
                      const levelIds = typeof value === 'string' ? value.split(',') : value
                      setPoolDialog((prev) => ({ ...prev, levelIds }))
                    }}
                  >
                    {sessionLevels.map((level) => (
                      <MenuItem key={level.id} value={level.id}>
                        {level.label} {level.price != null ? `(${formatNumber(level.price, 4)})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <FormControlLabel
              control={<Checkbox checked={poolDialog.sweepRole} onChange={(event) => setPoolDialog((prev) => ({ ...prev, sweepRole: event.target.checked }))} />}
              label={t('today.session.pools.setSweep')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPoolDialog((prev) => ({ ...prev, open: false }))}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => void handleSavePool()}>{t('common.save')}</Button>
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
            <Box>
              <Typography variant="subtitle2">{t('today.session.requirements.narrative')}</Typography>
              {missingNarrative.length === 0 ? (
                <Typography variant="body2" color="success.main">{t('today.session.requirements.complete')}</Typography>
              ) : (
                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                  {missingNarrative.map((item) => (
                    <Typography key={item} variant="body2">• {item}</Typography>
                  ))}
                </Stack>
              )}
            </Box>
            <Box>
              <Typography variant="subtitle2">{t('today.session.requirements.roles')}</Typography>
              {missingRoles.length === 0 ? (
                <Typography variant="body2" color="success.main">{t('today.session.requirements.complete')}</Typography>
              ) : (
                <Stack spacing={0.4} sx={{ mt: 0.6 }}>
                  {missingRoles.map((item) => (
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

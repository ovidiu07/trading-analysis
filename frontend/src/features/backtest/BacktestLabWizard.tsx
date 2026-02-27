import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  Grid,
  InputLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import InfoOutlinedRoundedIcon from '@mui/icons-material/InfoOutlined'
import { Link } from 'react-router-dom'
import {
  BacktestOptimizerRun,
  BacktestDatasetSetDatasets,
  BacktestLabRun,
  BacktestLabRunResults,
  BacktestLabTradeResult,
  BacktestRunReport,
  createBacktestDatasetSet,
  deleteBacktestDataset,
  getBacktestOptimizerRun,
  getBacktestDatasetSetDatasets,
  getBacktestRunReportV2,
  getBacktestRunResultsV2,
  runBacktestOptimizer,
  runBacktestDatasetSet,
  saveBacktestStrategyConfig,
  uploadBacktestDatasetCsv
} from '../../api/backtest'
import MarkdownContent from '../../components/ui/MarkdownContent'
import { formatUtcTimestamp } from './formatUtc'

const STORAGE_KEY = 'session.backtestLab.datasetSetId'
const PRESET_STORAGE_KEY = 'session.backtestLab.strategyPresets.v1'
const STEPS = ['Upload CSVs', 'Strategy Builder', 'Run Backtest', 'Results + Report']

type TemplateKey = 'ASIA_LONDON_REVERSAL' | 'LONDON_NY_REVERSAL' | 'BOS_CONTINUATION'
type SessionName = 'ASIA' | 'LONDON' | 'NY_AM' | 'NY_PM'
type TimeframeRole = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1' | 'W1'
type PoolType = 'EQH' | 'EQL' | 'ASIA_H' | 'ASIA_L' | 'LONDON_H' | 'LONDON_L' | 'NY_AM_H' | 'NY_AM_L' | 'PDH' | 'PDL' | 'PWH' | 'PWL'
type SwingDetectionMethod = 'FRACTAL' | 'PIVOT_N' | 'SWING_HL'
type MssAnchorLevel = 'LAST_SWING_HIGH_LOW' | 'DISPLACEMENT_ORIGIN' | 'INTERNAL_STRUCTURE'
type DisplacementType = 'GAP_REQUIRED' | 'GAP_OPTIONAL' | 'NO_GAP_ONLY'
type DisplacementGapDefinition = 'THREE_CANDLE_FVG' | 'TWO_CANDLE_GAP'
type MssInvalidationRule = 'CLOSE_BACK_THROUGH_LEVEL'
type RetraceReference = 'GAP_FILL' | 'IMPULSE_LEG'
type OptimizerState = {
  maxVariants: number
  mssMinConfirmCandles: string
  displacementType: string
  retraceRequired: string
  retraceMinPct: string
  sweepMinDepthPips: string
  confirmationTf: string
  entryTf: string
}

type StrategyConfigState = {
  name: string
  context: {
    pipSize: number
    spreadPips: number
    slippagePips: number
    touchTolerancePips: number
    timezoneBasis: string
    executionTimeframe: string
  }
  sessions: Array<{
    name: string
    zoneId: string
    startLocal: string
    endLocal: string
    enabled: boolean
    canGeneratePools: boolean
    canFilterEvaluation: boolean
    canFilterEntry: boolean
    displayOrder: number
  }>
  setupRule: {
    session: string
    sweepType: PoolType
    confirmationType: 'MSS' | 'BOS'
    confirmationTf: string
    direction: 'AUTO_FROM_SWEEP' | 'LONG' | 'SHORT'
  }
  entryModel: {
    type: 'MARKET_ON_CONFIRM_CLOSE' | 'LIMIT_RETRACE_PERCENT'
    retracePercent: number
    entryWindowBars: number
  }
  riskModel: {
    stopRule: 'SWEEP_EXTREME_PLUS_BUFFER' | 'LAST_SWING_PLUS_BUFFER'
    tpRule: 'FIXED_R'
    fixedR: number
    minRR: number
  }
  qualityFilters: {
    displacementMultiplier: number
    bodyLookback: number
    antiChop: boolean
    maxTradesPerSession: number
    maxTradesPerDay: number
    pivotLeft: number
    pivotRight: number
    confirmBreakBufferPips: number
  }
  smc: {
    sessionTimezone: string
    sessionCalendar: Array<{
      name: string
      timezoneId: string
      localStartTime: string
      localEndTime: string
      enabled: boolean
      canGeneratePools: boolean
      canFilterEvaluation: boolean
      canFilterEntry: boolean
      displayOrder: number
    }>
    contextTf: TimeframeRole
    poolTf: TimeframeRole
    confirmationTf: TimeframeRole
    entryTf: TimeframeRole
    executionTf: TimeframeRole
    allowNonHierarchicalTimeframes: boolean
    sessionsEnabled: SessionName[]
    sessionTimeRanges: Record<SessionName, { start: string, end: string, zoneId: string }>
    requireKillzone: boolean
    killzoneWindowsUtc: Partial<Record<SessionName, { start: string, end: string, zoneId: string }>>
    sweepSourceSessions: SessionName[]
    evaluationSessionFilter: SessionName[]
    entrySessions: SessionName[]
    requireCrossSessionSweep: boolean
    requireSameSessionForSweepAndEntry: boolean
    sweepRequiresUnsweptPool: boolean
    poolTypesEnabled: PoolType[]
    poolTimeframeForDetection: string
    poolTouchTolerancePips: number
    poolMinTouches: number
    poolMinSeparationBars: number
    poolMinAgeBars: number
    poolRankRule: 'MOST_TOUCHES_THEN_RECENCY' | 'TOUCH_COUNT' | 'LARGEST_SWING' | 'NEAREST_RECENT'
    sweepMinDepthPips: number
    sweepMaxDurationBars: number
    sweepRequiresReclaim: boolean
    sweepRequiresLiquidityType: boolean
    sweepSelectRule: 'MAX_DEPTH_THEN_BEST_RANKED_POOL' | 'LARGEST_DEPTH' | 'NEWEST_SESSION_LEVEL' | 'HIGHEST_RANKED_POOL'
    displacementTimeframe: string
    displacementMaxDelayBarsAfterSweep: number
    displacementMinBodyPips: number
    displacementMinBodyVsAvgMult: number
    displacementRequiresCloseBeyondLevel: boolean
    displacementNoInstantOverlapBars: number
    displacementType: DisplacementType
    displacementGapDefinition: DisplacementGapDefinition
    displacementGapMinPips: number
    mssTf: string
    swingDetectionMethod: SwingDetectionMethod
    swingPivotN: number
    mssRequiresClose: boolean
    mssMinConfirmCandles: number
    mssMaxConfirmWindowBars: number
    mssInvalidationRule: MssInvalidationRule
    mssAnchorLevel: MssAnchorLevel
    retraceRequired: boolean
    retraceReference: RetraceReference
    retraceMinPct: number
    retraceMaxWaitBars: number
    retraceAcceptWickTouch: boolean
    entryRequiresFvgRetest: boolean
    entryRequiresDiscountPremium: boolean
    fillPolicy: 'MID' | 'BID_ASK_SIM'
    emitDebugFields: boolean
    storeIntermediateLevels: boolean
  }
}

const defaultConfig = (): StrategyConfigState => ({
  name: 'SMC Rule Strategy',
  context: {
    pipSize: 0.0001,
    spreadPips: 0.8,
    slippagePips: 0.3,
    touchTolerancePips: 0.5,
    timezoneBasis: 'UTC',
    executionTimeframe: 'M5'
  },
  sessions: [
    { name: 'ASIA', zoneId: 'UTC', startLocal: '00:00', endLocal: '07:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 0 },
    { name: 'LONDON', zoneId: 'UTC', startLocal: '07:00', endLocal: '12:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 1 },
    { name: 'NY_AM', zoneId: 'UTC', startLocal: '13:00', endLocal: '17:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 2 },
    { name: 'NY_PM', zoneId: 'UTC', startLocal: '17:00', endLocal: '22:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 3 }
  ],
  setupRule: {
    session: 'LONDON',
    sweepType: 'ASIA_H',
    confirmationType: 'MSS',
    confirmationTf: 'M5',
    direction: 'AUTO_FROM_SWEEP'
  },
  entryModel: {
    type: 'LIMIT_RETRACE_PERCENT',
    retracePercent: 50,
    entryWindowBars: 5
  },
  riskModel: {
    stopRule: 'SWEEP_EXTREME_PLUS_BUFFER',
    tpRule: 'FIXED_R',
    fixedR: 2,
    minRR: 2
  },
  qualityFilters: {
    displacementMultiplier: 1.5,
    bodyLookback: 20,
    antiChop: true,
    maxTradesPerSession: 1,
    maxTradesPerDay: 3,
    pivotLeft: 2,
    pivotRight: 2,
    confirmBreakBufferPips: 0
  },
  smc: {
    sessionTimezone: 'UTC',
    sessionCalendar: [
      { name: 'ASIA', timezoneId: 'UTC', localStartTime: '00:00', localEndTime: '07:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 0 },
      { name: 'LONDON', timezoneId: 'UTC', localStartTime: '07:00', localEndTime: '12:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 1 },
      { name: 'NY_AM', timezoneId: 'UTC', localStartTime: '13:00', localEndTime: '17:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 2 },
      { name: 'NY_PM', timezoneId: 'UTC', localStartTime: '17:00', localEndTime: '22:00', enabled: true, canGeneratePools: true, canFilterEvaluation: true, canFilterEntry: true, displayOrder: 3 }
    ],
    contextTf: 'H1',
    poolTf: 'M15',
    confirmationTf: 'M5',
    entryTf: 'M5',
    executionTf: 'M5',
    allowNonHierarchicalTimeframes: false,
    sessionsEnabled: ['ASIA', 'LONDON', 'NY_AM', 'NY_PM'],
    sessionTimeRanges: {
      ASIA: { start: '00:00', end: '07:00', zoneId: 'UTC' },
      LONDON: { start: '07:00', end: '12:00', zoneId: 'UTC' },
      NY_AM: { start: '13:00', end: '17:00', zoneId: 'UTC' },
      NY_PM: { start: '17:00', end: '22:00', zoneId: 'UTC' }
    },
    requireKillzone: true,
    killzoneWindowsUtc: {
      LONDON: { start: '07:00', end: '10:00', zoneId: 'UTC' },
      NY_AM: { start: '12:30', end: '15:30', zoneId: 'UTC' }
    },
    sweepSourceSessions: ['ASIA', 'LONDON', 'NY_AM'],
    evaluationSessionFilter: ['LONDON'],
    entrySessions: ['LONDON'],
    requireCrossSessionSweep: false,
    requireSameSessionForSweepAndEntry: false,
    sweepRequiresUnsweptPool: true,
    poolTypesEnabled: ['EQH', 'EQL', 'ASIA_H', 'ASIA_L', 'LONDON_H', 'LONDON_L', 'NY_AM_H', 'NY_AM_L', 'PDH', 'PDL', 'PWH', 'PWL'],
    poolTimeframeForDetection: 'M15',
    poolTouchTolerancePips: 1,
    poolMinTouches: 2,
    poolMinSeparationBars: 6,
    poolMinAgeBars: 12,
    poolRankRule: 'MOST_TOUCHES_THEN_RECENCY',
    sweepMinDepthPips: 4,
    sweepMaxDurationBars: 5,
    sweepRequiresReclaim: true,
    sweepRequiresLiquidityType: true,
    sweepSelectRule: 'MAX_DEPTH_THEN_BEST_RANKED_POOL',
    displacementTimeframe: 'M5',
    displacementMaxDelayBarsAfterSweep: 2,
    displacementMinBodyPips: 6,
    displacementMinBodyVsAvgMult: 1.8,
    displacementRequiresCloseBeyondLevel: true,
    displacementNoInstantOverlapBars: 1,
    displacementType: 'GAP_OPTIONAL',
    displacementGapDefinition: 'THREE_CANDLE_FVG',
    displacementGapMinPips: 2,
    mssTf: 'M5',
    swingDetectionMethod: 'PIVOT_N',
    swingPivotN: 2,
    mssRequiresClose: true,
    mssMinConfirmCandles: 3,
    mssMaxConfirmWindowBars: 8,
    mssInvalidationRule: 'CLOSE_BACK_THROUGH_LEVEL',
    mssAnchorLevel: 'LAST_SWING_HIGH_LOW',
    retraceRequired: true,
    retraceReference: 'GAP_FILL',
    retraceMinPct: 50,
    retraceMaxWaitBars: 6,
    retraceAcceptWickTouch: true,
    entryRequiresFvgRetest: false,
    entryRequiresDiscountPremium: false,
    fillPolicy: 'BID_ASK_SIM',
    emitDebugFields: true,
    storeIntermediateLevels: true
  }
})

const SESSION_NAMES: SessionName[] = ['ASIA', 'LONDON', 'NY_AM', 'NY_PM']
const POOL_TYPES: PoolType[] = ['EQH', 'EQL', 'ASIA_H', 'ASIA_L', 'LONDON_H', 'LONDON_L', 'NY_AM_H', 'NY_AM_L', 'PDH', 'PDL', 'PWH', 'PWL']
const TIMEFRAME_OPTIONS: TimeframeRole[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1']

const HintLabel = ({ label, tooltip }: { label: string, tooltip: string }) => (
  <Stack direction="row" spacing={0.4} alignItems="center">
    <span>{label}</span>
    <Tooltip title={tooltip} placement="top" arrow>
      <IconButton size="small" sx={{ p: 0 }}>
        <InfoOutlinedRoundedIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  </Stack>
)

const parseCsvSelection = <T extends string>(value: string, allowed: readonly T[]): T[] => {
  const selected = value
    .split(',')
    .map((item) => item.trim().toUpperCase().replace('-', '_'))
    .filter(Boolean)
  return selected.filter((item): item is T => (allowed as readonly string[]).includes(item))
}

const parseNumberList = (value: string) => value
  .split(',')
  .map((item) => Number(item.trim()))
  .filter((item) => Number.isFinite(item))

const parseBooleanList = (value: string) => value
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)
  .map((item) => item === 'true')

const inferPipSize = (instrument: string) => {
  const symbol = instrument.toUpperCase()
  if (symbol.includes('JPY')) return 0.01
  if (symbol.includes('XAU') || symbol.includes('XAG')) return 0.1
  return 0.0001
}

const toIsoDay = (value?: string | null) => {
  if (!value) return ''
  const normalized = value.trim()
  const isoPrefix = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefix?.[1]) return isoPrefix[1]
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const timeframeSeconds = (timeframe: string) => {
  switch ((timeframe || '').toUpperCase()) {
    case 'M1':
      return 60
    case 'M5':
      return 300
    case 'M15':
      return 900
    case 'H1':
      return 3600
    case 'H4':
      return 14_400
    case 'D1':
      return 86_400
    case 'W1':
      return 604_800
    default:
      return Number.MAX_SAFE_INTEGER
  }
}

const pickExecutionDataset = (
  datasets: BacktestDatasetSetDatasets['datasets'] | null | undefined,
  requestedTimeframe: string
) => {
  const rows = datasets || []
  if (!rows.length) return null
  const exact = rows.find((row) => row.timeframe === requestedTimeframe)
  if (exact) return exact

  const requestedSeconds = timeframeSeconds(requestedTimeframe)
  const sorted = [...rows].sort((a, b) => timeframeSeconds(a.timeframe) - timeframeSeconds(b.timeframe))
  let source = null as BacktestDatasetSetDatasets['datasets'][number] | null
  for (const row of sorted) {
    if (timeframeSeconds(row.timeframe) <= requestedSeconds) {
      source = row
    }
  }
  return source || sorted[0]
}

const resolveDatasetRangeBounds = (datasets?: BacktestDatasetSetDatasets['datasets'] | null) => {
  const rows = datasets || []
  if (!rows.length) return { min: '', max: '' }
  const min = rows.map((row) => row.minTimeUtc).filter(Boolean).sort()[0]
  const max = rows.map((row) => row.maxTimeUtc).filter(Boolean).sort().at(-1)
  return { min: toIsoDay(min), max: toIsoDay(max) }
}

const clampIsoDay = (value: string, min: string, max: string) => {
  if (!value) return value
  if (min && value < min) return min
  if (max && value > max) return max
  return value
}

const normalizeRunWindowToBounds = (
  current: { fromUtc: string, toUtc: string, sessionFilter: string },
  bounds: { min: string, max: string }
) => {
  if (!bounds.min || !bounds.max) return current
  let nextFrom = current.fromUtc || bounds.min
  let nextTo = current.toUtc || bounds.max
  nextFrom = clampIsoDay(nextFrom, bounds.min, bounds.max)
  nextTo = clampIsoDay(nextTo, bounds.min, bounds.max)
  if (nextFrom > nextTo) {
    nextFrom = bounds.min
    nextTo = bounds.max
  }
  if (nextFrom === current.fromUtc && nextTo === current.toUtc) {
    return current
  }
  return {
    ...current,
    fromUtc: nextFrom,
    toUtc: nextTo
  }
}

const applyTemplate = (prev: StrategyConfigState, key: TemplateKey): StrategyConfigState => {
  if (key === 'ASIA_LONDON_REVERSAL') {
    return {
      ...prev,
      name: 'Asia Raid -> London Reversal',
      context: { ...prev.context, executionTimeframe: 'M5' },
      setupRule: {
        ...prev.setupRule,
        session: 'LONDON',
        sweepType: 'ASIA_H',
        confirmationType: 'MSS',
        direction: 'AUTO_FROM_SWEEP'
      },
      entryModel: { ...prev.entryModel, type: 'MARKET_ON_CONFIRM_CLOSE', entryWindowBars: 4 },
      qualityFilters: { ...prev.qualityFilters, displacementMultiplier: 1.6 },
      smc: {
        ...prev.smc,
        evaluationSessionFilter: ['LONDON'],
        sweepSourceSessions: ['ASIA'],
        poolTypesEnabled: ['ASIA_H', 'ASIA_L', 'EQH', 'EQL', 'PDH', 'PDL'],
        sweepMinDepthPips: 2,
        displacementMinBodyVsAvgMult: 1.6
      }
    }
  }
  if (key === 'LONDON_NY_REVERSAL') {
    return {
      ...prev,
      name: 'London Raid -> NY Reversal',
      setupRule: {
        ...prev.setupRule,
        session: 'NY_AM',
        sweepType: 'LONDON_H',
        confirmationType: 'MSS',
        direction: 'AUTO_FROM_SWEEP'
      },
      entryModel: { ...prev.entryModel, type: 'LIMIT_RETRACE_PERCENT', retracePercent: 50, entryWindowBars: 6 },
      riskModel: { ...prev.riskModel, fixedR: 2 },
      smc: {
        ...prev.smc,
        evaluationSessionFilter: ['NY_AM'],
        sweepSourceSessions: ['LONDON'],
        poolTypesEnabled: ['LONDON_H', 'LONDON_L', 'EQH', 'EQL', 'PDH', 'PDL']
      }
    }
  }
  return {
    ...prev,
    name: 'BOS Continuation',
    setupRule: {
      ...prev.setupRule,
      session: 'LONDON',
      sweepType: 'PDH',
      confirmationType: 'BOS',
      direction: 'AUTO_FROM_SWEEP'
    },
    entryModel: { ...prev.entryModel, type: 'MARKET_ON_CONFIRM_CLOSE' },
    qualityFilters: { ...prev.qualityFilters, displacementMultiplier: 1.4 },
    smc: {
      ...prev.smc,
      evaluationSessionFilter: ['LONDON'],
      sweepSourceSessions: ['LONDON'],
      poolTypesEnabled: ['PDH', 'PDL', 'PWH', 'PWL', 'EQH', 'EQL'],
      sweepSelectRule: 'HIGHEST_RANKED_POOL'
    }
  }
}

const loadStoredPresets = (): Record<string, StrategyConfigState> => {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, StrategyConfigState>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const persistPresets = (presets: Record<string, StrategyConfigState>) => {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets))
}

const normalizeStrategyConfig = (candidate: Partial<StrategyConfigState> | null | undefined): StrategyConfigState => {
  const base = defaultConfig()
  if (!candidate) return base
  const merged: StrategyConfigState = {
    ...base,
    ...candidate,
    context: { ...base.context, ...(candidate.context || {}) },
    sessions: (candidate.sessions || base.sessions).map((session, index) => ({
      ...base.sessions[index % base.sessions.length],
      ...session,
      displayOrder: session.displayOrder ?? index
    })),
    setupRule: { ...base.setupRule, ...(candidate.setupRule || {}) },
    entryModel: { ...base.entryModel, ...(candidate.entryModel || {}) },
    riskModel: { ...base.riskModel, ...(candidate.riskModel || {}) },
    qualityFilters: { ...base.qualityFilters, ...(candidate.qualityFilters || {}) },
    smc: {
      ...base.smc,
      ...(candidate.smc || {}),
      sessionTimeRanges: {
        ...base.smc.sessionTimeRanges,
        ...(candidate.smc?.sessionTimeRanges || {})
      },
      killzoneWindowsUtc: {
        ...base.smc.killzoneWindowsUtc,
        ...(candidate.smc?.killzoneWindowsUtc || {})
      },
      sessionCalendar: (candidate.smc?.sessionCalendar || base.smc.sessionCalendar).map((session, index) => ({
        ...base.smc.sessionCalendar[index % base.smc.sessionCalendar.length],
        ...session,
        displayOrder: session.displayOrder ?? index
      }))
    }
  }
  if (!merged.smc.executionTf) {
    merged.smc.executionTf = (merged.context.executionTimeframe as TimeframeRole) || 'M5'
  }
  merged.context.executionTimeframe = merged.smc.executionTf
  return merged
}

type RunLifecycleState = 'idle' | 'validating' | 'queued' | 'running' | 'completed' | 'failed'

type BacktestLabWizardProps = {
  headerSymbol?: string
}

export default function BacktestLabWizard({ headerSymbol }: BacktestLabWizardProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [step, setStep] = useState(0)
  const [datasetSetId, setDatasetSetId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '')
  const [instrument, setInstrument] = useState('EURUSD')
  const [timezoneBasis, setTimezoneBasis] = useState('UTC')
  const [datasetInfo, setDatasetInfo] = useState<BacktestDatasetSetDatasets | null>(null)
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<'' | 'UPLOADING' | 'PARSING' | 'PERSISTING' | 'READY'>('')
  const [saveStrategyBusy, setSaveStrategyBusy] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
  const [runLifecycleState, setRunLifecycleState] = useState<RunLifecycleState>('idle')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [strategyConfig, setStrategyConfig] = useState<StrategyConfigState>(defaultConfig)
  const [strategyConfigId, setStrategyConfigId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [selectedPresetKey, setSelectedPresetKey] = useState('')
  const [savedPresets, setSavedPresets] = useState<Record<string, StrategyConfigState>>(() => loadStoredPresets())
  const [lastSavedConfigFingerprint, setLastSavedConfigFingerprint] = useState('')

  const [runWindow, setRunWindow] = useState({ fromUtc: '', toUtc: '', sessionFilter: '' })
  const [lastRun, setLastRun] = useState<BacktestLabRun | null>(null)
  const [results, setResults] = useState<BacktestLabRunResults | null>(null)
  const [report, setReport] = useState<BacktestRunReport | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<BacktestLabTradeResult | null>(null)
  const [showDatasetWarnings, setShowDatasetWarnings] = useState(false)
  const [optimizerBusy, setOptimizerBusy] = useState(false)
  const [optimizerResults, setOptimizerResults] = useState<BacktestOptimizerRun | null>(null)
  const [optimizerState, setOptimizerState] = useState<OptimizerState>({
    maxVariants: 100,
    mssMinConfirmCandles: '2,3,4,5',
    displacementType: 'GAP_OPTIONAL,GAP_REQUIRED,NO_GAP_ONLY',
    retraceRequired: 'true,false',
    retraceMinPct: '0,50,62',
    sweepMinDepthPips: '3,4,5,6',
    confirmationTf: 'M5,M15',
    entryTf: 'M1,M5'
  })
  const [optimizerSortBy, setOptimizerSortBy] = useState<'rank' | 'expectancyR' | 'winRate' | 'profitFactor' | 'maxDdR'>('rank')

  const inputRef = useRef<HTMLInputElement | null>(null)

  const tfOptions = useMemo(() => {
    const set = new Set((datasetInfo?.datasets || []).map((item) => item.timeframe))
    if (!set.size) return ['M5']
    return Array.from(set)
  }, [datasetInfo])

  const requestedExecutionTf = strategyConfig.smc.executionTf || strategyConfig.context.executionTimeframe
  const strategyConfigFingerprint = useMemo(() => JSON.stringify(strategyConfig), [strategyConfig])
  const strategyConfigDirty = Boolean(strategyConfigId) && strategyConfigFingerprint !== lastSavedConfigFingerprint

  const executionDataset = useMemo(() => {
    return pickExecutionDataset(datasetInfo?.datasets, requestedExecutionTf)
  }, [datasetInfo?.datasets, requestedExecutionTf])

  const rangeBounds = useMemo(() => {
    return resolveDatasetRangeBounds(executionDataset ? [executionDataset] : [])
  }, [executionDataset])

  const sessionHeaderSymbol = (headerSymbol || '').trim().toUpperCase()
  const reportInstrument = (datasetInfo?.instrument || instrument || '').trim().toUpperCase()
  const symbolMismatch = sessionHeaderSymbol && reportInstrument && sessionHeaderSymbol !== reportInstrument

  const datasetWarningIssues = executionDataset?.warnings || []
  const datasetFatalIssues = executionDataset?.fatalErrors || []
  const executionDatasetProcessing = executionDataset?.status === 'BUILDING' || executionDataset?.status === 'PROCESSING'

  const strategyWarnings = useMemo(() => {
    const warnings: string[] = []
    if (strategyConfig.context.spreadPips > 5 || strategyConfig.context.spreadPips < 0) {
      warnings.push('Spread looks unrealistic for EURUSD. Typical backtest default is around 0.8 pips.')
    }
    if (strategyConfig.context.slippagePips > 2 || strategyConfig.context.slippagePips < 0) {
      warnings.push('Slippage is outside common intraday simulation ranges (0.2 - 0.5 pips).')
    }
    if (strategyConfig.smc.sweepMinDepthPips < 1) {
      warnings.push('Sweep min depth below 1 pip is usually too permissive and captures micro-liquidity.')
    }
    if (strategyConfig.smc.mssMinConfirmCandles < 1) {
      warnings.push('MSS min confirm candles should be at least 1.')
    }
    if (strategyConfig.smc.poolMinAgeBars < 0 || strategyConfig.smc.poolMinSeparationBars < 0) {
      warnings.push('Pool age/separation must be non-negative.')
    }
    if (strategyConfig.smc.displacementMinBodyVsAvgMult < 1) {
      warnings.push('Displacement body-vs-average multiplier under 1.0 is very loose.')
    }
    if (strategyConfig.entryModel.type === 'LIMIT_RETRACE_PERCENT' && strategyConfig.entryModel.entryWindowBars < 2) {
      warnings.push('Limit retrace with entry window under 2 bars may produce unrealistic no-fill bias.')
    }
    if (strategyConfig.riskModel.minRR < 1) {
      warnings.push('Min RR below 1.0 is uncommon for this setup model.')
    }
    if (!strategyConfig.smc.allowNonHierarchicalTimeframes) {
      const tfRank = (tf: string) => timeframeSeconds(tf)
      if (tfRank(strategyConfig.smc.contextTf) < tfRank(strategyConfig.smc.poolTf)) {
        warnings.push('Timeframes invalid: contextTf must be >= poolTf unless non-hierarchical override is enabled.')
      }
      if (tfRank(strategyConfig.smc.poolTf) < tfRank(strategyConfig.smc.confirmationTf)) {
        warnings.push('Timeframes invalid: poolTf must be >= confirmationTf unless non-hierarchical override is enabled.')
      }
      if (tfRank(strategyConfig.smc.confirmationTf) < tfRank(strategyConfig.smc.entryTf)) {
        warnings.push('Timeframes invalid: confirmationTf must be >= entryTf unless non-hierarchical override is enabled.')
      }
      if (tfRank(strategyConfig.smc.executionTf) > tfRank(strategyConfig.smc.entryTf)) {
        warnings.push('Timeframes invalid: executionTf must be <= entryTf unless non-hierarchical override is enabled.')
      }
    }
    return warnings
  }, [strategyConfig])

  const runWindowValid = useMemo(() => {
    if (!runWindow.fromUtc || !runWindow.toUtc) return false
    if (rangeBounds.min && runWindow.fromUtc < rangeBounds.min) return false
    if (rangeBounds.max && runWindow.toUtc > rangeBounds.max) return false
    return runWindow.fromUtc <= runWindow.toUtc
  }, [rangeBounds.max, rangeBounds.min, runWindow.fromUtc, runWindow.toUtc])

  const canRunBacktest = useMemo(() => {
    if (!datasetSetId) return false
    if (!executionDataset) return false
    if (executionDatasetProcessing) return false
    if (!executionDataset.runnable) return false
    if ((executionDataset.candleCount || 0) <= 0) return false
    if (!runWindowValid) return false
    if (uploading || loadingDatasets || runBusy) return false
    return true
  }, [datasetSetId, executionDataset, executionDatasetProcessing, loadingDatasets, runBusy, runWindowValid, uploading])

  const runBlockedReason = useMemo(() => {
    if (!executionDataset) {
      return `Upload a dataset for ${requestedExecutionTf} (or a lower timeframe to resample).`
    }
    if (executionDatasetProcessing) {
      return `Selected timeframe dataset is ${executionDataset.status}. Wait until processing finishes.`
    }
    if (!executionDataset.runnable) {
      if (datasetFatalIssues.length > 0) {
        return datasetFatalIssues[0].message
      }
      return `Selected timeframe dataset is ${executionDataset.status} and is not runnable yet.`
    }
    if ((executionDataset.candleCount || 0) <= 0) {
      return `No persisted candles found for timeframe ${executionDataset.timeframe}. Re-import this CSV.`
    }
    if (!runWindowValid && rangeBounds.min && rangeBounds.max) {
      return `Select a valid range between ${rangeBounds.min} and ${rangeBounds.max}.`
    }
    return ''
  }, [datasetFatalIssues, executionDataset, executionDatasetProcessing, rangeBounds.max, rangeBounds.min, requestedExecutionTf, runWindowValid])

  const sortedOptimizerVariants = useMemo(() => {
    const rows = [...(optimizerResults?.variants || [])]
    if (optimizerSortBy === 'rank') {
      return rows.sort((a, b) => (a.rank || 0) - (b.rank || 0))
    }
    return rows.sort((a, b) => {
      const av = Number((a as any)[optimizerSortBy] ?? Number.NEGATIVE_INFINITY)
      const bv = Number((b as any)[optimizerSortBy] ?? Number.NEGATIVE_INFINITY)
      if (optimizerSortBy === 'maxDdR') {
        return av - bv
      }
      return bv - av
    })
  }, [optimizerResults?.variants, optimizerSortBy])

  const loadDatasets = async (id: string) => {
    if (!id) return
    setLoadingDatasets(true)
    try {
      const info = await getBacktestDatasetSetDatasets(id)
      setDatasetInfo(info)
      if (info.instrument && info.instrument !== 'UNKNOWN') {
        const availableTimeframes = new Set(info.datasets.map((item) => item.timeframe))
        setInstrument(info.instrument)
        setStrategyConfig((prev) => ({
          ...(() => {
            const fallbackTf = (info.datasets.find((d) => d.timeframe === 'M5')?.timeframe || info.datasets[0]?.timeframe || prev.context.executionTimeframe) as TimeframeRole
            const nextExecTf = availableTimeframes.has(prev.smc.executionTf)
              ? prev.smc.executionTf
              : fallbackTf
            return {
              ...prev,
              context: {
                ...prev.context,
                pipSize: inferPipSize(info.instrument),
                timezoneBasis: info.timezoneBasis || prev.context.timezoneBasis,
                executionTimeframe: nextExecTf
              },
              sessions: prev.sessions.map((session) => ({
                ...session,
                zoneId: info.timezoneBasis || session.zoneId
              })),
              smc: {
                ...prev.smc,
                executionTf: nextExecTf,
                sessionTimezone: info.timezoneBasis || prev.smc.sessionTimezone,
                sessionCalendar: prev.sessions.map((session, index) => ({
                  name: session.name,
                  timezoneId: info.timezoneBasis || session.zoneId,
                  localStartTime: session.startLocal,
                  localEndTime: session.endLocal,
                  enabled: session.enabled,
                  canGeneratePools: session.canGeneratePools,
                  canFilterEvaluation: session.canFilterEvaluation,
                  canFilterEntry: session.canFilterEntry,
                  displayOrder: session.displayOrder ?? index
                })),
                sessionTimeRanges: {
                  ASIA: { ...prev.smc.sessionTimeRanges.ASIA, zoneId: info.timezoneBasis || prev.smc.sessionTimeRanges.ASIA.zoneId },
                  LONDON: { ...prev.smc.sessionTimeRanges.LONDON, zoneId: info.timezoneBasis || prev.smc.sessionTimeRanges.LONDON.zoneId },
                  NY_AM: { ...prev.smc.sessionTimeRanges.NY_AM, zoneId: info.timezoneBasis || prev.smc.sessionTimeRanges.NY_AM.zoneId },
                  NY_PM: { ...prev.smc.sessionTimeRanges.NY_PM, zoneId: info.timezoneBasis || prev.smc.sessionTimeRanges.NY_PM.zoneId }
                }
              }
            }
          })()
        }))
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load datasets')
    } finally {
      setLoadingDatasets(false)
    }
  }

  useEffect(() => {
    if (datasetSetId) {
      void loadDatasets(datasetSetId)
    }
  }, [datasetSetId])

  useEffect(() => {
    if (!rangeBounds.min || !rangeBounds.max) return
    setRunWindow((prev) => normalizeRunWindowToBounds(prev, rangeBounds))
  }, [rangeBounds.max, rangeBounds.min])

  const ensureSet = async () => {
    if (datasetSetId) return datasetSetId
    const created = await createBacktestDatasetSet({ instrument, timezoneBasis })
    setDatasetSetId(created.id)
    localStorage.setItem(STORAGE_KEY, created.id)
    return created.id
  }

  const uploadFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    setError('')
    setSuccess('')
    setUploading(true)
    setUploadStage('UPLOADING')
    try {
      const id = await ensureSet()
      for (const file of Array.from(files)) {
        setUploadStage('UPLOADING')
        await uploadBacktestDatasetCsv(id, file)
      }
      setUploadStage('PARSING')
      setUploadStage('PERSISTING')
      await loadDatasets(id)
      setUploadStage('READY')
      setSuccess(`${files.length} file(s) uploaded and ingested.`)
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
      setUploadStage('')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    await uploadFiles(event.dataTransfer.files)
  }

  const buildPersistedConfig = (config: StrategyConfigState): StrategyConfigState => {
    const orderedSessions = [...config.sessions]
      .map((session, index) => ({
        ...session,
        displayOrder: session.displayOrder ?? index
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const sessionCalendar = orderedSessions.map((session, index) => ({
      name: session.name,
      timezoneId: session.zoneId || config.smc.sessionTimezone || 'UTC',
      localStartTime: session.startLocal,
      localEndTime: session.endLocal,
      enabled: session.enabled,
      canGeneratePools: session.canGeneratePools,
      canFilterEvaluation: session.canFilterEvaluation,
      canFilterEntry: session.canFilterEntry,
      displayOrder: session.displayOrder ?? index
    }))

    return {
      ...config,
      context: {
        ...config.context,
        executionTimeframe: config.smc.executionTf
      },
      smc: {
        ...config.smc,
        sessionCalendar,
        executionTf: config.smc.executionTf,
        contextTf: config.smc.contextTf,
        poolTf: config.smc.poolTf,
        confirmationTf: config.smc.confirmationTf,
        entryTf: config.smc.entryTf
      }
    }
  }

  const persistStrategyConfig = async (stepOnSuccess = false) => {
    if (!datasetSetId) {
      throw new Error('Upload data first.')
    }
    const payloadConfig = buildPersistedConfig(strategyConfig)
    const payload = {
      name: payloadConfig.name,
      configJson: payloadConfig
    }
    const saved = await saveBacktestStrategyConfig(datasetSetId, payload)
    setStrategyConfig(payloadConfig)
    setStrategyConfigId(saved.id)
    setLastSavedConfigFingerprint(JSON.stringify(payloadConfig))
    if (stepOnSuccess) {
      setStep(2)
    }
    return saved
  }

  const handleSaveStrategy = async () => {
    if (!datasetSetId) {
      setError('Upload data first.')
      return
    }
    setSaveStrategyBusy(true)
    setError('')
    setSuccess('')
    try {
      await persistStrategyConfig(true)
      setSuccess('Strategy config saved.')
    } catch (e: any) {
      setError(e?.message || 'Failed to save strategy config')
    } finally {
      setSaveStrategyBusy(false)
    }
  }

  const handleSavePreset = () => {
    const key = presetName.trim()
    if (!key) {
      setError('Preset name is required.')
      return
    }
    const next = {
      ...savedPresets,
      [key]: strategyConfig
    }
    setSavedPresets(next)
    setSelectedPresetKey(key)
    persistPresets(next)
    setPresetName('')
    setSuccess(`Preset "${key}" saved.`)
  }

  const handleLoadPreset = (key: string) => {
    if (!key) return
    const preset = savedPresets[key]
    if (!preset) return
    setStrategyConfig(normalizeStrategyConfig(preset))
    setSelectedPresetKey(key)
    setSuccess(`Preset "${key}" loaded.`)
  }

  const handleApplyHqDefaults = () => {
    const base = defaultConfig()
    const execTf = (strategyConfig.smc.executionTf || strategyConfig.context.executionTimeframe || base.context.executionTimeframe) as TimeframeRole
    setStrategyConfig({
      ...base,
      name: strategyConfig.name || base.name,
      context: {
        ...base.context,
        pipSize: inferPipSize(instrument || 'EURUSD'),
        executionTimeframe: execTf
      },
      smc: {
        ...base.smc,
        executionTf: execTf,
        contextTf: 'H1',
        poolTf: 'M15',
        confirmationTf: 'M5',
        entryTf: 'M5'
      }
    })
    setSuccess('HQ defaults applied.')
  }

  const loadRunArtifacts = async (runId: string) => {
    const runResults = await getBacktestRunResultsV2(runId)
    setResults(runResults)
    try {
      const runReport = await getBacktestRunReportV2(runId)
      setReport(runReport)
    } catch {
      setReport(null)
    }
  }

  const handleRunOptimizer = async () => {
    if (!datasetSetId || !executionDataset || !runWindowValid) {
      setError('Save strategy and set a valid run window before optimizer.')
      return
    }
    setOptimizerBusy(true)
    setError('')
    try {
      const fromUtc = runWindow.fromUtc === toIsoDay(executionDataset.minTimeUtc)
        ? executionDataset.minTimeUtc
        : `${runWindow.fromUtc}T00:00:00Z`
      const toUtc = runWindow.toUtc === toIsoDay(executionDataset.maxTimeUtc)
        ? executionDataset.maxTimeUtc
        : `${runWindow.toUtc}T23:59:59Z`
      let effectiveStrategyConfigId = strategyConfigId
      if (!effectiveStrategyConfigId || strategyConfigDirty) {
        const saved = await persistStrategyConfig(false)
        effectiveStrategyConfigId = saved.id
      }

      const started = await runBacktestOptimizer(datasetSetId, {
        strategyConfigId: effectiveStrategyConfigId,
        fromUtc,
        toUtc,
        sessionFilter: runWindow.sessionFilter || undefined,
        maxVariants: optimizerState.maxVariants,
        grid: {
          mssMinConfirmCandles: parseNumberList(optimizerState.mssMinConfirmCandles).map((item) => Math.trunc(item)),
          displacementType: optimizerState.displacementType.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean),
          retraceRequired: parseBooleanList(optimizerState.retraceRequired),
          retraceMinPct: parseNumberList(optimizerState.retraceMinPct),
          sweepMinDepthPips: parseNumberList(optimizerState.sweepMinDepthPips),
          confirmationTf: optimizerState.confirmationTf.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean),
          entryTf: optimizerState.entryTf.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean)
        }
      })
      const persisted = await getBacktestOptimizerRun(started.optimizerRunId)
      setOptimizerResults(persisted)
      setSuccess(`Optimizer completed with ${persisted.variantCount} variants.`)
    } catch (e: any) {
      setError(e?.message || 'Optimizer run failed')
    } finally {
      setOptimizerBusy(false)
    }
  }

  const handleRun = async () => {
    setRunLifecycleState('validating')
    if (!datasetSetId) {
      setError('Upload data first.')
      setRunLifecycleState('failed')
      return
    }
    if (!runWindowValid) {
      setError('Select a valid date range within dataset bounds.')
      setRunLifecycleState('failed')
      return
    }
    if (!executionDataset) {
      setError(`Upload a dataset for timeframe ${requestedExecutionTf} first.`)
      setRunLifecycleState('failed')
      return
    }
    if (executionDatasetProcessing) {
      setError(`Selected timeframe dataset is ${executionDataset.status}. Wait until processing finishes.`)
      setRunLifecycleState('failed')
      return
    }
    if (!executionDataset.runnable) {
      setError(datasetFatalIssues[0]?.message || `Selected timeframe dataset is ${executionDataset.status} and is not runnable.`)
      setRunLifecycleState('failed')
      return
    }
    if ((executionDataset.candleCount || 0) <= 0) {
      setError(`No persisted candles found for timeframe ${executionDataset.timeframe}. Re-import this CSV.`)
      setRunLifecycleState('failed')
      return
    }

    setRunBusy(true)
    setError('')
    setSuccess('')
    setRunLifecycleState('queued')
    setSelectedTrade(null)
    setLastRun(null)
    setResults(null)
    setReport(null)

    try {
      let effectiveStrategyConfigId = strategyConfigId
      if (!effectiveStrategyConfigId || strategyConfigDirty) {
        const saved = await persistStrategyConfig(false)
        effectiveStrategyConfigId = saved.id
      }

      const fromUtc = runWindow.fromUtc === toIsoDay(executionDataset.minTimeUtc)
        ? executionDataset.minTimeUtc
        : `${runWindow.fromUtc}T00:00:00Z`
      const toUtc = runWindow.toUtc === toIsoDay(executionDataset.maxTimeUtc)
        ? executionDataset.maxTimeUtc
        : `${runWindow.toUtc}T23:59:59Z`
      setRunLifecycleState('running')
      const run = await runBacktestDatasetSet(datasetSetId, {
        strategyConfigId: effectiveStrategyConfigId,
        fromUtc,
        toUtc,
        sessionFilter: runWindow.sessionFilter || undefined,
        autoGenerateReport: true
      })
      setLastRun(run)
      if (run.status === 'FAILED') {
        setError(run.errorMsg || 'Backtest run failed')
        setRunLifecycleState('failed')
        return
      }
      await loadRunArtifacts(run.runId)
      setSuccess(run.warnings && run.warnings.length
        ? `Backtest completed with warnings: ${run.warnings[0]}`
        : 'Backtest completed.')
      setRunLifecycleState('completed')
      setStep(3)
    } catch (e: any) {
      setError(e?.message || 'Backtest failed')
      setRunLifecycleState('failed')
    } finally {
      setRunBusy(false)
    }
  }

  const handleApplyVariant = (params: Record<string, unknown>) => {
    setStrategyConfig((prev) => {
      const next = { ...prev }
      const smc = { ...next.smc }
      if (typeof params.mssMinConfirmCandles === 'number') {
        smc.mssMinConfirmCandles = Math.trunc(params.mssMinConfirmCandles)
      }
      if (typeof params.displacementType === 'string') {
        smc.displacementType = params.displacementType as DisplacementType
      }
      if (typeof params.retraceRequired === 'boolean') {
        smc.retraceRequired = params.retraceRequired
      }
      if (typeof params.retraceMinPct === 'number') {
        smc.retraceMinPct = params.retraceMinPct
      }
      if (typeof params.sweepMinDepthPips === 'number') {
        smc.sweepMinDepthPips = params.sweepMinDepthPips
      }
      if (typeof params.confirmationTf === 'string') {
        smc.confirmationTf = params.confirmationTf as TimeframeRole
      }
      if (typeof params.entryTf === 'string') {
        smc.entryTf = params.entryTf as TimeframeRole
      }
      return { ...next, smc }
    })
    setStep(1)
    setSuccess('Variant applied to current strategy config. Save and regenerate to test it.')
  }

  const handleGenerateReport = async () => {
    if (!lastRun?.runId) {
      setError('Run backtest first.')
      return
    }
    try {
      const runReport = await getBacktestRunReportV2(lastRun.runId)
      setReport(runReport)
      setSuccess('Diagnostics report loaded.')
    } catch (e: any) {
      setError(e?.message || 'Report not available yet. Re-run with auto report enabled.')
    }
  }

  return (
    <Stack spacing={1.5}>
      <Stepper activeStep={step} alternativeLabel={!isMobile} orientation={isMobile ? 'vertical' : 'horizontal'}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {uploading || loadingDatasets || runBusy ? <LinearProgress /> : null}
      {uploadStage ? <Alert severity={uploadStage === 'READY' ? 'success' : 'info'}>{`Upload status: ${uploadStage}`}</Alert> : null}
      {symbolMismatch ? (
        <Alert severity="warning">
          {`Symbol mismatch: Session header shows ${sessionHeaderSymbol}, but this backtest dataset/report uses ${reportInstrument}.`}
        </Alert>
      ) : null}
      {runLifecycleState !== 'idle' ? (
        <Alert severity={runLifecycleState === 'failed' ? 'error' : (runLifecycleState === 'completed' ? 'success' : 'info')}>
          {`Regenerate state: ${runLifecycleState.toUpperCase()}`}
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            {step === 0 && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Instrument"
                    value={instrument}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                      setInstrument(value)
                      setStrategyConfig((prev) => ({
                        ...prev,
                        context: {
                          ...prev.context,
                          pipSize: inferPipSize(value)
                        },
                        smc: {
                          ...prev.smc
                        }
                      }))
                    }}
                    helperText="Override before first upload if filename detection is wrong"
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel id="timezone-basis">Timezone basis</InputLabel>
                    <Select
                      labelId="timezone-basis"
                      label="Timezone basis"
                      value={timezoneBasis}
                      onChange={(event) => {
                        const value = event.target.value
                        setTimezoneBasis(value)
                        setStrategyConfig((prev) => ({
                          ...prev,
                          context: { ...prev.context, timezoneBasis: value },
                          smc: {
                            ...prev.smc,
                            sessionTimezone: value,
                            sessionTimeRanges: {
                              ASIA: { ...prev.smc.sessionTimeRanges.ASIA, zoneId: value },
                              LONDON: { ...prev.smc.sessionTimeRanges.LONDON, zoneId: value },
                              NY_AM: { ...prev.smc.sessionTimeRanges.NY_AM, zoneId: value },
                              NY_PM: { ...prev.smc.sessionTimeRanges.NY_PM, zoneId: value }
                            }
                          }
                        }))
                      }}
                    >
                      <MenuItem value="UTC">UTC</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Box
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleDrop(event)}
                  sx={{
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'action.hover'
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <UploadFileRoundedIcon color="primary" />
                    <Typography variant="subtitle2">Drop CSV files (multi-timeframe supported)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Required: time/open/high/low/close. Extra columns are ignored.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="contained" size="small" onClick={() => inputRef.current?.click()} disabled={uploading}>
                        Choose files
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => setStep(1)} disabled={!datasetInfo?.datasets?.length}>
                        Continue
                      </Button>
                    </Stack>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".csv,text/csv"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(event) => void handleFileInput(event)}
                    />
                  </Stack>
                </Box>

                <Divider />
                <Typography variant="subtitle2">Upload Summary</Typography>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Filename</TableCell>
                        <TableCell>TF</TableCell>
                        <TableCell>Candles</TableCell>
                        <TableCell>Min date</TableCell>
                        <TableCell>Max date</TableCell>
                        <TableCell>Mapped columns</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(datasetInfo?.datasets || []).map((row) => (
                        <TableRow key={row.datasetId}>
                          <TableCell sx={{ maxWidth: 220, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{row.originalFilename}</TableCell>
                          <TableCell>{row.timeframe}</TableCell>
                          <TableCell>{row.candleCount}</TableCell>
                          <TableCell>{formatUtcTimestamp(row.minTimeUtc)}</TableCell>
                          <TableCell>{formatUtcTimestamp(row.maxTimeUtc)}</TableCell>
                          <TableCell>{row.columnsMapped}</TableCell>
                          <TableCell>
                            <Chip size="small" color={row.status === 'ERROR' ? 'error' : (row.status === 'WARN' ? 'warning' : 'success')} label={row.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              color="error"
                              onClick={async () => {
                                await deleteBacktestDataset(row.datasetId)
                                if (datasetSetId) {
                                  await loadDatasets(datasetSetId)
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!(datasetInfo?.datasets || []).length && (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <Typography variant="caption" color="text.secondary">No files uploaded yet.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {!!datasetInfo?.sessionPreview?.length && (
                  <>
                    <Typography variant="subtitle2">Session Preview</Typography>
                    <Grid container spacing={1}>
                      {datasetInfo.sessionPreview.map((session) => (
                        <Grid item xs={12} sm={4} key={`${session.sessionName}-${session.sessionDate}`}>
                          <Card variant="outlined">
                            <CardContent>
                              <Stack spacing={0.5}>
                                <Typography variant="subtitle2">{session.sessionName}</Typography>
                                <Typography variant="caption" color="text.secondary">{session.sessionDate}</Typography>
                                <Typography variant="body2">Candles: {session.candleCount}</Typography>
                                <Typography variant="body2">H/L: {session.sessionHigh} / {session.sessionLow}</Typography>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Strategy name"
                    fullWidth
                    value={strategyConfig.name}
                    onChange={(event) => setStrategyConfig((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel id="exec-tf">Execution TF</InputLabel>
                    <Select
                      labelId="exec-tf"
                      label="Execution TF"
                      value={strategyConfig.smc.executionTf}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, executionTimeframe: event.target.value },
                        smc: { ...prev.smc, executionTf: event.target.value as TimeframeRole }
                      }))}
                    >
                      {[...new Set([...(tfOptions as TimeframeRole[]), ...TIMEFRAME_OPTIONS])].map((tf) => (
                        <MenuItem key={tf} value={tf}>{tf}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" startIcon={<TuneRoundedIcon />} onClick={handleApplyHqDefaults}>
                    HQ Default Preset
                  </Button>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setStrategyConfig((prev) => applyTemplate(prev, 'ASIA_LONDON_REVERSAL'))}>
                    Asia Raid -&gt; London Reversal
                  </Button>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setStrategyConfig((prev) => applyTemplate(prev, 'LONDON_NY_REVERSAL'))}>
                    London Raid -&gt; NY Reversal
                  </Button>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setStrategyConfig((prev) => applyTemplate(prev, 'BOS_CONTINUATION'))}>
                    BOS Continuation
                  </Button>
                </Stack>

                <Divider />
                <Typography variant="subtitle2">Preset Library</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Preset name"
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    fullWidth
                  />
                  <Button variant="outlined" onClick={handleSavePreset}>Save Preset</Button>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="preset-select">Load preset</InputLabel>
                    <Select
                      labelId="preset-select"
                      label="Load preset"
                      value={selectedPresetKey}
                      onChange={(event) => {
                        const key = event.target.value
                        handleLoadPreset(key)
                      }}
                    >
                      <MenuItem value="">Select</MenuItem>
                      {Object.keys(savedPresets).sort().map((key) => (
                        <MenuItem key={key} value={key}>{key}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <Divider />
                <Typography variant="subtitle2">Timeframes</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="tf-context">Context TF</InputLabel>
                      <Select
                        labelId="tf-context"
                        label="Context TF"
                        value={strategyConfig.smc.contextTf}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, contextTf: event.target.value as TimeframeRole }
                        }))}
                      >
                        {TIMEFRAME_OPTIONS.map((tf) => <MenuItem key={tf} value={tf}>{tf}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="tf-pool">Pool TF</InputLabel>
                      <Select
                        labelId="tf-pool"
                        label="Pool TF"
                        value={strategyConfig.smc.poolTf}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, poolTf: event.target.value as TimeframeRole }
                        }))}
                      >
                        {TIMEFRAME_OPTIONS.map((tf) => <MenuItem key={tf} value={tf}>{tf}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="tf-confirmation">Confirmation TF</InputLabel>
                      <Select
                        labelId="tf-confirmation"
                        label="Confirmation TF"
                        value={strategyConfig.smc.confirmationTf}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          setupRule: { ...prev.setupRule, confirmationTf: event.target.value },
                          smc: { ...prev.smc, confirmationTf: event.target.value as TimeframeRole }
                        }))}
                      >
                        {TIMEFRAME_OPTIONS.map((tf) => <MenuItem key={tf} value={tf}>{tf}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="tf-entry">Entry TF</InputLabel>
                      <Select
                        labelId="tf-entry"
                        label="Entry TF"
                        value={strategyConfig.smc.entryTf}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, entryTf: event.target.value as TimeframeRole }
                        }))}
                      >
                        {TIMEFRAME_OPTIONS.map((tf) => <MenuItem key={tf} value={tf}>{tf}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="tf-non-hier">Allow non-hierarchical</InputLabel>
                      <Select
                        labelId="tf-non-hier"
                        label="Allow non-hierarchical"
                        value={String(strategyConfig.smc.allowNonHierarchicalTimeframes)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, allowNonHierarchicalTimeframes: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="false">false (recommended)</MenuItem>
                        <MenuItem value="true">true</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {strategyWarnings.length > 0 ? (
                  <Stack spacing={0.8}>
                    {strategyWarnings.map((warning) => (
                      <Alert key={warning} severity="warning">{warning}</Alert>
                    ))}
                  </Stack>
                ) : null}

                <Divider />
                <Typography variant="subtitle2">Execution Realism</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label={<HintLabel label="Pip size" tooltip="What: price precision unit. Why: all pip thresholds depend on it. Trade-off: wrong pip size distorts depth/body filters." />}
                      fullWidth
                      value={strategyConfig.context.pipSize}
                      helperText="EURUSD default is 0.0001"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, pipSize: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label={<HintLabel label="Spread (pips)" tooltip="What: execution spread model. Why: impacts net R and fill realism. Trade-off: higher spread lowers frequency and edge." />}
                      fullWidth
                      value={strategyConfig.context.spreadPips}
                      helperText="HQ default 0.8 pips"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, spreadPips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label={<HintLabel label="Slippage (pips)" tooltip="What: execution slip on fills/exits. Why: avoids overfitting perfect entries. Trade-off: higher slippage reduces reported win rate." />}
                      fullWidth
                      value={strategyConfig.context.slippagePips}
                      helperText="HQ default 0.3 pips"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, slippagePips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label={<HintLabel label="Touch tolerance (pips)" tooltip="What: tolerance around levels. Why: controls strictness of sweep/touch validation. Trade-off: tighter is cleaner but misses setups." />}
                      fullWidth
                      value={strategyConfig.context.touchTolerancePips}
                      helperText="Base tolerance applied in sweep checks (HQ 0.5)"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, touchTolerancePips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="fill-policy">Fill policy</InputLabel>
                      <Select
                        labelId="fill-policy"
                        label="Fill policy"
                        value={strategyConfig.smc.fillPolicy}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, fillPolicy: event.target.value as StrategyConfigState['smc']['fillPolicy'] }
                        }))}
                      >
                        <MenuItem value="BID_ASK_SIM">BID_ASK_SIM</MenuItem>
                        <MenuItem value="MID">MID</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider />
                <Typography variant="subtitle2">Sessions &amp; Killzones</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="setup-session">Setup session</InputLabel>
                      <Select
                        labelId="setup-session"
                        label="Setup session"
                        value={strategyConfig.setupRule.session}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          setupRule: { ...prev.setupRule, session: event.target.value }
                        }))}
                      >
                        {SESSION_NAMES.map((session) => (
                          <MenuItem key={session} value={session}>{session}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Sessions enabled"
                      value={strategyConfig.smc.sessionsEnabled.join(',')}
                      helperText="Comma separated: ASIA,LONDON,NY_AM,NY_PM"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, sessionsEnabled: parseCsvSelection(event.target.value, SESSION_NAMES) as SessionName[] }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Sweep source sessions"
                      value={strategyConfig.smc.sweepSourceSessions.join(',')}
                      helperText="Which session levels can be swept"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, sweepSourceSessions: parseCsvSelection(event.target.value, SESSION_NAMES) as SessionName[] }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Evaluation sessions"
                      value={strategyConfig.smc.evaluationSessionFilter.join(',')}
                      helperText="Where setups are allowed"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, evaluationSessionFilter: parseCsvSelection(event.target.value, SESSION_NAMES) as SessionName[] }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Entry sessions"
                      value={strategyConfig.smc.entrySessions.join(',')}
                      helperText="Where entries are allowed"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, entrySessions: parseCsvSelection(event.target.value, SESSION_NAMES) as SessionName[] }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="cross-session-sweep">Cross-session sweep</InputLabel>
                      <Select
                        labelId="cross-session-sweep"
                        label="Cross-session sweep"
                        value={String(strategyConfig.smc.requireCrossSessionSweep)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, requireCrossSessionSweep: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="false">false</MenuItem>
                        <MenuItem value="true">true</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="same-session-sweep-entry">Same session sweep/entry</InputLabel>
                      <Select
                        labelId="same-session-sweep-entry"
                        label="Same session sweep/entry"
                        value={String(strategyConfig.smc.requireSameSessionForSweepAndEntry)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, requireSameSessionForSweepAndEntry: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="false">false</MenuItem>
                        <MenuItem value="true">true</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="unswept-pool-only">Unswept pool required</InputLabel>
                      <Select
                        labelId="unswept-pool-only"
                        label="Unswept pool required"
                        value={String(strategyConfig.smc.sweepRequiresUnsweptPool)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, sweepRequiresUnsweptPool: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="true">true</MenuItem>
                        <MenuItem value="false">false</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="require-killzone">Require killzone</InputLabel>
                      <Select
                        labelId="require-killzone"
                        label="Require killzone"
                        value={String(strategyConfig.smc.requireKillzone)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, requireKillzone: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="true">true</MenuItem>
                        <MenuItem value="false">false</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      label="London killzone (UTC)"
                      value={`${strategyConfig.smc.killzoneWindowsUtc.LONDON?.start || '07:00'}-${strategyConfig.smc.killzoneWindowsUtc.LONDON?.end || '10:00'}`}
                      helperText="Why: tighter timing filter improves setup quality. Trade-off: fewer signals."
                      onChange={(event) => {
                        const [start, end] = event.target.value.split('-').map((item) => item.trim())
                        setStrategyConfig((prev) => ({
                          ...prev,
                          smc: {
                            ...prev.smc,
                            killzoneWindowsUtc: {
                              ...prev.smc.killzoneWindowsUtc,
                              LONDON: { start: start || '07:00', end: end || '10:00', zoneId: 'UTC' }
                            }
                          }
                        }))
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      label="NY AM killzone (UTC)"
                      value={`${strategyConfig.smc.killzoneWindowsUtc.NY_AM?.start || '12:30'}-${strategyConfig.smc.killzoneWindowsUtc.NY_AM?.end || '15:30'}`}
                      helperText="Why: focuses on high-impact NY_AM window. Trade-off: may skip valid off-window setups."
                      onChange={(event) => {
                        const [start, end] = event.target.value.split('-').map((item) => item.trim())
                        setStrategyConfig((prev) => ({
                          ...prev,
                          smc: {
                            ...prev.smc,
                            killzoneWindowsUtc: {
                              ...prev.smc.killzoneWindowsUtc,
                              NY_AM: { start: start || '12:30', end: end || '15:30', zoneId: 'UTC' }
                            }
                          }
                        }))
                      }}
                    />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2">Session Calendar Editor</Typography>
                <Grid container spacing={1}>
                  {strategyConfig.sessions.map((session, index) => (
                    <Grid item xs={12} key={`${session.name}-${index}`}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                        sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                      >
                        <TextField
                          size="small"
                          label="Session"
                          value={session.name}
                          onChange={(event) => setStrategyConfig((prev) => {
                            const next = [...prev.sessions]
                            next[index] = { ...next[index], name: event.target.value.toUpperCase().replace('-', '_') }
                            return { ...prev, sessions: next }
                          })}
                          sx={{ minWidth: 120 }}
                        />
                        <TextField
                          size="small"
                          label="Timezone"
                          value={session.zoneId}
                          onChange={(event) => setStrategyConfig((prev) => {
                            const next = [...prev.sessions]
                            next[index] = { ...next[index], zoneId: event.target.value }
                            return { ...prev, sessions: next, smc: { ...prev.smc, sessionTimezone: event.target.value || prev.smc.sessionTimezone } }
                          })}
                          sx={{ minWidth: 180 }}
                        />
                        <TextField
                          size="small"
                          label="Local start"
                          value={session.startLocal}
                          onChange={(event) => setStrategyConfig((prev) => {
                            const next = [...prev.sessions]
                            next[index] = { ...next[index], startLocal: event.target.value }
                            return { ...prev, sessions: next }
                          })}
                          sx={{ minWidth: 120 }}
                        />
                        <TextField
                          size="small"
                          label="Local end"
                          value={session.endLocal}
                          onChange={(event) => setStrategyConfig((prev) => {
                            const next = [...prev.sessions]
                            next[index] = { ...next[index], endLocal: event.target.value }
                            return { ...prev, sessions: next }
                          })}
                          sx={{ minWidth: 120 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>{`${session.name} enabled`}</InputLabel>
                          <Select
                            label={`${session.name} enabled`}
                            value={String(session.enabled)}
                            onChange={(event) => setStrategyConfig((prev) => {
                              const next = [...prev.sessions]
                              next[index] = { ...next[index], enabled: event.target.value === 'true' }
                              return { ...prev, sessions: next }
                            })}
                          >
                            <MenuItem value="true">enabled</MenuItem>
                            <MenuItem value="false">disabled</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>Generate pools</InputLabel>
                          <Select
                            label="Generate pools"
                            value={String(session.canGeneratePools)}
                            onChange={(event) => setStrategyConfig((prev) => {
                              const next = [...prev.sessions]
                              next[index] = { ...next[index], canGeneratePools: event.target.value === 'true' }
                              return { ...prev, sessions: next }
                            })}
                          >
                            <MenuItem value="true">yes</MenuItem>
                            <MenuItem value="false">no</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>Filter eval</InputLabel>
                          <Select
                            label="Filter eval"
                            value={String(session.canFilterEvaluation)}
                            onChange={(event) => setStrategyConfig((prev) => {
                              const next = [...prev.sessions]
                              next[index] = { ...next[index], canFilterEvaluation: event.target.value === 'true' }
                              return { ...prev, sessions: next }
                            })}
                          >
                            <MenuItem value="true">yes</MenuItem>
                            <MenuItem value="false">no</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>Filter entry</InputLabel>
                          <Select
                            label="Filter entry"
                            value={String(session.canFilterEntry)}
                            onChange={(event) => setStrategyConfig((prev) => {
                              const next = [...prev.sessions]
                              next[index] = { ...next[index], canFilterEntry: event.target.value === 'true' }
                              return { ...prev, sessions: next }
                            })}
                          >
                            <MenuItem value="true">yes</MenuItem>
                            <MenuItem value="false">no</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>

                <Divider />
                <Typography variant="subtitle2">Pool Definition</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="sweep-type">Sweep type</InputLabel>
                      <Select
                        labelId="sweep-type"
                        label="Sweep type"
                        value={strategyConfig.setupRule.sweepType}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          setupRule: { ...prev.setupRule, sweepType: event.target.value as StrategyConfigState['setupRule']['sweepType'] }
                        }))}
                      >
                        {POOL_TYPES.map((pool) => (
                          <MenuItem key={pool} value={pool}>{pool}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Pool types enabled"
                      value={strategyConfig.smc.poolTypesEnabled.join(',')}
                      helperText="Comma separated pool types"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, poolTypesEnabled: parseCsvSelection(event.target.value, POOL_TYPES) as PoolType[] }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Pool touch tolerance (pips)"
                      fullWidth
                      value={strategyConfig.smc.poolTouchTolerancePips}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, poolTouchTolerancePips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Pool min touches"
                      fullWidth
                      value={strategyConfig.smc.poolMinTouches}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, poolMinTouches: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="pool-tf">Pool detection TF</InputLabel>
                      <Select
                        labelId="pool-tf"
                        label="Pool detection TF"
                        value={strategyConfig.smc.poolTimeframeForDetection}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, poolTimeframeForDetection: event.target.value }
                        }))}
                      >
                        {['M1', 'M5', 'M15', 'H1'].map((tf) => <MenuItem key={tf} value={tf}>{tf}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Pool min separation bars"
                      fullWidth
                      value={strategyConfig.smc.poolMinSeparationBars}
                      helperText="Higher = cleaner EQ clusters, fewer pools"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, poolMinSeparationBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Pool min age bars"
                      fullWidth
                      value={strategyConfig.smc.poolMinAgeBars}
                      helperText="Higher = avoid fresh/immature pools"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, poolMinAgeBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="pool-rank">Pool rank rule</InputLabel>
                      <Select
                        labelId="pool-rank"
                        label="Pool rank rule"
                        value={strategyConfig.smc.poolRankRule}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, poolRankRule: event.target.value as StrategyConfigState['smc']['poolRankRule'] }
                        }))}
                      >
                        <MenuItem value="MOST_TOUCHES_THEN_RECENCY">MOST_TOUCHES_THEN_RECENCY</MenuItem>
                        <MenuItem value="TOUCH_COUNT">TOUCH_COUNT</MenuItem>
                        <MenuItem value="LARGEST_SWING">LARGEST_SWING</MenuItem>
                        <MenuItem value="NEAREST_RECENT">NEAREST_RECENT</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider />
                <Typography variant="subtitle2">Sweep / Displacement / MSS / Structure</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Sweep min depth (pips)"
                      fullWidth
                      value={strategyConfig.smc.sweepMinDepthPips}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, sweepMinDepthPips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Sweep max duration bars"
                      fullWidth
                      value={strategyConfig.smc.sweepMaxDurationBars}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, sweepMaxDurationBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Displacement max delay bars"
                      fullWidth
                      value={strategyConfig.smc.displacementMaxDelayBarsAfterSweep}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, displacementMaxDelayBarsAfterSweep: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Displacement body vs avg"
                      fullWidth
                      value={strategyConfig.smc.displacementMinBodyVsAvgMult}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, displacementMinBodyVsAvgMult: Number(event.target.value) },
                        qualityFilters: { ...prev.qualityFilters, displacementMultiplier: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="sweep-select-rule">Sweep select rule</InputLabel>
                      <Select
                        labelId="sweep-select-rule"
                        label="Sweep select rule"
                        value={strategyConfig.smc.sweepSelectRule}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, sweepSelectRule: event.target.value as StrategyConfigState['smc']['sweepSelectRule'] }
                        }))}
                      >
                        <MenuItem value="MAX_DEPTH_THEN_BEST_RANKED_POOL">MAX_DEPTH_THEN_BEST_RANKED_POOL</MenuItem>
                        <MenuItem value="LARGEST_DEPTH">LARGEST_DEPTH</MenuItem>
                        <MenuItem value="HIGHEST_RANKED_POOL">HIGHEST_RANKED_POOL</MenuItem>
                        <MenuItem value="NEWEST_SESSION_LEVEL">NEWEST_SESSION_LEVEL</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="disp-type">Displacement type</InputLabel>
                      <Select
                        labelId="disp-type"
                        label="Displacement type"
                        value={strategyConfig.smc.displacementType}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, displacementType: event.target.value as DisplacementType }
                        }))}
                      >
                        <MenuItem value="GAP_OPTIONAL">GAP_OPTIONAL (HQ)</MenuItem>
                        <MenuItem value="GAP_REQUIRED">GAP_REQUIRED</MenuItem>
                        <MenuItem value="NO_GAP_ONLY">NO_GAP_ONLY</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="disp-gap-def">Gap definition</InputLabel>
                      <Select
                        labelId="disp-gap-def"
                        label="Gap definition"
                        value={strategyConfig.smc.displacementGapDefinition}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, displacementGapDefinition: event.target.value as DisplacementGapDefinition }
                        }))}
                      >
                        <MenuItem value="THREE_CANDLE_FVG">THREE_CANDLE_FVG</MenuItem>
                        <MenuItem value="TWO_CANDLE_GAP">TWO_CANDLE_GAP</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Gap min pips"
                      fullWidth
                      value={strategyConfig.smc.displacementGapMinPips}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, displacementGapMinPips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="No instant overlap bars"
                      fullWidth
                      value={strategyConfig.smc.displacementNoInstantOverlapBars}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, displacementNoInstantOverlapBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="MSS min confirm candles"
                      fullWidth
                      value={strategyConfig.smc.mssMinConfirmCandles}
                      helperText="Higher = fewer but cleaner structure shifts"
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, mssMinConfirmCandles: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="MSS confirm window bars"
                      fullWidth
                      value={strategyConfig.smc.mssMaxConfirmWindowBars}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, mssMaxConfirmWindowBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                </Grid>

                <Divider />
                <Typography variant="subtitle2">Retrace &amp; Entry + Risk</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="entry-model">Entry model</InputLabel>
                      <Select
                        labelId="entry-model"
                        label="Entry model"
                        value={strategyConfig.entryModel.type}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          entryModel: { ...prev.entryModel, type: event.target.value as StrategyConfigState['entryModel']['type'] }
                        }))}
                      >
                        <MenuItem value="MARKET_ON_CONFIRM_CLOSE">MARKET_ON_CONFIRM_CLOSE</MenuItem>
                        <MenuItem value="LIMIT_RETRACE_PERCENT">LIMIT_RETRACE_PERCENT</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="number"
                      label="Retrace %"
                      fullWidth
                      value={strategyConfig.entryModel.retracePercent}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        entryModel: { ...prev.entryModel, retracePercent: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="retrace-required">Retrace required</InputLabel>
                      <Select
                        labelId="retrace-required"
                        label="Retrace required"
                        value={String(strategyConfig.smc.retraceRequired)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, retraceRequired: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="true">true</MenuItem>
                        <MenuItem value="false">false</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="retrace-ref">Retrace reference</InputLabel>
                      <Select
                        labelId="retrace-ref"
                        label="Retrace reference"
                        value={strategyConfig.smc.retraceReference}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, retraceReference: event.target.value as RetraceReference }
                        }))}
                      >
                        <MenuItem value="GAP_FILL">GAP_FILL</MenuItem>
                        <MenuItem value="IMPULSE_LEG">IMPULSE_LEG</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="number"
                      label="Retrace min % gate"
                      fullWidth
                      value={strategyConfig.smc.retraceMinPct}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, retraceMinPct: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="number"
                      label="Retrace max wait bars"
                      fullWidth
                      value={strategyConfig.smc.retraceMaxWaitBars}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        smc: { ...prev.smc, retraceMaxWaitBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="retrace-wick">Retrace wick touch</InputLabel>
                      <Select
                        labelId="retrace-wick"
                        label="Retrace wick touch"
                        value={String(strategyConfig.smc.retraceAcceptWickTouch)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, retraceAcceptWickTouch: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="true">true</MenuItem>
                        <MenuItem value="false">false</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="number"
                      label="Entry window bars"
                      fullWidth
                      value={strategyConfig.entryModel.entryWindowBars}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        entryModel: { ...prev.entryModel, entryWindowBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Fixed R"
                      fullWidth
                      value={strategyConfig.riskModel.fixedR}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        riskModel: { ...prev.riskModel, fixedR: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Min RR"
                      fullWidth
                      value={strategyConfig.riskModel.minRR}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        riskModel: { ...prev.riskModel, minRR: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="debug-fields">Emit debug fields</InputLabel>
                      <Select
                        labelId="debug-fields"
                        label="Emit debug fields"
                        value={String(strategyConfig.smc.emitDebugFields)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, emitDebugFields: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="true">true</MenuItem>
                        <MenuItem value="false">false</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="store-levels">Store intermediate levels</InputLabel>
                      <Select
                        labelId="store-levels"
                        label="Store intermediate levels"
                        value={String(strategyConfig.smc.storeIntermediateLevels)}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          smc: { ...prev.smc, storeIntermediateLevels: event.target.value === 'true' }
                        }))}
                      >
                        <MenuItem value="true">true</MenuItem>
                        <MenuItem value="false">false</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" onClick={() => void handleSaveStrategy()} disabled={saveStrategyBusy || !datasetInfo?.datasets?.length}>
                    Save Strategy Config
                  </Button>
                  <Button variant="outlined" onClick={() => setStep(2)} disabled={!strategyConfigId}>
                    Continue
                  </Button>
                </Stack>
              </>
            )}
            {step === 2 && (
              <>
                {executionDataset ? (
                  <Alert severity="info">
                    {`Execution TF ${requestedExecutionTf} uses canonical dataset TF ${executionDataset.timeframe} | Range ${executionDataset.minTimeUtc} → ${executionDataset.maxTimeUtc} | Candles ${executionDataset.candleCount} | Status ${executionDataset.status} | Runnable ${executionDataset.runnable ? 'YES' : 'NO'}`}
                  </Alert>
                ) : (
                  <Alert severity="warning">
                    {`No dataset available for execution timeframe ${requestedExecutionTf}.`}
                  </Alert>
                )}
                {executionDataset?.status === 'WARN' && executionDataset.runnable ? (
                  <Alert severity="warning">
                    Dataset has warnings (gaps/duplicates/normalization), but it is runnable. You can run backtest anyway.
                  </Alert>
                ) : null}
                {executionDataset && (datasetWarningIssues.length > 0 || datasetFatalIssues.length > 0) ? (
                  <Stack spacing={1}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setShowDatasetWarnings((prev) => !prev)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {showDatasetWarnings ? 'Hide warnings' : 'View warnings'}
                    </Button>
                    <Collapse in={showDatasetWarnings}>
                      <Stack spacing={0.8} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.2 }}>
                        {datasetWarningIssues.map((issue) => (
                          <Typography key={`warn-${issue.code}-${issue.message}`} variant="body2" color="warning.dark">
                            {`${issue.code}: ${issue.message}`}
                          </Typography>
                        ))}
                        {datasetFatalIssues.map((issue) => (
                          <Typography key={`fatal-${issue.code}-${issue.message}`} variant="body2" color="error.main">
                            {`${issue.code}: ${issue.message}`}
                          </Typography>
                        ))}
                      </Stack>
                    </Collapse>
                  </Stack>
                ) : null}
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      type="date"
                      fullWidth
                      label="From"
                      InputLabelProps={{ shrink: true }}
                      value={runWindow.fromUtc}
                      inputProps={{ min: rangeBounds.min, max: rangeBounds.max }}
                      onChange={(event) => setRunWindow((prev) => ({ ...prev, fromUtc: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      type="date"
                      fullWidth
                      label="To"
                      InputLabelProps={{ shrink: true }}
                      value={runWindow.toUtc}
                      inputProps={{ min: rangeBounds.min, max: rangeBounds.max }}
                      onChange={(event) => setRunWindow((prev) => ({ ...prev, toUtc: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="session-filter">Session filter</InputLabel>
                      <Select
                        labelId="session-filter"
                        label="Session filter"
                        value={runWindow.sessionFilter}
                        onChange={(event) => setRunWindow((prev) => ({ ...prev, sessionFilter: event.target.value }))}
                      >
                        <MenuItem value="">ALL</MenuItem>
                        {strategyConfig.sessions.map((session) => (
                          <MenuItem key={session.name} value={session.name}>{session.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {!runWindowValid && rangeBounds.min && rangeBounds.max ? (
                  <Alert severity="warning">
                    {`Select a valid range between ${rangeBounds.min} and ${rangeBounds.max}.`}
                  </Alert>
                ) : null}
                {!executionDataset?.runnable && datasetFatalIssues.length > 0 ? (
                  <Alert severity="error">
                    {datasetFatalIssues[0].message}
                  </Alert>
                ) : null}
                {!canRunBacktest && runBlockedReason ? (
                  <Alert severity="warning">{runBlockedReason}</Alert>
                ) : null}

                {lastRun ? (
                  <Alert severity={lastRun.status === 'FAILED' ? 'error' : 'info'}>
                    {`Dataset range: ${lastRun.datasetMinUtc || '-'} → ${lastRun.datasetMaxUtc || '-'} | Effective: ${lastRun.effectiveFromUtc || lastRun.fromUtc} → ${lastRun.effectiveToUtc || lastRun.toUtc} | Candles: ${lastRun.candleCountInRange ?? '-'} / min ${lastRun.minRequiredCandles ?? '-'}`}
                  </Alert>
                ) : null}

                {lastRun?.warnings && lastRun.warnings.length > 0 ? (
                  <Alert severity="warning">{lastRun.warnings.join(' ')}</Alert>
                ) : null}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="outlined" onClick={() => void handleSaveStrategy()} disabled={saveStrategyBusy || !datasetInfo?.datasets?.length}>
                    Save Config
                  </Button>
                  <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => void handleRun()} disabled={!canRunBacktest}>
                    Regenerate Backtest
                  </Button>
                  <Button variant="outlined" startIcon={<DescriptionRoundedIcon />} onClick={() => void handleGenerateReport()} disabled={!lastRun?.runId}>
                    Generate Diagnostics Report
                  </Button>
                  <Button component={Link} to="/diagnostics" variant="outlined">
                    Open Diagnostics
                  </Button>
                  <Button variant="outlined" onClick={() => setStep(3)} disabled={!results}>
                    Open results
                  </Button>
                  {lastRun ? <Chip size="small" label={`Status: ${lastRun.status}`} /> : null}
                  <Chip size="small" variant="outlined" label={`Run state: ${runLifecycleState}`} />
                </Stack>
              </>
            )}

            {step === 3 && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="outlined" onClick={() => setStep(2)}>
                    Back to Run Setup
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrowRoundedIcon />}
                    onClick={() => void handleRun()}
                    disabled={!canRunBacktest}
                  >
                    Regenerate Backtest
                  </Button>
                  <Button component={Link} to="/diagnostics" variant="outlined">
                    Open Diagnostics
                  </Button>
                  {lastRun ? <Chip size="small" label={`Status: ${lastRun.status}`} /> : null}
                  <Chip size="small" variant="outlined" label={`Run state: ${runLifecycleState}`} />
                </Stack>
                {!results ? (
                  <Alert severity="info">Run a backtest first to view results and report.</Alert>
                ) : (
                  <>
                    <Grid container spacing={1}>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Sample</Typography><Typography variant="h6">{results.summary.sampleSize}</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Win rate</Typography><Typography variant="h6">{results.summary.winRate?.toFixed(2)}%</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Expectancy</Typography><Typography variant="h6">{results.summary.expectancyR?.toFixed(2)}R</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Avg MAE/MFE</Typography><Typography variant="h6">{results.summary.avgMaeR?.toFixed(2)} / {results.summary.avgMfeR?.toFixed(2)}</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Fill rate</Typography><Typography variant="h6">{results.summary.fillRate?.toFixed(2)}%</Typography></CardContent></Card></Grid>
                    </Grid>

                    <Typography variant="subtitle2">Trades</Typography>
                    <Typography variant="caption" color="text.secondary">All timestamps are displayed in UTC (ISO Z).</Typography>
                    <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Time</TableCell>
                            <TableCell>Session</TableCell>
                            <TableCell>Direction</TableCell>
                            <TableCell>Result</TableCell>
                            <TableCell>R</TableCell>
                            <TableCell>Fill</TableCell>
                            <TableCell align="right">Detail</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {results.trades.map((trade) => (
                            <TableRow key={trade.tradeId}>
                              <TableCell>{trade.entryTime ? formatUtcTimestamp(trade.entryTime) : '-'}</TableCell>
                              <TableCell>{trade.sessionName || '-'}</TableCell>
                              <TableCell>{trade.direction || '-'}</TableCell>
                              <TableCell>{trade.exitReason || '-'}</TableCell>
                              <TableCell>{trade.rMultiple != null ? trade.rMultiple.toFixed(2) : '-'}</TableCell>
                              <TableCell>{trade.fillStatus}</TableCell>
                              <TableCell align="right">
                                <Button size="small" onClick={() => setSelectedTrade(trade)}>Timeline</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!results.trades.length && (
                            <TableRow>
                              <TableCell colSpan={7}>No trades for selected settings/date range.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Divider />
                    <Typography variant="subtitle2">Optimizer</Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          size="small"
                          type="number"
                          fullWidth
                          label="Max variants"
                          value={optimizerState.maxVariants}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, maxVariants: Number(event.target.value) }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          size="small"
                          fullWidth
                          label="MSS candles"
                          value={optimizerState.mssMinConfirmCandles}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, mssMinConfirmCandles: event.target.value }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Displacement types"
                          value={optimizerState.displacementType}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, displacementType: event.target.value }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Retrace required"
                          value={optimizerState.retraceRequired}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, retraceRequired: event.target.value }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Retrace %"
                          value={optimizerState.retraceMinPct}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, retraceMinPct: event.target.value }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={1}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Sweep pips"
                          value={optimizerState.sweepMinDepthPips}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, sweepMinDepthPips: event.target.value }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Confirmation TFs"
                          value={optimizerState.confirmationTf}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, confirmationTf: event.target.value }))}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Entry TFs"
                          value={optimizerState.entryTf}
                          onChange={(event) => setOptimizerState((prev) => ({ ...prev, entryTf: event.target.value }))}
                        />
                      </Grid>
                    </Grid>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="outlined" onClick={() => void handleRunOptimizer()} disabled={optimizerBusy || runBusy || !canRunBacktest}>
                        Run Optimizer
                      </Button>
                      <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel id="optimizer-sort">Sort variants</InputLabel>
                        <Select
                          labelId="optimizer-sort"
                          label="Sort variants"
                          value={optimizerSortBy}
                          onChange={(event) => setOptimizerSortBy(event.target.value as typeof optimizerSortBy)}
                        >
                          <MenuItem value="rank">rank</MenuItem>
                          <MenuItem value="expectancyR">expectancyR</MenuItem>
                          <MenuItem value="winRate">winRate</MenuItem>
                          <MenuItem value="profitFactor">profitFactor</MenuItem>
                          <MenuItem value="maxDdR">maxDdR (asc)</MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                    {optimizerResults ? (
                      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Rank</TableCell>
                              <TableCell>Trades</TableCell>
                              <TableCell>Win rate</TableCell>
                              <TableCell>PF</TableCell>
                              <TableCell>Expectancy</TableCell>
                              <TableCell>Avg R</TableCell>
                              <TableCell>MaxDD</TableCell>
                              <TableCell>Fill rate</TableCell>
                              <TableCell>Avg MAE/MFE</TableCell>
                              <TableCell>Avg duration(s)</TableCell>
                              <TableCell>Confidence</TableCell>
                              <TableCell>Params</TableCell>
                              <TableCell align="right">Apply</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sortedOptimizerVariants.map((row, index) => (
                              <TableRow key={`${row.rank}-${index}`}>
                                <TableCell>{row.rank}</TableCell>
                                <TableCell>{row.trades ?? '-'}</TableCell>
                                <TableCell>{row.winRate != null ? row.winRate.toFixed(2) : '-'}</TableCell>
                                <TableCell>{row.profitFactor != null ? row.profitFactor.toFixed(2) : '-'}</TableCell>
                                <TableCell>{row.expectancyR != null ? row.expectancyR.toFixed(3) : '-'}</TableCell>
                                <TableCell>{row.avgR != null ? row.avgR.toFixed(3) : '-'}</TableCell>
                                <TableCell>{row.maxDdR != null ? row.maxDdR.toFixed(3) : '-'}</TableCell>
                                <TableCell>{row.fillRate != null ? row.fillRate.toFixed(2) : '-'}</TableCell>
                                <TableCell>{row.avgMaeR != null || row.avgMfeR != null ? `${row.avgMaeR?.toFixed(3) || '-'} / ${row.avgMfeR?.toFixed(3) || '-'}` : '-'}</TableCell>
                                <TableCell>{row.avgDurationSec != null ? row.avgDurationSec.toFixed(1) : '-'}</TableCell>
                                <TableCell>{row.confidenceNote || '-'}</TableCell>
                                <TableCell sx={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(row.params)}</TableCell>
                                <TableCell align="right">
                                  <Button size="small" onClick={() => handleApplyVariant(row.params)}>
                                    Apply
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {!sortedOptimizerVariants.length ? (
                              <TableRow>
                                <TableCell colSpan={13}>No optimizer variants yet.</TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Run optimizer to compare MSS/displacement/retrace/sweep parameter variants.
                      </Typography>
                    )}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="contained" startIcon={<DescriptionRoundedIcon />} onClick={() => void handleGenerateReport()}>
                        Generate Diagnostics Report
                      </Button>
                      <Button component={Link} to="/diagnostics" variant="outlined">
                        Open Diagnostics
                      </Button>
                    </Stack>

                    {report ? (
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                        <Typography variant="subtitle2" gutterBottom>{report.strategyNameSnapshot} • Report</Typography>
                        <MarkdownContent content={report.reportMarkdown} />
                      </Box>
                    ) : (
                      <Alert severity="info">No report snapshot found yet.</Alert>
                    )}
                  </>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Drawer anchor={isMobile ? 'bottom' : 'right'} open={Boolean(selectedTrade)} onClose={() => setSelectedTrade(null)}>
        <Box sx={{ width: isMobile ? '100vw' : 460, p: 2 }}>
          {selectedTrade && (
            <Stack spacing={1}>
              <Typography variant="h6">Trade Timeline</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedTrade.direction} • {selectedTrade.sessionName || 'N/A'} • {selectedTrade.exitReason || 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">UTC-only timeline</Typography>
              <Divider />
              {(selectedTrade.timeline || []).map((event, index) => (
                <Card key={`${event.stage}-${event.timeUtc || index}`} variant="outlined">
                  <CardContent>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">{event.stage}</Typography>
                      <Typography variant="caption" color="text.secondary">{event.timeUtc ? formatUtcTimestamp(event.timeUtc) : 'N/A'}</Typography>
                      {event.stage === 'SWEEP' ? (
                        <>
                          <Typography variant="body2">Pool type: {String(event.details?.poolType || '-')}</Typography>
                          <Typography variant="body2">Pool level: {String(event.details?.poolLevel || '-')}</Typography>
                          <Typography variant="body2">Sweep extreme: {String(event.details?.sweepExtremePrice || '-')}</Typography>
                          <Typography variant="body2">Sweep extreme time: {String(event.details?.sweepExtremeTime || event.timeUtc || '-')}</Typography>
                          {event.details?.firstBreachTime ? (
                            <Typography variant="body2">First breach: {String(event.details.firstBreachTime)}</Typography>
                          ) : null}
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {JSON.stringify(event.details || {}, null, 2)}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Stack>
  )
}

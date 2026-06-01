import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AssetUploadDropzone from '../components/assets/AssetUploadDropzone'
import SecureAssetImage from '../components/assets/SecureAssetImage'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import {
  archiveBacktestingWorkspace,
  BacktestingBreakdownRow,
  BacktestingEdgeLens,
  BacktestingEdgeLensPayload,
  BacktestingMetric,
  BacktestingScreenshot,
  BacktestingScreenshotPayload,
  BacktestingScreenshotResult,
  BacktestingTrade,
  BacktestingTradeDirection,
  BacktestingTradePayload,
  BacktestingTradeResult,
  BacktestingWorkspace,
  BacktestingWorkspacePayload,
  createBacktestingEdgeLens,
  createBacktestingTrade,
  createBacktestingWorkspace,
  deleteBacktestingEdgeLens,
  deleteBacktestingScreenshot,
  deleteBacktestingTrade,
  detachBacktestingScreenshotTrade,
  getBacktestingWorkspace,
  importBacktestingTrades,
  listBacktestingEdgeLenses,
  listBacktestingScreenshots,
  listBacktestingTrades,
  listBacktestingWorkspaces,
  updateBacktestingEdgeLens,
  updateBacktestingScreenshot,
  updateBacktestingTrade,
  updateBacktestingWorkspace,
  uploadBacktestingScreenshots
} from '../api/backtesting'
import { ApiError } from '../api/client'
import { listStrategies, StrategyResponse } from '../api/strategies'

type WorkspaceDraft = BacktestingWorkspacePayload
type TabKey = 'overview' | 'trades' | 'edge' | 'impact' | 'evidence'
type FilterState = {
  dateFrom: string
  dateTo: string
  instrument: string
  direction: '' | BacktestingTradeDirection
  session: string
  setup: string
  result: '' | BacktestingTradeResult
  timeFrom: string
  timeTo: string
  weekday: string
  contextTimeframe: string
  executionTimeframe: string
  entryTimeframe: string
  tag: string
  hasScreenshots: '' | 'YES' | 'NO'
}

const emptyDraft: WorkspaceDraft = {
  symbol: '',
  marketType: '',
  strategyId: null,
  strategyNameSnapshot: '',
  title: '',
  primaryTimeframe: '',
  contextTimeframe: '',
  executionTimeframe: '',
  entryTimeframe: '',
  numberOfTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  breakevenTrades: 0,
  averageR: null,
  notes: '',
  whatWorked: '',
  whatFailed: '',
  bestConditions: '',
  avoidConditions: ''
}

const emptyFilters: FilterState = {
  dateFrom: '',
  dateTo: '',
  instrument: '',
  direction: '',
  session: '',
  setup: '',
  result: '',
  timeFrom: '',
  timeTo: '',
  weekday: '',
  contextTimeframe: '',
  executionTimeframe: '',
  entryTimeframe: '',
  tag: '',
  hasScreenshots: ''
}

const emptyTradeDraft: BacktestingTradePayload = {
  date: new Date().toISOString().slice(0, 10),
  entryTime: '09:30',
  instrument: '',
  direction: 'LONG',
  session: 'London',
  setupName: '',
  strategyId: null,
  riskPercent: null,
  plannedRR: null,
  result: 'WIN',
  pnlR: 1,
  contextTimeframe: '',
  executionTimeframe: '',
  entryTimeframe: '',
  tags: [],
  notes: '',
  source: 'MANUAL',
  tradeScope: 'BACKTEST'
}

const resultOptions: Array<{ value: BacktestingScreenshotResult; label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }> = [
  { value: 'WIN', label: 'WIN', color: 'success' },
  { value: 'LOSS', label: 'LOSS', color: 'error' },
  { value: 'BREAKEVEN', label: 'BE', color: 'warning' },
  { value: 'MISSED', label: 'MISSED', color: 'info' },
  { value: 'INVALID', label: 'INVALID', color: 'default' },
  { value: 'GOOD_EXAMPLE', label: 'GOOD EXAMPLE', color: 'success' },
  { value: 'BAD_EXAMPLE', label: 'BAD EXAMPLE', color: 'error' }
]

const tradeResults: BacktestingTradeResult[] = ['WIN', 'LOSS', 'BREAKEVEN']
const sessionOptions = ['Asia', 'London', 'NY AM', 'NY PM', 'NY', 'Custom']
const timeframeOptions = ['15M', '5M', '1M', '30M', '1H', '4H', 'Daily']
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const workspaceToDraft = (workspace: BacktestingWorkspace): WorkspaceDraft => ({
  symbol: workspace.symbol || '',
  marketType: workspace.marketType || '',
  strategyId: workspace.strategyId || null,
  strategyNameSnapshot: workspace.strategyNameSnapshot || (workspace.strategyId ? '' : workspace.strategyName || ''),
  title: workspace.title || '',
  primaryTimeframe: workspace.primaryTimeframe || '',
  contextTimeframe: workspace.contextTimeframe || '',
  executionTimeframe: workspace.executionTimeframe || '',
  entryTimeframe: workspace.entryTimeframe || '',
  numberOfTrades: workspace.numberOfTrades || 0,
  winningTrades: workspace.winningTrades || 0,
  losingTrades: workspace.losingTrades || 0,
  breakevenTrades: workspace.breakevenTrades || 0,
  averageR: workspace.averageR ?? null,
  notes: workspace.notes || '',
  whatWorked: workspace.whatWorked || '',
  whatFailed: workspace.whatFailed || '',
  bestConditions: workspace.bestConditions || '',
  avoidConditions: workspace.avoidConditions || ''
})

const splitTags = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const joinTags = (values?: string[]) => (values || []).join(', ')
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const round = (value: number) => Number(value.toFixed(2))
const pct = (value?: number | null) => `${round(num(value))}%`
const rValue = (value?: number | null) => value === null || value === undefined ? '-' : `${round(value)}R`

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

const deriveWeekday = (date: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${date}T12:00:00`))

export default function BacktestingPage() {
  const queryClient = useQueryClient()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [selectedLensId, setSelectedLensId] = useState('')
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<BacktestingWorkspace | null>(null)
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceDraft>(emptyDraft)
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState<BacktestingTrade | null>(null)
  const [tradeDraft, setTradeDraft] = useState<BacktestingTradePayload>(emptyTradeDraft)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null)
  const [evidenceMode, setEvidenceMode] = useState<'carousel' | 'grid'>('grid')
  const [selectedBucket, setSelectedBucket] = useState<BacktestingBreakdownRow | null>(null)

  const workspacesQuery = useQuery({ queryKey: ['backtestingWorkspaces'], queryFn: listBacktestingWorkspaces })
  const strategiesQuery = useQuery({ queryKey: ['strategies', 'backtesting'], queryFn: () => listStrategies({ includeArchived: false }) })

  const selectedWorkspace = workspacesQuery.data?.workspaces.find((item) => item.id === selectedWorkspaceId)
    || workspacesQuery.data?.workspaces[0]
    || null

  useEffect(() => {
    if (!selectedWorkspaceId && workspacesQuery.data?.workspaces[0]) setSelectedWorkspaceId(workspacesQuery.data.workspaces[0].id)
  }, [selectedWorkspaceId, workspacesQuery.data?.workspaces])

  const workspaceDetailQuery = useQuery({
    queryKey: ['backtestingWorkspace', selectedWorkspace?.id],
    queryFn: () => getBacktestingWorkspace(selectedWorkspace!.id),
    enabled: Boolean(selectedWorkspace?.id)
  })
  const detail = workspaceDetailQuery.data || selectedWorkspace

  const tradesQuery = useQuery({
    queryKey: ['backtestingTrades', detail?.id],
    queryFn: () => listBacktestingTrades(detail!.id),
    enabled: Boolean(detail?.id)
  })

  const screenshotsQuery = useQuery({
    queryKey: ['backtestingScreenshots', detail?.id],
    queryFn: () => listBacktestingScreenshots(detail!.id),
    enabled: Boolean(detail?.id)
  })

  const lensesQuery = useQuery({
    queryKey: ['backtestingEdgeLenses', detail?.id],
    queryFn: () => listBacktestingEdgeLenses(detail!.id),
    enabled: Boolean(detail?.id)
  })

  const createWorkspaceMutation = useMutation({
    mutationFn: createBacktestingWorkspace,
    onSuccess: async (created) => {
      setSelectedWorkspaceId(created.id)
      setWorkspaceDialogOpen(false)
      setFeedback('Backtest workspace created.')
      await invalidateWorkspace(created.id)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not create backtest workspace.')
  })

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BacktestingWorkspacePayload }) => updateBacktestingWorkspace(id, payload),
    onSuccess: async (updated) => {
      setWorkspaceDialogOpen(false)
      setEditingWorkspace(null)
      setFeedback('Backtest workspace updated.')
      await invalidateWorkspace(updated.id)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not update backtest workspace.')
  })

  const archiveMutation = useMutation({
    mutationFn: archiveBacktestingWorkspace,
    onSuccess: async (_, id) => {
      if (selectedWorkspaceId === id) setSelectedWorkspaceId(null)
      setFeedback('Backtest archived.')
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] })
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not archive backtest.')
  })

  const tradeMutation = useMutation({
    mutationFn: ({ id, workspaceId, payload }: { id?: string; workspaceId: string; payload: BacktestingTradePayload }) => (
      id ? updateBacktestingTrade(id, payload) : createBacktestingTrade(workspaceId, payload)
    ),
    onSuccess: async (trade) => {
      setTradeDialogOpen(false)
      setEditingTrade(null)
      setFeedback('Trade saved.')
      await invalidateWorkspace(trade.workspaceId)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not save trade.')
  })

  const deleteTradeMutation = useMutation({
    mutationFn: deleteBacktestingTrade,
    onSuccess: async () => {
      setFeedback('Trade deleted.')
      if (detail?.id) await invalidateWorkspace(detail.id)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not delete trade.')
  })

  const uploadMutation = useMutation({
    mutationFn: ({ workspaceId, files }: { workspaceId: string; files: File[] }) => uploadBacktestingScreenshots(workspaceId, files),
    onSuccess: async (_, variables) => {
      setFeedback('Screenshots uploaded.')
      await invalidateWorkspace(variables.workspaceId)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not upload screenshots.')
  })

  const importMutation = useMutation({
    mutationFn: ({ workspaceId, file }: { workspaceId: string; file: File }) => importBacktestingTrades(workspaceId, file),
    onSuccess: async (result, variables) => {
      setFeedback(`Imported ${result.imported} trades${result.invalid ? `, ${result.invalid} invalid rows skipped` : ''}.`)
      setImportDialogOpen(false)
      await invalidateWorkspace(variables.workspaceId)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not import trades.')
  })

  const screenshotUpdateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BacktestingScreenshotPayload }) => updateBacktestingScreenshot(id, payload),
    onSuccess: async (updated) => {
      setFeedback('Screenshot updated.')
      await invalidateWorkspace(updated.workspaceId)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not update screenshot.')
  })

  const screenshotDeleteMutation = useMutation({
    mutationFn: deleteBacktestingScreenshot,
    onSuccess: async () => {
      setCarouselIndex(null)
      setFeedback('Screenshot deleted.')
      if (detail?.id) await invalidateWorkspace(detail.id)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not delete screenshot.')
  })

  const screenshotDetachMutation = useMutation({
    mutationFn: detachBacktestingScreenshotTrade,
    onSuccess: async (updated) => {
      setFeedback('Screenshot unlinked.')
      await invalidateWorkspace(updated.workspaceId)
    }
  })

  const lensMutation = useMutation({
    mutationFn: ({ id, workspaceId, payload }: { id?: string; workspaceId: string; payload: BacktestingEdgeLensPayload }) => (
      id ? updateBacktestingEdgeLens(id, payload) : createBacktestingEdgeLens(workspaceId, payload)
    ),
    onSuccess: async (lens) => {
      setFeedback('Edge Lens saved.')
      await invalidateWorkspace(lens.workspaceId)
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not save Edge Lens.')
  })

  const deleteLensMutation = useMutation({
    mutationFn: deleteBacktestingEdgeLens,
    onSuccess: async () => {
      setFeedback('Edge Lens deleted.')
      if (detail?.id) await invalidateWorkspace(detail.id)
    }
  })

  const invalidateWorkspace = async (workspaceId: string) => {
    await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] })
    await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspace', workspaceId] })
    await queryClient.invalidateQueries({ queryKey: ['backtestingTrades', workspaceId] })
    await queryClient.invalidateQueries({ queryKey: ['backtestingScreenshots', workspaceId] })
    await queryClient.invalidateQueries({ queryKey: ['backtestingEdgeLenses', workspaceId] })
  }

  const trades = tradesQuery.data || []
  const screenshots = screenshotsQuery.data || []
  const lenses = lensesQuery.data || []
  const screenshotTradeIds = useMemo(() => new Set(screenshots.map((item) => item.backtestingTradeId).filter(Boolean) as string[]), [screenshots])
  const filteredTrades = useMemo(() => applyFilters(trades, filters, screenshotTradeIds), [filters, screenshotTradeIds, trades])
  const visibleScreenshots = useMemo(() => filterScreenshots(screenshots, filteredTrades, filters), [filteredTrades, filters, screenshots])
  const baselineMetrics = useMemo(() => computeMetrics(trades), [trades])
  const filteredMetrics = useMemo(() => computeMetrics(filteredTrades), [filteredTrades])
  const breakdowns = useMemo(() => buildBreakdowns(filteredTrades, baselineMetrics), [baselineMetrics, filteredTrades])
  const impactRows = useMemo(() => buildImpactRows(trades, baselineMetrics), [baselineMetrics, trades])

  const myStrategies = strategiesQuery.data?.myStrategies || []
  const selectedStrategy = myStrategies.find((item) => item.id === workspaceDraft.strategyId) || null
  const filteredWorkspaces = useMemo(() => {
    const term = workspaceSearch.trim().toLowerCase()
    return (workspacesQuery.data?.workspaces || []).filter((workspace) => !term || [
      workspace.symbol,
      workspace.strategyName,
      workspace.strategyNameSnapshot,
      workspace.marketType,
      workspace.bestEdgeLensName
    ].some((value) => (value || '').toLowerCase().includes(term)))
  }, [workspaceSearch, workspacesQuery.data?.workspaces])

  const openWorkspaceCreate = () => {
    setEditingWorkspace(null)
    setWorkspaceDraft(emptyDraft)
    setWorkspaceDialogOpen(true)
  }

  const openWorkspaceEdit = (workspace: BacktestingWorkspace) => {
    setEditingWorkspace(workspace)
    setWorkspaceDraft(workspaceToDraft(workspace))
    setWorkspaceDialogOpen(true)
  }

  const openTradeCreate = () => {
    setEditingTrade(null)
    setTradeDraft({
      ...emptyTradeDraft,
      instrument: detail?.symbol || '',
      contextTimeframe: detail?.contextTimeframe || '',
      executionTimeframe: detail?.executionTimeframe || '',
      entryTimeframe: detail?.entryTimeframe || '',
      strategyId: detail?.strategyId || null
    })
    setTradeDialogOpen(true)
  }

  const openTradeEdit = (trade: BacktestingTrade) => {
    setEditingTrade(trade)
    setTradeDraft({
      date: trade.date,
      entryTime: trade.entryTime?.slice(0, 5) || '',
      instrument: trade.instrument,
      direction: trade.direction,
      session: trade.session || '',
      setupName: trade.setupName || '',
      strategyId: trade.strategyId || null,
      riskPercent: trade.riskPercent ?? null,
      plannedRR: trade.plannedRR ?? null,
      result: trade.result,
      pnlR: trade.pnlR,
      contextTimeframe: trade.contextTimeframe || '',
      executionTimeframe: trade.executionTimeframe || '',
      entryTimeframe: trade.entryTimeframe || '',
      tags: trade.tags || [],
      notes: trade.notes || '',
      source: trade.source || 'MANUAL',
      tradeScope: trade.tradeScope || 'BACKTEST'
    })
    setTradeDialogOpen(true)
  }

  const saveWorkspace = () => {
    const payload = normalizeWorkspacePayload(workspaceDraft)
    if (!payload.symbol?.trim()) {
      setError('Symbol is required.')
      return
    }
    if ((payload.winningTrades || 0) + (payload.losingTrades || 0) + (payload.breakevenTrades || 0) > (payload.numberOfTrades || 0)) {
      setError('Wins, losses, and BE cannot exceed total trades.')
      return
    }
    if (editingWorkspace) updateWorkspaceMutation.mutate({ id: editingWorkspace.id, payload })
    else createWorkspaceMutation.mutate(payload)
  }

  const saveTrade = () => {
    if (!detail) return
    if (!tradeDraft.date || !tradeDraft.entryTime || !tradeDraft.instrument || !tradeDraft.direction || !tradeDraft.result || tradeDraft.pnlR === null || tradeDraft.pnlR === undefined) {
      setError('Date, time, instrument, direction, result, and P&L(R) are required.')
      return
    }
    tradeMutation.mutate({
      id: editingTrade?.id,
      workspaceId: detail.id,
      payload: {
        ...tradeDraft,
        instrument: tradeDraft.instrument.toUpperCase(),
        entryTime: tradeDraft.entryTime.length === 5 ? `${tradeDraft.entryTime}:00` : tradeDraft.entryTime,
        pnlR: num(tradeDraft.pnlR),
        riskPercent: nullableNumber(tradeDraft.riskPercent),
        plannedRR: nullableNumber(tradeDraft.plannedRR)
      }
    })
  }

  const saveCurrentFiltersAsLens = () => {
    if (!detail) return
    const filterDefinition = compactFilters(filters)
    if (Object.keys(filterDefinition).length === 0) {
      setError('Apply at least one filter before saving an Edge Lens.')
      return
    }
    const name = window.prompt('Edge Lens name', lensName(filterDefinition))
    if (!name) return
    lensMutation.mutate({ workspaceId: detail.id, payload: { name, description: '', filterDefinition } })
  }

  const applyLens = (lensId: string) => {
    setSelectedLensId(lensId)
    const lens = lenses.find((item) => item.id === lensId)
    if (!lens) return
    setFilters((current) => ({ ...current, ...filtersFromDefinition(lens.filterDefinition) }))
  }

  const applyBucket = (row: BacktestingBreakdownRow) => {
    setSelectedBucket(row)
    setFilters((current) => ({ ...current, ...filtersFromDefinition(row.filters) }))
  }

  const exportCsv = () => {
    const header = ['Date', 'Weekday', 'Time', 'Instrument', 'Direction', 'Session', 'Setup', 'Risk %', 'Planned R:R', 'Result', 'P&L(R)', 'Context TF', 'Execution TF', 'Entry TF', 'Tags', 'Notes']
    const rows = filteredTrades.map((trade) => [
      trade.date,
      trade.weekday || deriveWeekday(trade.date),
      trade.entryTime,
      trade.instrument,
      trade.direction,
      trade.session || '',
      trade.setupName || '',
      trade.riskPercent ?? '',
      trade.plannedRR ?? '',
      trade.result,
      trade.pnlR,
      trade.contextTimeframe || '',
      trade.executionTimeframe || '',
      trade.entryTimeframe || '',
      (trade.tags || []).join('|'),
      trade.notes || ''
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${detail?.symbol || 'backtest'}-trades.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const summary = workspacesQuery.data?.summary

  return (
    <Stack spacing={2.25} sx={{ width: '100%', minWidth: 0, overflowX: 'clip' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Structured backtesting research with trade rows, dynamic edge analysis, and screenshot evidence.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openWorkspaceCreate}>New backtest</Button>
          <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={!detail} onClick={() => setImportDialogOpen(true)}>Import trades</Button>
          <Button variant="outlined" startIcon={<PhotoLibraryRoundedIcon />} disabled={!detail} onClick={() => document.getElementById('backtesting-upload-input')?.click()}>Upload screenshots</Button>
        </Stack>
      </Stack>

      {(feedback || error) && (
        <Alert severity={error ? 'error' : 'success'} onClose={() => { setFeedback(''); setError('') }}>
          {error || feedback}
        </Alert>
      )}

      <Grid container spacing={1.25}>
        {[
          { label: 'Total backtests', value: summary?.totalBacktests ?? 0 },
          { label: 'Screenshots', value: summary?.totalScreenshots ?? 0 },
          { label: 'Trades tested', value: summary?.totalTradesTested ?? 0 },
          { label: 'Average win rate', value: pct(summary?.averageWinRate) },
          { label: 'Best performer', value: summary?.bestPerformer || '-' }
        ].map((item) => (
          <Grid key={item.label} item xs={6} md={item.label === 'Best performer' ? 4 : 2}>
            <Paper variant="outlined" sx={{ p: 1.25, height: '100%', borderRadius: 1.5 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 850, wordBreak: 'break-word' }}>{item.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} lg={3.5}>
          <WorkspaceList
            workspaces={filteredWorkspaces}
            loading={workspacesQuery.isLoading}
            selectedId={detail?.id || ''}
            search={workspaceSearch}
            setSearch={setWorkspaceSearch}
            onOpen={(workspace) => { setSelectedWorkspaceId(workspace.id); setActiveTab('overview') }}
            onEdit={openWorkspaceEdit}
            onArchive={(workspace) => {
              if (window.confirm('Archive this backtest? Existing screenshots and research data remain stored.')) archiveMutation.mutate(workspace.id)
            }}
            onCreate={openWorkspaceCreate}
            onImport={(workspace) => { setSelectedWorkspaceId(workspace.id); setImportDialogOpen(true) }}
          />
        </Grid>
        <Grid item xs={12} lg={8.5}>
          {!detail ? (
            <EmptyState
              title="Create a backtesting research workspace"
              description="Start with a symbol and strategy, then add structured trades and screenshot evidence."
              icon={<PhotoLibraryRoundedIcon />}
              action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openWorkspaceCreate}>New backtest</Button>}
            />
          ) : (
            <Stack spacing={1.5}>
              <WorkspaceHeader workspace={detail} metrics={filteredMetrics} onEdit={() => openWorkspaceEdit(detail)} onArchive={() => archiveMutation.mutate(detail.id)} />
              <BacktestFilterBar
                filters={filters}
                setFilters={setFilters}
                lenses={lenses}
                selectedLensId={selectedLensId}
                onApplyLens={applyLens}
                onClearLens={() => setSelectedLensId('')}
                onClear={() => { setFilters(emptyFilters); setSelectedLensId('') }}
                onSaveLens={saveCurrentFiltersAsLens}
              />
              <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
                <Tabs
                  value={activeTab}
                  onChange={(_, value) => setActiveTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Tab value="overview" label="Overview" />
                  <Tab value="trades" label="Trades" />
                  <Tab value="edge" label="Edge Lab" />
                  <Tab value="impact" label="Impact Analysis" />
                  <Tab value="evidence" label="Evidence & Notes" />
                </Tabs>
                <Box sx={{ p: { xs: 1.25, sm: 1.75 } }}>
                  {activeTab === 'overview' && (
                    <OverviewTab
                      workspace={detail}
                      trades={trades}
                      filteredTrades={filteredTrades}
                      metrics={filteredMetrics}
                      baselineMetrics={baselineMetrics}
                      screenshots={visibleScreenshots}
                      lenses={lenses}
                      impactRows={impactRows}
                      onOpenEvidence={() => setActiveTab('evidence')}
                      onOpenTrades={openTradeCreate}
                      onSaveNotes={(payload) => updateWorkspaceMutation.mutate({ id: detail.id, payload: normalizeWorkspacePayload({ ...workspaceToDraft(detail), ...payload }) })}
                      setCarouselIndex={setCarouselIndex}
                    />
                  )}
                  {activeTab === 'trades' && (
                    <TradesTab
                      trades={filteredTrades}
                      allTrades={trades}
                      onAdd={openTradeCreate}
                      onImport={() => setImportDialogOpen(true)}
                      onExport={exportCsv}
                      onEdit={openTradeEdit}
                      onDuplicate={(trade) => {
                        setEditingTrade(null)
                        setTradeDraft({ ...tradeToPayload(trade), date: trade.date, source: 'MANUAL' })
                        setTradeDialogOpen(true)
                      }}
                      onDelete={(trade) => deleteTradeMutation.mutate(trade.id)}
                    />
                  )}
                  {activeTab === 'edge' && (
                    <EdgeLabView
                      breakdowns={breakdowns}
                      selectedBucket={selectedBucket}
                      onApplyBucket={applyBucket}
                      screenshots={visibleScreenshots}
                      setCarouselIndex={setCarouselIndex}
                    />
                  )}
                  {activeTab === 'impact' && (
                    <ImpactAnalysisView
                      baseline={baselineMetrics}
                      filteredMetrics={filteredMetrics}
                      impactRows={impactRows}
                      activeFilters={filters}
                      onApplyBucket={applyBucket}
                      lenses={lenses}
                      onApplyLens={applyLens}
                      onDeleteLens={(lens) => deleteLensMutation.mutate(lens.id)}
                      onSaveLens={saveCurrentFiltersAsLens}
                    />
                  )}
                  {activeTab === 'evidence' && (
                    <EvidenceNotesTab
                      workspace={detail}
                      screenshots={visibleScreenshots}
                      allScreenshots={screenshots}
                      trades={trades}
                      mode={evidenceMode}
                      setMode={setEvidenceMode}
                      onUpload={(files) => uploadMutation.mutate({ workspaceId: detail.id, files })}
                      onSave={(screenshot, payload) => screenshotUpdateMutation.mutate({ id: screenshot.id, payload })}
                      onDelete={(screenshot) => screenshotDeleteMutation.mutate(screenshot.id)}
                      onDetach={(screenshot) => screenshotDetachMutation.mutate(screenshot.id)}
                      setCarouselIndex={setCarouselIndex}
                    />
                  )}
                </Box>
              </Paper>
            </Stack>
          )}
        </Grid>
      </Grid>

      <Box sx={{ display: 'none' }}>
        <input
          id="backtesting-upload-input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(event) => {
            if (detail) uploadMutation.mutate({ workspaceId: detail.id, files: Array.from(event.target.files || []) })
            event.target.value = ''
          }}
        />
      </Box>

      <WorkspaceDialog
        open={workspaceDialogOpen}
        draft={workspaceDraft}
        setDraft={setWorkspaceDraft}
        strategies={myStrategies}
        selectedStrategy={selectedStrategy}
        editing={Boolean(editingWorkspace)}
        saving={createWorkspaceMutation.isLoading || updateWorkspaceMutation.isLoading}
        error={error}
        onClose={() => setWorkspaceDialogOpen(false)}
        onSave={saveWorkspace}
      />

      <QuickAddBacktestTradeModal
        open={tradeDialogOpen}
        draft={tradeDraft}
        setDraft={setTradeDraft}
        editing={Boolean(editingTrade)}
        saving={tradeMutation.isLoading}
        screenshots={screenshots}
        onClose={() => setTradeDialogOpen(false)}
        onSave={saveTrade}
      />

      <ImportTradesModal
        open={importDialogOpen}
        importing={importMutation.isLoading}
        onClose={() => setImportDialogOpen(false)}
        onImport={(file) => detail && importMutation.mutate({ workspaceId: detail.id, file })}
      />

      <ScreenshotCarousel
        open={carouselIndex !== null}
        screenshots={visibleScreenshots}
        index={carouselIndex || 0}
        setIndex={setCarouselIndex}
        onClose={() => setCarouselIndex(null)}
        isMobile={isMobile}
      />
    </Stack>
  )
}

function WorkspaceList(props: {
  workspaces: BacktestingWorkspace[]
  loading: boolean
  selectedId: string
  search: string
  setSearch: (value: string) => void
  onOpen: (workspace: BacktestingWorkspace) => void
  onEdit: (workspace: BacktestingWorkspace) => void
  onArchive: (workspace: BacktestingWorkspace) => void
  onCreate: () => void
  onImport: (workspace: BacktestingWorkspace) => void
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Research workspaces</Typography>
          <FilterAltRoundedIcon fontSize="small" color="action" />
        </Stack>
        <TextField size="small" label="Symbol, strategy, lens" value={props.search} onChange={(event) => props.setSearch(event.target.value)} />
        {props.loading ? <LoadingState rows={3} height={96} /> : props.workspaces.length === 0 ? (
          <EmptyState title="No backtests yet" description="Create a workspace, then import or add trades." action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={props.onCreate}>New backtest</Button>} />
        ) : (
          <Stack spacing={1}>
            {props.workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                selected={workspace.id === props.selectedId}
                onOpen={() => props.onOpen(workspace)}
                onEdit={() => props.onEdit(workspace)}
                onArchive={() => props.onArchive(workspace)}
                onImport={() => props.onImport(workspace)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

function WorkspaceCard({ workspace, selected, onOpen, onEdit, onArchive, onImport }: {
  workspace: BacktestingWorkspace
  selected: boolean
  onOpen: () => void
  onEdit: () => void
  onArchive: () => void
  onImport: () => void
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onOpen}
      sx={{ p: 1.1, borderRadius: 1.25, cursor: 'pointer', borderColor: selected ? 'primary.main' : 'divider', bgcolor: selected ? 'action.selected' : 'background.paper' }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 850, wordBreak: 'break-word' }}>{workspace.symbol} · {workspace.strategyName || workspace.strategyNameSnapshot || 'Manual strategy'}</Typography>
            <Typography variant="caption" color="text.secondary">Updated {formatDate(workspace.updatedAt)}</Typography>
          </Box>
          <SampleSizeBadge label={workspace.sampleQuality || sampleQuality(workspace.numberOfTrades || 0)} />
        </Stack>
        {workspace.bestEdgeLensName && <Chip size="small" color="primary" variant="outlined" label={`Best lens: ${workspace.bestEdgeLensName}`} />}
        <Grid container spacing={0.75}>
          {[
            ['Trades', workspace.numberOfTrades],
            ['WR', pct(workspace.winRate)],
            ['W/L/BE', `${workspace.winningTrades}/${workspace.losingTrades}/${workspace.breakevenTrades}`],
            ['Shots', workspace.screenshotCount],
            ['Total R', rValue(workspace.totalR)],
            ['Avg R', rValue(workspace.averageR)],
            ['Exp.', rValue(workspace.expectancy ?? workspace.averageR)]
          ].map(([label, value]) => (
            <Grid key={label} item xs={6}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{value}</Typography>
            </Grid>
          ))}
        </Grid>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {workspace.statsSource === 'LEGACY_MANUAL' && <Chip size="small" label="Legacy manual stats" variant="outlined" />}
          <Button size="small" variant={selected ? 'contained' : 'outlined'} onClick={(event) => { event.stopPropagation(); onOpen() }}>Open</Button>
          <Button size="small" startIcon={<UploadFileRoundedIcon />} onClick={(event) => { event.stopPropagation(); onImport() }}>Import</Button>
          <IconButton size="small" aria-label="Edit backtest" onClick={(event) => { event.stopPropagation(); onEdit() }}><EditRoundedIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Archive backtest" onClick={(event) => { event.stopPropagation(); onArchive() }}><ArchiveOutlinedIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    </Paper>
  )
}

function WorkspaceHeader({ workspace, metrics, onEdit, onArchive }: {
  workspace: BacktestingWorkspace
  metrics: BacktestingMetric
  onEdit: () => void
  onArchive: () => void
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, wordBreak: 'break-word' }}>{workspace.symbol} · {workspace.strategyName || workspace.strategyNameSnapshot || 'Manual strategy'}</Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip size="small" label={workspace.marketType || 'Market not set'} />
            <Chip size="small" label={`${metrics.trades} filtered trades`} color="primary" variant="outlined" />
            <SampleSizeBadge label={metrics.sampleQuality} />
            {workspace.statsSource === 'LEGACY_MANUAL' && <Chip size="small" label="Legacy fallback stats" color="warning" variant="outlined" />}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<EditRoundedIcon />} onClick={onEdit}>Edit</Button>
          <Button size="small" color="warning" startIcon={<ArchiveOutlinedIcon />} onClick={onArchive}>Archive</Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

function BacktestFilterBar({ filters, setFilters, lenses, selectedLensId, onApplyLens, onClearLens, onClear, onSaveLens }: {
  filters: FilterState
  setFilters: (value: FilterState | ((current: FilterState) => FilterState)) => void
  lenses: BacktestingEdgeLens[]
  selectedLensId: string
  onApplyLens: (id: string) => void
  onClearLens: () => void
  onClear: () => void
  onSaveLens: () => void
}) {
  const active = activeFilterChips(filters)
  const update = (field: keyof FilterState) => (event: ChangeEvent<HTMLInputElement>) => setFilters((current) => ({ ...current, [field]: event.target.value }))
  const updateSelect = (field: keyof FilterState, value: string) => setFilters((current) => ({ ...current, [field]: value }))
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
      <Stack spacing={1.25}>
        <Grid container spacing={1}>
          <Grid item xs={6} sm={3} md={1.7}><TextField fullWidth size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={filters.dateFrom} onChange={update('dateFrom')} /></Grid>
          <Grid item xs={6} sm={3} md={1.7}><TextField fullWidth size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={filters.dateTo} onChange={update('dateTo')} /></Grid>
          <Grid item xs={6} sm={3} md={1.7}><TextField fullWidth size="small" label="Instrument" value={filters.instrument} onChange={update('instrument')} /></Grid>
          <Grid item xs={6} sm={3} md={1.6}>
            <FormControl fullWidth size="small"><InputLabel>Direction</InputLabel><Select label="Direction" value={filters.direction} onChange={(event) => updateSelect('direction', event.target.value)}><MenuItem value="">All</MenuItem><MenuItem value="LONG">Long</MenuItem><MenuItem value="SHORT">Short</MenuItem></Select></FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={1.8}><TextField fullWidth size="small" label="Session" value={filters.session} onChange={update('session')} /></Grid>
          <Grid item xs={6} sm={3} md={1.8}><TextField fullWidth size="small" label="Setup" value={filters.setup} onChange={update('setup')} /></Grid>
          <Grid item xs={6} sm={3} md={1.7}>
            <FormControl fullWidth size="small"><InputLabel>Result</InputLabel><Select label="Result" value={filters.result} onChange={(event) => updateSelect('result', event.target.value)}><MenuItem value="">All</MenuItem>{tradeResults.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={1.7}><TextField fullWidth size="small" type="time" label="After" InputLabelProps={{ shrink: true }} value={filters.timeFrom} onChange={update('timeFrom')} /></Grid>
          <Grid item xs={6} sm={3} md={1.7}><TextField fullWidth size="small" type="time" label="Before" InputLabelProps={{ shrink: true }} value={filters.timeTo} onChange={update('timeTo')} /></Grid>
          <Grid item xs={6} sm={3} md={1.8}>
            <FormControl fullWidth size="small"><InputLabel>Weekday</InputLabel><Select label="Weekday" value={filters.weekday} onChange={(event) => updateSelect('weekday', event.target.value)}><MenuItem value="">All</MenuItem>{weekdays.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={1.5}><TextField fullWidth size="small" label="Context TF" value={filters.contextTimeframe} onChange={update('contextTimeframe')} /></Grid>
          <Grid item xs={6} sm={3} md={1.5}><TextField fullWidth size="small" label="Exec TF" value={filters.executionTimeframe} onChange={update('executionTimeframe')} /></Grid>
          <Grid item xs={6} sm={3} md={1.5}><TextField fullWidth size="small" label="Entry TF" value={filters.entryTimeframe} onChange={update('entryTimeframe')} /></Grid>
          <Grid item xs={6} sm={3} md={1.7}><TextField fullWidth size="small" label="Tag" value={filters.tag} onChange={update('tag')} /></Grid>
          <Grid item xs={6} sm={3} md={1.8}>
            <FormControl fullWidth size="small"><InputLabel>Screenshots</InputLabel><Select label="Screenshots" value={filters.hasScreenshots} onChange={(event) => updateSelect('hasScreenshots', event.target.value)}><MenuItem value="">All</MenuItem><MenuItem value="YES">Has screenshots</MenuItem><MenuItem value="NO">No screenshots</MenuItem></Select></FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2.6}>
            <FormControl fullWidth size="small">
              <InputLabel>Edge Lens</InputLabel>
              <Select label="Edge Lens" value={selectedLensId} onChange={(event) => event.target.value ? onApplyLens(event.target.value) : onClearLens()}>
                <MenuItem value="">None</MenuItem>
                {lenses.map((lens) => <MenuItem key={lens.id} value={lens.id}>{lens.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
          {active.map((chip) => (
            <Chip key={chip.key} size="small" label={chip.label} onDelete={() => setFilters((current) => ({ ...current, [chip.key]: '' }))} />
          ))}
          <Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={onClear}>Clear all filters</Button>
          <Button size="small" startIcon={<SaveRoundedIcon />} onClick={onSaveLens}>Save as Edge Lens</Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

function OverviewTab({ workspace, trades, filteredTrades, metrics, baselineMetrics, screenshots, lenses, impactRows, onOpenEvidence, onOpenTrades, onSaveNotes, setCarouselIndex }: {
  workspace: BacktestingWorkspace
  trades: BacktestingTrade[]
  filteredTrades: BacktestingTrade[]
  metrics: BacktestingMetric
  baselineMetrics: BacktestingMetric
  screenshots: BacktestingScreenshot[]
  lenses: BacktestingEdgeLens[]
  impactRows: BacktestingBreakdownRow[]
  onOpenEvidence: () => void
  onOpenTrades: () => void
  onSaveNotes: (payload: Partial<WorkspaceDraft>) => void
  setCarouselIndex: (index: number) => void
}) {
  const [notes, setNotes] = useState({ whatWorked: workspace.whatWorked || '', whatFailed: workspace.whatFailed || '', notes: workspace.notes || '' })
  useEffect(() => setNotes({ whatWorked: workspace.whatWorked || '', whatFailed: workspace.whatFailed || '', notes: workspace.notes || '' }), [workspace.id, workspace.updatedAt])
  const reliableRows = impactRows.filter((row) => row.metrics.trades >= 10)
  const best = reliableRows[0] || impactRows[0]
  const weakest = [...impactRows].reverse().find((row) => row.expectancyDelta < 0) || impactRows.at(-1)
  return (
    <Stack spacing={1.5}>
      {trades.length === 0 && (
        <Alert severity="warning">
          This workspace is using legacy manual stats until structured trades are added or imported.
        </Alert>
      )}
      <BacktestKpiCards metrics={metrics} baseline={baselineMetrics} />
      <Grid container spacing={1.5}>
        <Grid item xs={12} md={5}>
          <StrategySnapshot workspace={workspace} />
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25, height: '100%' }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Best and weakest findings</Typography>
              <FindingRow title="Best condition" row={best} />
              <FindingRow title="Weakest condition" row={weakest || null} />
              {filteredTrades.length < 10 && filteredTrades.length > 0 && (
                <Alert severity="warning">Caution: this filter improves or changes expectancy with only {filteredTrades.length} trades. Gather more evidence before changing your trading plan.</Alert>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
      <Grid container spacing={1.5}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Latest evidence</Typography>
                <Button size="small" onClick={onOpenEvidence}>Open evidence</Button>
              </Stack>
              {screenshots.length === 0 ? (
                <EmptyState title="No matching screenshots" description="Upload chart evidence or loosen filters." />
              ) : (
                <EvidenceCarousel screenshots={screenshots.slice(0, 8)} setCarouselIndex={setCarouselIndex} />
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Edge Lenses</Typography>
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={onOpenTrades}>Quick add trade</Button>
              </Stack>
              {lenses.length === 0 ? <Typography variant="body2" color="text.secondary">No saved filter combinations yet.</Typography> : lenses.slice(0, 3).map((lens) => <EdgeLensCard key={lens.id} lens={lens} />)}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
        <Stack spacing={1.25}>
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Notes</Typography>
          <Grid container spacing={1.25}>
            <Grid item xs={12} md={4}><TextField fullWidth multiline minRows={3} label="What worked" value={notes.whatWorked} onChange={(event) => setNotes((current) => ({ ...current, whatWorked: event.target.value }))} /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth multiline minRows={3} label="What failed" value={notes.whatFailed} onChange={(event) => setNotes((current) => ({ ...current, whatFailed: event.target.value }))} /></Grid>
            <Grid item xs={12} md={4}><TextField fullWidth multiline minRows={3} label="Improvement notes" value={notes.notes} onChange={(event) => setNotes((current) => ({ ...current, notes: event.target.value }))} /></Grid>
          </Grid>
          <Box><Button variant="contained" size="small" startIcon={<SaveRoundedIcon />} onClick={() => onSaveNotes(notes)}>Save notes</Button></Box>
        </Stack>
      </Paper>
    </Stack>
  )
}

function BacktestKpiCards({ metrics, baseline }: { metrics: BacktestingMetric; baseline: BacktestingMetric }) {
  return (
    <Grid container spacing={1}>
      {[
        ['Trades', metrics.trades],
        ['Win rate', pct(metrics.winRate)],
        ['Total R', rValue(metrics.totalR)],
        ['Average R', rValue(metrics.averageR)],
        ['Expectancy', rValue(metrics.expectancy)],
        ['Profit factor', metrics.profitFactor === null || metrics.profitFactor === undefined ? '-' : round(metrics.profitFactor)],
        ['Sample quality', metrics.sampleQuality]
      ].map(([label, value]) => (
        <Grid key={label} item xs={6} sm={4} md={label === 'Sample quality' ? 3 : 1.5}>
          <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 1.25, height: '100%' }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 850, mt: 0.3 }}>{value}</Typography>
            {label === 'Expectancy' && baseline.trades !== metrics.trades && <Typography variant="caption" color={metrics.expectancy >= baseline.expectancy ? 'success.main' : 'error.main'}>{rValue(metrics.expectancy - baseline.expectancy)} vs baseline</Typography>}
          </Paper>
        </Grid>
      ))}
    </Grid>
  )
}

function FindingRow({ title, row }: { title: string; row: BacktestingBreakdownRow | null | undefined }) {
  if (!row) return <Typography variant="body2" color="text.secondary">{title}: not enough structured trades yet.</Typography>
  return (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
      <Box>
        <Typography variant="caption" color="text.secondary">{title}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{row.dimension}: {row.label}</Typography>
      </Box>
      <Stack direction="row" spacing={0.75}>
        <Chip size="small" label={rValue(row.metrics.expectancy)} color={row.expectancyDelta >= 0 ? 'success' : 'error'} variant="outlined" />
        <SampleSizeBadge label={row.metrics.sampleQuality} />
      </Stack>
    </Stack>
  )
}

function TradesTab({ trades, allTrades, onAdd, onImport, onExport, onEdit, onDuplicate, onDelete }: {
  trades: BacktestingTrade[]
  allTrades: BacktestingTrade[]
  onAdd: () => void
  onImport: () => void
  onExport: () => void
  onEdit: (trade: BacktestingTrade) => void
  onDuplicate: (trade: BacktestingTrade) => void
  onDelete: (trade: BacktestingTrade) => void
}) {
  const [search, setSearch] = useState('')
  const visible = trades.filter((trade) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return [trade.instrument, trade.setupName, trade.session, trade.notes, ...(trade.tags || [])].some((value) => (value || '').toLowerCase().includes(term))
  })
  return (
    <Stack spacing={1.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
        <TextField size="small" label="Search instrument, setup, tags, notes" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ maxWidth: { sm: 420 } }} fullWidth />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAdd}>Add trade</Button>
          <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={onImport}>Import</Button>
          <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />} onClick={onExport} disabled={visible.length === 0}>Export CSV</Button>
        </Stack>
      </Stack>
      {allTrades.length === 0 ? (
        <EmptyState title="No structured trades yet" description="Use Quick Add or import the Brute Data CSV as the canonical backtest dataset." action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAdd}>Quick add trade</Button>} />
      ) : visible.length === 0 ? (
        <EmptyState title="No trades match the filters" description="Clear filters or search terms to recover the dataset." />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.25 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Date', 'Weekday', 'Time', 'Instrument', 'Direction', 'Session', 'Setup', 'Risk %', 'Planned R:R', 'Result', 'P&L(R)', 'Context TF', 'Execution TF', 'Entry TF', 'Tags', 'Screenshots', 'Notes', 'Actions'].map((head) => <TableCell key={head}>{head}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((trade) => (
                <TableRow key={trade.id} hover>
                  <TableCell>{trade.date}</TableCell>
                  <TableCell>{trade.weekday || deriveWeekday(trade.date)}</TableCell>
                  <TableCell>{trade.entryTime?.slice(0, 5)}</TableCell>
                  <TableCell>{trade.instrument}</TableCell>
                  <TableCell><Chip size="small" label={trade.direction} /></TableCell>
                  <TableCell>{trade.session || '-'}</TableCell>
                  <TableCell>{trade.setupName || '-'}</TableCell>
                  <TableCell>{trade.riskPercent ?? '-'}</TableCell>
                  <TableCell>{trade.plannedRR ?? '-'}</TableCell>
                  <TableCell><Chip size="small" label={trade.result} color={trade.result === 'WIN' ? 'success' : trade.result === 'LOSS' ? 'error' : 'warning'} /></TableCell>
                  <TableCell sx={{ fontWeight: 850, color: trade.pnlR > 0 ? 'success.main' : trade.pnlR < 0 ? 'error.main' : 'text.primary' }}>{rValue(trade.pnlR)}</TableCell>
                  <TableCell>{trade.contextTimeframe || '-'}</TableCell>
                  <TableCell>{trade.executionTimeframe || '-'}</TableCell>
                  <TableCell>{trade.entryTimeframe || '-'}</TableCell>
                  <TableCell>{(trade.tags || []).map((tag) => <Chip key={tag} size="small" label={tag} sx={{ mr: 0.5 }} />)}</TableCell>
                  <TableCell>{trade.screenshotCount || 0}</TableCell>
                  <TableCell sx={{ maxWidth: 180 }}>{trade.notes || '-'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.25}>
                      <IconButton size="small" aria-label="Edit trade" onClick={() => onEdit(trade)}><EditRoundedIcon fontSize="small" /></IconButton>
                      <IconButton size="small" aria-label="Duplicate trade" onClick={() => onDuplicate(trade)}><AddRoundedIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" aria-label="Delete trade" onClick={() => onDelete(trade)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  )
}

function EdgeLabView({ breakdowns, selectedBucket, onApplyBucket, screenshots, setCarouselIndex }: {
  breakdowns: Record<string, BacktestingBreakdownRow[]>
  selectedBucket: BacktestingBreakdownRow | null
  onApplyBucket: (row: BacktestingBreakdownRow) => void
  screenshots: BacktestingScreenshot[]
  setCarouselIndex: (index: number) => void
}) {
  const [view, setView] = useState('hour')
  const rows = breakdowns[view] || []
  return (
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={8.5}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Analysis view</InputLabel>
              <Select label="Analysis view" value={view} onChange={(event) => setView(event.target.value)}>
                <MenuItem value="hour">Time of Day</MenuItem>
                <MenuItem value="halfHour">30-minute windows</MenuItem>
                <MenuItem value="weekday">Weekday</MenuItem>
                <MenuItem value="instrument">Instrument</MenuItem>
                <MenuItem value="session">Session</MenuItem>
                <MenuItem value="setup">Setup</MenuItem>
                <MenuItem value="direction">Direction</MenuItem>
                <MenuItem value="timeframe">Timeframes</MenuItem>
                <MenuItem value="custom">Custom Breakdown</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <BreakdownTable rows={view === 'custom' ? breakdowns.custom || [] : rows} onApplyBucket={onApplyBucket} />
        </Stack>
      </Grid>
      <Grid item xs={12} md={3.5}>
        <ContextEvidencePanel selectedBucket={selectedBucket} screenshots={screenshots} setCarouselIndex={setCarouselIndex} />
      </Grid>
    </Grid>
  )
}

function BreakdownTable({ rows, onApplyBucket }: { rows: BacktestingBreakdownRow[]; onApplyBucket: (row: BacktestingBreakdownRow) => void }) {
  if (rows.length === 0) return <EmptyState title="No buckets yet" description="Add structured trades to generate dynamic analysis." />
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.25 }}>
      <Table size="small">
        <TableHead><TableRow>{['Bucket', 'Trades', 'W/L/BE', 'Win rate', 'Total R', 'Avg R', 'Expectancy', 'PF', 'Sample', 'Impact', ''].map((head) => <TableCell key={head}>{head}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.dimension}-${row.label}`} hover>
              <TableCell sx={{ fontWeight: 850 }}>{row.label}</TableCell>
              <TableCell>{row.metrics.trades}</TableCell>
              <TableCell>{row.metrics.wins}/{row.metrics.losses}/{row.metrics.breakevens}</TableCell>
              <TableCell>{pct(row.metrics.winRate)}</TableCell>
              <TableCell>{rValue(row.metrics.totalR)}</TableCell>
              <TableCell>{rValue(row.metrics.averageR)}</TableCell>
              <TableCell>{rValue(row.metrics.expectancy)}</TableCell>
              <TableCell>{row.metrics.profitFactor ?? '-'}</TableCell>
              <TableCell><SampleSizeBadge label={row.metrics.sampleQuality} /></TableCell>
              <TableCell><Chip size="small" label={`${rValue(row.expectancyDelta)} exp`} color={row.expectancyDelta >= 0 ? 'success' : 'error'} variant="outlined" /></TableCell>
              <TableCell><Button size="small" onClick={() => onApplyBucket(row)}>Apply</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function ImpactAnalysisView({ baseline, filteredMetrics, impactRows, activeFilters, onApplyBucket, lenses, onApplyLens, onDeleteLens, onSaveLens }: {
  baseline: BacktestingMetric
  filteredMetrics: BacktestingMetric
  impactRows: BacktestingBreakdownRow[]
  activeFilters: FilterState
  onApplyBucket: (row: BacktestingBreakdownRow) => void
  lenses: BacktestingEdgeLens[]
  onApplyLens: (id: string) => void
  onDeleteLens: (lens: BacktestingEdgeLens) => void
  onSaveLens: () => void
}) {
  const stack = activeFilterChips(activeFilters).reduce<Array<{ label: string; metrics: BacktestingMetric }>>((acc, chip, index) => {
    acc.push({ label: `Step ${index + 1}: ${chip.label}`, metrics: filteredMetrics })
    return acc
  }, [{ label: 'Step 0: Baseline', metrics: baseline }])
  return (
    <Stack spacing={1.5}>
      <Grid container spacing={1}>
        <Grid item xs={12} md={6}><MetricSummaryCard title="Baseline" metrics={baseline} /></Grid>
        <Grid item xs={12} md={6}><MetricSummaryCard title="Current filter stack" metrics={filteredMetrics} /></Grid>
      </Grid>
      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Standalone filter impact</Typography>
            <Button size="small" startIcon={<SaveRoundedIcon />} onClick={onSaveLens}>Save stack as Edge Lens</Button>
          </Stack>
          <FilterImpactTable rows={impactRows} onApplyBucket={onApplyBucket} />
        </Stack>
      </Paper>
      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1 }}>Cumulative filter stack</Typography>
            <Stack spacing={0.75}>
              {stack.map((step, index) => (
                <Stack key={`${step.label}-${index}`} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">{step.label}</Typography>
                  <Stack direction="row" spacing={0.75}><Chip size="small" label={`${step.metrics.trades} trades`} /><Chip size="small" label={rValue(step.metrics.expectancy)} color={step.metrics.expectancy >= baseline.expectancy ? 'success' : 'error'} variant="outlined" /><SampleSizeBadge label={step.metrics.sampleQuality} /></Stack>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1 }}>Saved Edge Lenses</Typography>
            <Stack spacing={1}>
              {lenses.length === 0 ? <Typography variant="body2" color="text.secondary">No saved lenses yet.</Typography> : lenses.map((lens) => (
                <EdgeLensCard key={lens.id} lens={lens} onApply={() => onApplyLens(lens.id)} onDelete={() => onDeleteLens(lens)} />
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  )
}

function FilterImpactTable({ rows, onApplyBucket }: { rows: BacktestingBreakdownRow[]; onApplyBucket: (row: BacktestingBreakdownRow) => void }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead><TableRow>{['Filter tested', 'Trades retained', 'Win rate', 'Total R', 'Expectancy', 'Exp. delta', 'Total R delta', 'Sample', 'Verdict', ''].map((head) => <TableCell key={head}>{head}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.slice(0, 80).map((row) => (
            <TableRow key={`${row.dimension}-${row.label}`} hover>
              <TableCell>{row.dimension}: <strong>{row.label}</strong>{row.warning && <Alert severity="warning" sx={{ mt: 0.75 }}>{row.warning}</Alert>}</TableCell>
              <TableCell>{row.metrics.trades}</TableCell>
              <TableCell>{pct(row.metrics.winRate)}</TableCell>
              <TableCell>{rValue(row.metrics.totalR)}</TableCell>
              <TableCell>{rValue(row.metrics.expectancy)}</TableCell>
              <TableCell>{rValue(row.expectancyDelta)}</TableCell>
              <TableCell>{rValue(row.totalRDelta)}</TableCell>
              <TableCell><SampleSizeBadge label={row.metrics.sampleQuality} /></TableCell>
              <TableCell><Chip size="small" label={row.verdict} color={row.expectancyDelta > 0 ? 'success' : row.expectancyDelta < 0 ? 'error' : 'default'} variant="outlined" /></TableCell>
              <TableCell><Button size="small" onClick={() => onApplyBucket(row)}>Apply</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function EvidenceNotesTab({ workspace, screenshots, allScreenshots, trades, mode, setMode, onUpload, onSave, onDelete, onDetach, setCarouselIndex }: {
  workspace: BacktestingWorkspace
  screenshots: BacktestingScreenshot[]
  allScreenshots: BacktestingScreenshot[]
  trades: BacktestingTrade[]
  mode: 'carousel' | 'grid'
  setMode: (value: 'carousel' | 'grid') => void
  onUpload: (files: File[]) => void
  onSave: (screenshot: BacktestingScreenshot, payload: BacktestingScreenshotPayload) => void
  onDelete: (screenshot: BacktestingScreenshot) => void
  onDetach: (screenshot: BacktestingScreenshot) => void
  setCarouselIndex: (index: number) => void
}) {
  const winning = screenshots.filter((shot) => shot.tradeResult === 'WIN' || linkedTrade(shot, trades)?.result === 'WIN')
  const losing = screenshots.filter((shot) => shot.tradeResult === 'LOSS' || linkedTrade(shot, trades)?.result === 'LOSS')
  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Screenshot evidence</Typography>
          <Typography variant="body2" color="text.secondary">{screenshots.length} matching screenshots · {allScreenshots.length} total</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant={mode === 'grid' ? 'contained' : 'outlined'} onClick={() => setMode('grid')}>Grid</Button>
          <Button variant={mode === 'carousel' ? 'contained' : 'outlined'} onClick={() => setMode('carousel')}>Carousel</Button>
        </Stack>
      </Stack>
      <AssetUploadDropzone
        title="Drop backtest screenshots or choose files"
        hint="Evidence stays private and can be linked to structured trades."
        buttonLabel="Select screenshots"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onFilesSelected={onUpload}
      />
      <Grid container spacing={1}>
        <Grid item xs={12} md={4}><MetricSmall label="Winning examples" value={winning.length} /></Grid>
        <Grid item xs={12} md={4}><MetricSmall label="Losing examples" value={losing.length} /></Grid>
        <Grid item xs={12} md={4}><MetricSmall label="Linked screenshots" value={screenshots.filter((shot) => shot.backtestingTradeId).length} /></Grid>
      </Grid>
      {screenshots.length === 0 ? <EmptyState title="No screenshots match" description="Upload evidence or clear filters." /> : mode === 'carousel' ? (
        <EvidenceCarousel screenshots={screenshots} setCarouselIndex={setCarouselIndex} />
      ) : (
        <ScreenshotGallery screenshots={screenshots} trades={trades} onOpen={setCarouselIndex} onSave={onSave} onDelete={onDelete} onDetach={onDetach} />
      )}
    </Stack>
  )
}

function ScreenshotGallery({ screenshots, trades, onOpen, onSave, onDelete, onDetach }: {
  screenshots: BacktestingScreenshot[]
  trades: BacktestingTrade[]
  onOpen: (index: number) => void
  onSave: (screenshot: BacktestingScreenshot, payload: BacktestingScreenshotPayload) => void
  onDelete: (screenshot: BacktestingScreenshot) => void
  onDetach: (screenshot: BacktestingScreenshot) => void
}) {
  return (
    <Grid container spacing={1.25}>
      {screenshots.map((screenshot, index) => <Grid key={screenshot.id} item xs={12} sm={6} md={4}><ScreenshotCard screenshot={screenshot} trades={trades} index={index} onOpen={onOpen} onSave={onSave} onDelete={onDelete} onDetach={onDetach} /></Grid>)}
    </Grid>
  )
}

function ScreenshotCard({ screenshot, trades, index, onOpen, onSave, onDelete, onDetach }: {
  screenshot: BacktestingScreenshot
  trades: BacktestingTrade[]
  index: number
  onOpen: (index: number) => void
  onSave: (screenshot: BacktestingScreenshot, payload: BacktestingScreenshotPayload) => void
  onDelete: (screenshot: BacktestingScreenshot) => void
  onDetach: (screenshot: BacktestingScreenshot) => void
}) {
  const [caption, setCaption] = useState(screenshot.caption || '')
  const [result, setResult] = useState<BacktestingScreenshotResult | ''>(screenshot.tradeResult || '')
  const [session, setSession] = useState(screenshot.session || '')
  const [timeframe, setTimeframe] = useState(screenshot.timeframe || '')
  const [tags, setTags] = useState(joinTags(screenshot.tags))
  const [tradeId, setTradeId] = useState(screenshot.backtestingTradeId || '')
  useEffect(() => {
    setCaption(screenshot.caption || '')
    setResult(screenshot.tradeResult || '')
    setSession(screenshot.session || '')
    setTimeframe(screenshot.timeframe || '')
    setTags(joinTags(screenshot.tags))
    setTradeId(screenshot.backtestingTradeId || '')
  }, [screenshot.id, screenshot.updatedAt, screenshot.backtestingTradeId])
  const selectedResult = resultOptions.find((item) => item.value === screenshot.tradeResult)
  const trade = linkedTrade(screenshot, trades)
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.25, overflow: 'hidden', height: '100%' }}>
      <Box role="button" tabIndex={0} onClick={() => onOpen(index)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(index) }} sx={{ aspectRatio: '16 / 10', bgcolor: 'action.hover', cursor: 'zoom-in', position: 'relative', overflow: 'hidden' }}>
        <SecureAssetImage url={screenshot.thumbnailUrl || screenshot.viewUrl || screenshot.url} alt={screenshot.caption || screenshot.originalFileName} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} fallback={<Stack alignItems="center" justifyContent="center" sx={{ height: '100%', p: 2 }}><Typography variant="body2">Image could not render</Typography></Stack>} />
        {selectedResult && <Chip size="small" color={selectedResult.color} label={selectedResult.label} sx={{ position: 'absolute', top: 8, left: 8 }} />}
      </Box>
      <Stack spacing={1} sx={{ p: 1.1 }}>
        {trade && <Alert severity="info" icon={<LinkRoundedIcon />}>{trade.date} {trade.entryTime?.slice(0, 5)} · {trade.direction} · {trade.result} · {rValue(trade.pnlR)}</Alert>}
        <TextField size="small" label="Caption" value={caption} onChange={(event) => setCaption(event.target.value)} />
        <Grid container spacing={1}>
          <Grid item xs={6}><FormControl fullWidth size="small"><InputLabel>Result</InputLabel><Select label="Result" value={result} onChange={(event) => setResult(event.target.value as BacktestingScreenshotResult | '')}><MenuItem value="">None</MenuItem>{resultOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={3}><TextField fullWidth size="small" label="Session" value={session} onChange={(event) => setSession(event.target.value)} /></Grid>
          <Grid item xs={3}><TextField fullWidth size="small" label="TF" value={timeframe} onChange={(event) => setTimeframe(event.target.value)} /></Grid>
        </Grid>
        <TextField size="small" label="Tags" value={tags} onChange={(event) => setTags(event.target.value)} helperText="Comma separated" />
        <FormControl fullWidth size="small">
          <InputLabel>Linked trade</InputLabel>
          <Select label="Linked trade" value={tradeId} onChange={(event) => setTradeId(event.target.value)}>
            <MenuItem value="">None</MenuItem>
            {trades.map((item) => <MenuItem key={item.id} value={item.id}>{item.date} {item.entryTime?.slice(0, 5)} · {item.direction} · {item.result} · {rValue(item.pnlR)}</MenuItem>)}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button size="small" startIcon={<SaveRoundedIcon />} onClick={() => onSave(screenshot, { caption, tradeResult: result || null, session, timeframe, tags: splitTags(tags), backtestingTradeId: tradeId || undefined })}>Save</Button>
          <Stack direction="row" spacing={0.5}>
            {screenshot.backtestingTradeId && <Button size="small" onClick={() => onDetach(screenshot)}>Unlink</Button>}
            <IconButton size="small" color="error" aria-label="Delete screenshot" onClick={() => onDelete(screenshot)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  )
}

function QuickAddBacktestTradeModal({ open, draft, setDraft, editing, saving, screenshots, onClose, onSave }: {
  open: boolean
  draft: BacktestingTradePayload
  setDraft: (value: BacktestingTradePayload | ((current: BacktestingTradePayload) => BacktestingTradePayload)) => void
  editing: boolean
  saving: boolean
  screenshots: BacktestingScreenshot[]
  onClose: () => void
  onSave: () => void
}) {
  const update = (field: keyof BacktestingTradePayload) => (event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  const updateNumber = (field: keyof BacktestingTradePayload) => (event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, [field]: event.target.value === '' ? null : Number(event.target.value) }))
  const warning = tradeDraftWarning(draft)
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? 'Edit trade' : 'Quick Add Trade'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25} sx={{ pt: 0.5 }}>
          {warning && <Alert severity="warning">{warning}</Alert>}
          <Grid container spacing={1.25}>
            <Grid item xs={12} sm={4}><TextField fullWidth required type="date" label="Date" InputLabelProps={{ shrink: true }} value={draft.date} onChange={update('date')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth required type="time" label="Time" InputLabelProps={{ shrink: true }} value={draft.entryTime?.slice(0, 5) || ''} onChange={update('entryTime')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth required label="Instrument" value={draft.instrument} onChange={update('instrument')} /></Grid>
            <Grid item xs={12} sm={4}><FormControl fullWidth><InputLabel>Direction</InputLabel><Select label="Direction" value={draft.direction} onChange={(event) => setDraft((current) => ({ ...current, direction: event.target.value as BacktestingTradeDirection }))}><MenuItem value="LONG">LONG</MenuItem><MenuItem value="SHORT">SHORT</MenuItem></Select></FormControl></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth label="Session" value={draft.session || ''} onChange={update('session')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth label="Setup" value={draft.setupName || ''} onChange={update('setupName')} /></Grid>
            <Grid item xs={6} sm={3}><TextField fullWidth type="number" label="Risk %" value={draft.riskPercent ?? ''} onChange={updateNumber('riskPercent')} /></Grid>
            <Grid item xs={6} sm={3}><TextField fullWidth type="number" label="Planned R:R" value={draft.plannedRR ?? ''} onChange={updateNumber('plannedRR')} /></Grid>
            <Grid item xs={6} sm={3}><FormControl fullWidth><InputLabel>Result</InputLabel><Select label="Result" value={draft.result} onChange={(event) => setDraft((current) => ({ ...current, result: event.target.value as BacktestingTradeResult }))}>{tradeResults.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={6} sm={3}><TextField fullWidth required type="number" label="P&L(R)" value={draft.pnlR ?? ''} onChange={updateNumber('pnlR')} /></Grid>
            <Grid item xs={4}><TextField fullWidth label="Context TF" value={draft.contextTimeframe || ''} onChange={update('contextTimeframe')} /></Grid>
            <Grid item xs={4}><TextField fullWidth label="Execution TF" value={draft.executionTimeframe || ''} onChange={update('executionTimeframe')} /></Grid>
            <Grid item xs={4}><TextField fullWidth label="Entry TF" value={draft.entryTimeframe || ''} onChange={update('entryTimeframe')} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Tags" value={joinTags(draft.tags)} onChange={(event) => setDraft((current) => ({ ...current, tags: splitTags(event.target.value) }))} helperText="Comma separated" /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Notes" value={draft.notes || ''} onChange={update('notes')} /></Grid>
          </Grid>
          {screenshots.length > 0 && <Typography variant="caption" color="text.secondary">Attach screenshots after saving from Evidence & Notes.</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={onSave} disabled={saving}>Save trade</Button></DialogActions>
    </Dialog>
  )
}

function ImportTradesModal({ open, importing, onClose, onImport }: { open: boolean; importing: boolean; onClose: () => void; onImport: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null)
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Import trades</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Alert severity="info">Import the Brute Data CSV as the canonical dataset. Header names like Date, Time, Instrument, Direction, Result, P&L(R), Tags, and Notes are detected automatically.</Alert>
          <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />}>
            Choose CSV
            <input hidden type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </Button>
          {file && <Typography variant="body2">{file.name}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!file || importing} onClick={() => file && onImport(file)}>Import valid rows</Button></DialogActions>
    </Dialog>
  )
}

function WorkspaceDialog({ open, draft, setDraft, strategies, selectedStrategy, editing, saving, error, onClose, onSave }: {
  open: boolean
  draft: WorkspaceDraft
  setDraft: (value: WorkspaceDraft | ((current: WorkspaceDraft) => WorkspaceDraft)) => void
  strategies: StrategyResponse[]
  selectedStrategy: StrategyResponse | null
  editing: boolean
  saving: boolean
  error: string
  onClose: () => void
  onSave: () => void
}) {
  const update = (field: keyof WorkspaceDraft) => (event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  const updateNumber = (field: keyof WorkspaceDraft) => (event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, [field]: Math.max(0, num(event.target.value)) }))
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? 'Edit backtest' : 'New backtest'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={1.25}>
            <Grid item xs={12} sm={4}><TextField required fullWidth label="Symbol" value={draft.symbol} onChange={update('symbol')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth label="Market type" value={draft.marketType || ''} onChange={update('marketType')} placeholder="Futures" /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth label="Title" value={draft.title || ''} onChange={update('title')} /></Grid>
          </Grid>
          <Autocomplete options={strategies} value={selectedStrategy} getOptionLabel={(option) => option.name} isOptionEqualToValue={(option, value) => option.id === value.id} onChange={(_, value) => setDraft((current) => ({ ...current, strategyId: value?.id || null, strategyNameSnapshot: value ? value.name : current.strategyNameSnapshot }))} renderInput={(params) => <TextField {...params} label="Link existing strategy" placeholder="Search strategies" />} />
          <TextField fullWidth label="Manual strategy name" value={draft.strategyNameSnapshot || ''} onChange={update('strategyNameSnapshot')} helperText="Use this when the strategy does not exist yet, or keep it as a snapshot label." />
          <Grid container spacing={1.25}>
            {[
              ['primaryTimeframe', 'Primary TF'],
              ['contextTimeframe', 'Context TF'],
              ['executionTimeframe', 'Execution TF'],
              ['entryTimeframe', 'Entry TF']
            ].map(([field, label]) => <Grid key={field} item xs={6} sm={3}><TextField fullWidth label={label} value={draft[field as keyof WorkspaceDraft] || ''} onChange={update(field as keyof WorkspaceDraft)} /></Grid>)}
          </Grid>
          <Divider />
          <Alert severity="info">Manual stats remain only as legacy fallback. Once structured trades exist, workspace metrics are calculated automatically.</Alert>
          <Grid container spacing={1.25}>
            {[
              ['numberOfTrades', 'Legacy trades'],
              ['winningTrades', 'Legacy wins'],
              ['losingTrades', 'Legacy losses'],
              ['breakevenTrades', 'Legacy BE']
            ].map(([field, label]) => <Grid key={field} item xs={6} sm={3}><TextField fullWidth type="number" inputProps={{ min: 0 }} label={label} value={draft[field as keyof WorkspaceDraft] ?? 0} onChange={updateNumber(field as keyof WorkspaceDraft)} /></Grid>)}
          </Grid>
          <TextField fullWidth type="number" label="Legacy average R" value={draft.averageR ?? ''} onChange={(event) => setDraft((current) => ({ ...current, averageR: event.target.value === '' ? null : Number(event.target.value) }))} />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={onSave} disabled={saving || !draft.symbol.trim()}>{editing ? 'Save' : 'Create'}</Button></DialogActions>
    </Dialog>
  )
}

function StrategySnapshot({ workspace }: { workspace: BacktestingWorkspace }) {
  if (!workspace.strategy) {
    return (
      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25, height: '100%' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Strategy snapshot</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{workspace.strategyNameSnapshot ? `Manual strategy: ${workspace.strategyNameSnapshot}` : 'No linked strategy yet.'}</Typography>
      </Paper>
    )
  }
  const strategy = workspace.strategy
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25, height: '100%' }}>
      <Stack spacing={0.75}>
        <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Strategy snapshot</Typography>
        <Typography variant="body2"><strong>Strategy:</strong> {strategy.name}</Typography>
        <Typography variant="body2"><strong>Entry model:</strong> {strategy.model || '-'}</Typography>
        <Typography variant="body2"><strong>Invalidation:</strong> {strategy.invalidationLogic || '-'}</Typography>
        <Typography variant="body2"><strong>Rules:</strong> {(strategy.entryConditions || []).join(' / ') || '-'}</Typography>
      </Stack>
    </Paper>
  )
}

function EvidenceCarousel({ screenshots, setCarouselIndex }: { screenshots: BacktestingScreenshot[]; setCarouselIndex: (index: number) => void }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
      {screenshots.map((screenshot, index) => (
        <Box key={screenshot.id} onClick={() => setCarouselIndex(index)} sx={{ flex: '0 0 180px', aspectRatio: '16 / 10', borderRadius: 1.25, overflow: 'hidden', cursor: 'zoom-in', bgcolor: 'action.hover' }}>
          <SecureAssetImage url={screenshot.thumbnailUrl || screenshot.viewUrl || screenshot.url} alt={screenshot.caption || screenshot.originalFileName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
      ))}
    </Box>
  )
}

function ScreenshotCarousel({ open, screenshots, index, setIndex, onClose, isMobile }: {
  open: boolean
  screenshots: BacktestingScreenshot[]
  index: number
  setIndex: (value: number | null) => void
  onClose: () => void
  isMobile: boolean
}) {
  const touchStart = useRef<number | null>(null)
  const screenshot = screenshots[index]
  const go = (delta: number) => screenshots.length && setIndex((index + delta + screenshots.length) % screenshots.length)
  if (!screenshot) return null
  return (
    <Dialog open={open} onClose={onClose} fullScreen={isMobile} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pr: 7 }}>
        <Stack spacing={0.5}><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{index + 1} / {screenshots.length}</Typography><Typography variant="body2" color="text.secondary" noWrap>{screenshot.caption || screenshot.originalFileName}</Typography></Stack>
        <IconButton aria-label="Close carousel" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current; if (Math.abs(delta) > 40) go(delta > 0 ? -1 : 1); touchStart.current = null }} sx={{ p: { xs: 1, sm: 2 }, bgcolor: 'background.default' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: { xs: '70vh', sm: 560 } }}>
          <IconButton aria-label="Previous screenshot" onClick={() => go(-1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><ArrowBackIosNewRoundedIcon /></IconButton>
          <Box sx={{ flex: 1, minWidth: 0, maxHeight: { xs: '72vh', sm: 640 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SecureAssetImage url={screenshot.viewUrl || screenshot.url} alt={screenshot.caption || screenshot.originalFileName} sx={{ maxWidth: '100%', maxHeight: { xs: '72vh', sm: 640 }, objectFit: 'contain', borderRadius: 1 }} fallback={<Alert severity="warning">Image could not render.</Alert>} />
          </Box>
          <IconButton aria-label="Next screenshot" onClick={() => go(1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><ArrowForwardIosRoundedIcon /></IconButton>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', gap: 1 }}>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">{screenshot.tradeResult && <Chip size="small" label={screenshot.tradeResult} />}{screenshot.session && <Chip size="small" label={screenshot.session} />}{screenshot.timeframe && <Chip size="small" label={screenshot.timeframe} />}{screenshot.tags.map((tag) => <Chip key={tag} size="small" variant="outlined" label={tag} />)}</Stack>
        <Stack direction="row" spacing={1} sx={{ display: { xs: 'flex', sm: 'none' } }}><IconButton aria-label="Previous screenshot" onClick={() => go(-1)}><ArrowBackIosNewRoundedIcon /></IconButton><IconButton aria-label="Next screenshot" onClick={() => go(1)}><ArrowForwardIosRoundedIcon /></IconButton></Stack>
      </DialogActions>
    </Dialog>
  )
}

function ContextEvidencePanel({ selectedBucket, screenshots, setCarouselIndex }: { selectedBucket: BacktestingBreakdownRow | null; screenshots: BacktestingScreenshot[]; setCarouselIndex: (index: number) => void }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25, position: 'sticky', top: 80 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{selectedBucket ? `${selectedBucket.dimension}: ${selectedBucket.label}` : 'Context evidence'}</Typography>
        {selectedBucket?.warning && <Alert severity="warning">{selectedBucket.warning}</Alert>}
        {screenshots.length === 0 ? <Typography variant="body2" color="text.secondary">No matching evidence.</Typography> : <EvidenceCarousel screenshots={screenshots.slice(0, 6)} setCarouselIndex={setCarouselIndex} />}
      </Stack>
    </Paper>
  )
}

function EdgeLensCard({ lens, onApply, onDelete }: { lens: BacktestingEdgeLens; onApply?: () => void; onDelete?: () => void }) {
  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.25 }}>
      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" sx={{ fontWeight: 850 }}>{lens.name}</Typography>
          <SampleSizeBadge label={lens.metrics.sampleQuality} />
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {Object.entries(lens.filterDefinition || {}).map(([key, value]) => <Chip key={key} size="small" label={`${labelForKey(key)}: ${value}`} />)}
        </Stack>
        <Grid container spacing={0.75}>
          <Grid item xs={3}><MetricTiny label="Trades" value={lens.metrics.trades} /></Grid>
          <Grid item xs={3}><MetricTiny label="WR" value={pct(lens.metrics.winRate)} /></Grid>
          <Grid item xs={3}><MetricTiny label="Total R" value={rValue(lens.metrics.totalR)} /></Grid>
          <Grid item xs={3}><MetricTiny label="Exp." value={rValue(lens.metrics.expectancy)} /></Grid>
        </Grid>
        {(onApply || onDelete) && <Stack direction="row" spacing={1}>{onApply && <Button size="small" onClick={onApply}>Apply</Button>}{onDelete && <Button size="small" color="error" onClick={onDelete}>Delete</Button>}</Stack>}
      </Stack>
    </Paper>
  )
}

function MetricSummaryCard({ title, metrics }: { title: string; metrics: BacktestingMetric }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1 }}>{title}</Typography>
      <Grid container spacing={0.75}>
        {([
          ['Trades', metrics.trades],
          ['Win rate', pct(metrics.winRate)],
          ['BE rate', pct(metrics.breakevenRate)],
          ['Total R', rValue(metrics.totalR)],
          ['Avg R', rValue(metrics.averageR)],
          ['PF', metrics.profitFactor ?? '-'],
          ['Expectancy', rValue(metrics.expectancy)]
        ] as Array<[string, unknown]>).map(([label, value]) => <Grid key={label} item xs={6} sm={3}><MetricTiny label={label} value={value} /></Grid>)}
      </Grid>
    </Paper>
  )
}

function SampleSizeBadge({ label }: { label: string }) {
  const color = label === 'Exploratory only' ? 'warning' : label === 'Early signal' ? 'info' : label === 'Developing evidence' ? 'primary' : 'success'
  return <Chip size="small" label={label} color={color} variant="outlined" />
}

function MetricTiny({ label, value }: { label: string; value: unknown }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ fontWeight: 850 }}>{String(value)}</Typography></Box>
}

function MetricSmall({ label, value }: { label: string; value: unknown }) {
  return <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.25 }}><MetricTiny label={label} value={value} /></Paper>
}

function normalizeWorkspacePayload(draft: WorkspaceDraft): BacktestingWorkspacePayload {
  return {
    ...draft,
    symbol: (draft.symbol || '').trim().toUpperCase(),
    strategyId: draft.strategyId || null,
    strategyNameSnapshot: draft.strategyNameSnapshot || null,
    numberOfTrades: Math.max(0, num(draft.numberOfTrades)),
    winningTrades: Math.max(0, num(draft.winningTrades)),
    losingTrades: Math.max(0, num(draft.losingTrades)),
    breakevenTrades: Math.max(0, num(draft.breakevenTrades)),
    averageR: draft.averageR === null || draft.averageR === undefined ? null : Number(draft.averageR)
  }
}

function tradeToPayload(trade: BacktestingTrade): BacktestingTradePayload {
  return {
    date: trade.date,
    entryTime: trade.entryTime,
    instrument: trade.instrument,
    direction: trade.direction,
    session: trade.session || '',
    setupName: trade.setupName || '',
    strategyId: trade.strategyId || null,
    riskPercent: trade.riskPercent ?? null,
    plannedRR: trade.plannedRR ?? null,
    result: trade.result,
    pnlR: trade.pnlR,
    contextTimeframe: trade.contextTimeframe || '',
    executionTimeframe: trade.executionTimeframe || '',
    entryTimeframe: trade.entryTimeframe || '',
    tags: trade.tags || [],
    notes: trade.notes || '',
    source: trade.source,
    tradeScope: trade.tradeScope
  }
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  return Number(value)
}

function tradeDraftWarning(draft: BacktestingTradePayload) {
  const pnl = num(draft.pnlR)
  if (draft.result === 'LOSS' && pnl > 0) return 'Result is LOSS but P&L(R) is positive. You can save it, but check the row.'
  if (draft.result === 'WIN' && pnl < 0) return 'Result is WIN but P&L(R) is negative. You can save it, but check the row.'
  if (draft.result === 'BREAKEVEN' && pnl !== 0) return 'Breakeven trades usually use 0R. Override only if fees or partials justify it.'
  return ''
}

function applyFilters(trades: BacktestingTrade[], filters: FilterState, screenshotTradeIds: Set<string>) {
  return trades.filter((trade) => {
    if (filters.dateFrom && trade.date < filters.dateFrom) return false
    if (filters.dateTo && trade.date > filters.dateTo) return false
    if (filters.instrument && !trade.instrument.toLowerCase().includes(filters.instrument.toLowerCase())) return false
    if (filters.direction && trade.direction !== filters.direction) return false
    if (filters.session && (trade.session || '').toLowerCase() !== filters.session.toLowerCase()) return false
    if (filters.setup && !(trade.setupName || '').toLowerCase().includes(filters.setup.toLowerCase())) return false
    if (filters.result && trade.result !== filters.result) return false
    const time = trade.entryTime?.slice(0, 5) || ''
    if (filters.timeFrom && time < filters.timeFrom) return false
    if (filters.timeTo && time > filters.timeTo) return false
    if (filters.weekday && (trade.weekday || deriveWeekday(trade.date)) !== filters.weekday) return false
    if (filters.contextTimeframe && (trade.contextTimeframe || '').toLowerCase() !== filters.contextTimeframe.toLowerCase()) return false
    if (filters.executionTimeframe && (trade.executionTimeframe || '').toLowerCase() !== filters.executionTimeframe.toLowerCase()) return false
    if (filters.entryTimeframe && (trade.entryTimeframe || '').toLowerCase() !== filters.entryTimeframe.toLowerCase()) return false
    if (filters.tag && !(trade.tags || []).some((tag) => tag.toLowerCase().includes(filters.tag.toLowerCase()))) return false
    if (filters.hasScreenshots === 'YES' && !screenshotTradeIds.has(trade.id)) return false
    if (filters.hasScreenshots === 'NO' && screenshotTradeIds.has(trade.id)) return false
    return true
  })
}

function filterScreenshots(screenshots: BacktestingScreenshot[], trades: BacktestingTrade[], filters: FilterState) {
  const tradeIds = new Set(trades.map((trade) => trade.id))
  const hasTradeFilters = Object.entries(compactFilters(filters)).some(([key]) => !['tag'].includes(key))
  return screenshots.filter((shot) => {
    if (shot.backtestingTradeId && tradeIds.has(shot.backtestingTradeId)) return true
    if (hasTradeFilters) return false
    if (filters.result && shot.tradeResult !== filters.result) return false
    if (filters.session && (shot.session || '').toLowerCase() !== filters.session.toLowerCase()) return false
    if (filters.entryTimeframe && (shot.timeframe || '').toLowerCase() !== filters.entryTimeframe.toLowerCase()) return false
    if (filters.tag && !(shot.tags || []).some((tag) => tag.toLowerCase().includes(filters.tag.toLowerCase()))) return false
    return true
  })
}

function computeMetrics(trades: BacktestingTrade[]): BacktestingMetric {
  const total = trades.length
  const wins = trades.filter((trade) => trade.result === 'WIN').length
  const losses = trades.filter((trade) => trade.result === 'LOSS').length
  const breakevens = trades.filter((trade) => trade.result === 'BREAKEVEN').length
  const totalR = trades.reduce((sum, trade) => sum + num(trade.pnlR), 0)
  const winningR = trades.filter((trade) => num(trade.pnlR) > 0).map((trade) => num(trade.pnlR))
  const losingR = trades.filter((trade) => num(trade.pnlR) < 0).map((trade) => num(trade.pnlR))
  const grossWin = winningR.reduce((sum, value) => sum + value, 0)
  const grossLoss = Math.abs(losingR.reduce((sum, value) => sum + value, 0))
  return {
    trades: total,
    wins,
    losses,
    breakevens,
    winRate: total ? round((wins / total) * 100) : 0,
    lossRate: total ? round((losses / total) * 100) : 0,
    breakevenRate: total ? round((breakevens / total) * 100) : 0,
    totalR: round(totalR),
    averageR: total ? round(totalR / total) : 0,
    expectancy: total ? round(totalR / total) : 0,
    profitFactor: grossLoss ? round(grossWin / grossLoss) : grossWin > 0 ? null : 0,
    averageWinR: winningR.length ? round(grossWin / winningR.length) : 0,
    averageLossR: losingR.length ? round(losingR.reduce((sum, value) => sum + value, 0) / losingR.length) : 0,
    largestWinR: winningR.length ? round(Math.max(...winningR)) : 0,
    largestLossR: losingR.length ? round(Math.min(...losingR)) : 0,
    sampleQuality: sampleQuality(total)
  }
}

function sampleQuality(trades: number) {
  if (trades < 10) return 'Exploratory only'
  if (trades < 30) return 'Early signal'
  if (trades < 60) return 'Developing evidence'
  return 'More reliable pattern'
}

function buildBreakdowns(trades: BacktestingTrade[], baseline: BacktestingMetric): Record<string, BacktestingBreakdownRow[]> {
  const custom = groupRows('custom', trades, baseline, (trade) => `${hourBucket(trade)} · ${trade.direction} · ${trade.session || 'Unspecified'}`, (label) => ({ custom: label }))
  return {
    hour: groupRows('hour', trades, baseline, hourBucket, (label) => ({ hour: label })),
    halfHour: groupRows('halfHour', trades, baseline, halfHourBucket, (label) => ({ halfHour: label })),
    weekday: groupRows('weekday', trades, baseline, (trade) => trade.weekday || deriveWeekday(trade.date), (label) => ({ weekday: label })),
    instrument: groupRows('instrument', trades, baseline, (trade) => trade.instrument, (label) => ({ instrument: label })),
    session: groupRows('session', trades, baseline, (trade) => trade.session || 'Unspecified', (label) => ({ session: label })),
    setup: groupRows('setup', trades, baseline, (trade) => trade.setupName || 'Unspecified', (label) => ({ setup: label })),
    direction: groupRows('direction', trades, baseline, (trade) => trade.direction, (label) => ({ direction: label })),
    timeframe: groupRows('timeframe', trades, baseline, (trade) => `${trade.contextTimeframe || '-'} / ${trade.executionTimeframe || '-'} / ${trade.entryTimeframe || '-'}`, (label) => ({ timeframeSet: label })),
    custom
  }
}

function buildImpactRows(trades: BacktestingTrade[], baseline: BacktestingMetric) {
  const breakdowns = buildBreakdowns(trades, baseline)
  return Object.values(breakdowns).flat().sort((a, b) => b.expectancyDelta - a.expectancyDelta)
}

function groupRows(dimension: string, trades: BacktestingTrade[], baseline: BacktestingMetric, keyFn: (trade: BacktestingTrade) => string, filtersFn: (label: string) => Record<string, unknown>): BacktestingBreakdownRow[] {
  const groups = new Map<string, BacktestingTrade[]>()
  trades.forEach((trade) => {
    const key = keyFn(trade)
    groups.set(key, [...(groups.get(key) || []), trade])
  })
  return Array.from(groups.entries()).map(([label, rows]) => {
    const metrics = computeMetrics(rows)
    const expectancyDelta = round(metrics.expectancy - baseline.expectancy)
    const totalRDelta = round(metrics.totalR - baseline.totalR)
    return {
      dimension,
      label,
      filters: filtersFn(label),
      metrics,
      expectancyDelta,
      totalRDelta,
      verdict: verdict(metrics.trades, expectancyDelta),
      warning: metrics.trades < 10 && expectancyDelta > 0 ? `Caution: this filter improves expectancy but only ${metrics.trades} trades remain. Gather more evidence before changing your trading plan.` : null
    }
  }).sort((a, b) => b.metrics.expectancy - a.metrics.expectancy)
}

function verdict(trades: number, expectancyDelta: number) {
  if (trades < 10) return 'Exploratory only'
  if (Math.abs(expectancyDelta) < 0.05) return 'Neutral'
  if (expectancyDelta > 0 && trades >= 30) return 'Strong improvement'
  if (expectancyDelta > 0) return 'Positive but early'
  return 'Weak / avoid'
}

function hourBucket(trade: BacktestingTrade) {
  return `${trade.entryTime?.slice(0, 2) || '00'}:00`
}

function halfHourBucket(trade: BacktestingTrade) {
  const [hourText, minuteText] = (trade.entryTime || '00:00').split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText) < 30 ? 0 : 30
  const endHour = minute === 0 ? hour : (hour + 1) % 24
  const endMinute = minute === 0 ? 30 : 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}-${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
}

function activeFilterChips(filters: FilterState) {
  return (Object.keys(filters) as Array<keyof FilterState>)
    .filter((key) => filters[key])
    .map((key) => ({ key, label: `${labelForKey(key)}: ${filters[key]}` }))
}

function compactFilters(filters: FilterState): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as Record<string, string>
}

function filtersFromDefinition(definition: Record<string, unknown>): Partial<FilterState> {
  const next: Partial<FilterState> = {}
  Object.entries(definition || {}).forEach(([key, value]) => {
    if (key === 'hour') next.timeFrom = String(value).slice(0, 5)
    else if (key === 'halfHour') {
      const [from, to] = String(value).split('-')
      next.timeFrom = from
      next.timeTo = to
    } else if (key === 'timeframeSet') {
      const [contextTimeframe, executionTimeframe, entryTimeframe] = String(value).split(' / ')
      next.contextTimeframe = contextTimeframe === '-' ? '' : contextTimeframe
      next.executionTimeframe = executionTimeframe === '-' ? '' : executionTimeframe
      next.entryTimeframe = entryTimeframe === '-' ? '' : entryTimeframe
    } else if (key in emptyFilters) {
      ;(next as Record<string, string>)[key] = String(value)
    }
  })
  return next
}

function labelForKey(key: string) {
  return ({
    dateFrom: 'From',
    dateTo: 'To',
    instrument: 'Instrument',
    direction: 'Direction',
    session: 'Session',
    setup: 'Setup',
    result: 'Result',
    timeFrom: 'After',
    timeTo: 'Before',
    weekday: 'Weekday',
    contextTimeframe: 'Context TF',
    executionTimeframe: 'Exec TF',
    entryTimeframe: 'Entry TF',
    tag: 'Tag',
    hasScreenshots: 'Screenshots',
    hour: 'Hour',
    halfHour: 'Time',
    timeframeSet: 'Timeframes'
  } as Record<string, string>)[key] || key
}

function lensName(filters: Record<string, unknown>) {
  return Object.entries(filters).slice(0, 4).map(([key, value]) => `${labelForKey(key)} ${value}`).join(' · ') || 'New Edge Lens'
}

function linkedTrade(screenshot: BacktestingScreenshot, trades: BacktestingTrade[]) {
  return trades.find((trade) => trade.id === screenshot.backtestingTradeId) || null
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

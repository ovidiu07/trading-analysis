import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useLocation, useNavigate } from 'react-router-dom'
import { TradeCsvImportSummary, TradeResponse, createTrade, deleteTrade, getTradeById, importTradesCsv, listTrades, searchTrades, updateTrade } from '../api/trades'
import { createNotebookNote } from '../api/notebook'
import { TradeFormValues, buildTradePayload } from '../utils/tradePayload'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatSignedCurrency } from '../utils/format'
import { TradeForm } from '../components/trades/TradeForm'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { alpha } from '@mui/material/styles'
import { useDemoData } from '../features/demo/DemoDataContext'
import { trackEvent } from '../utils/analytics/ga4'
import { listPublishedContent } from '../api/content'

type ContentOption = {
  id: string
  label: string
}

const ruleBreakOptions = [
  'lateEntry',
  'earlyExit',
  'oversizedRisk',
  'ignoredInvalidation',
  'newsViolation',
  'outsideSession'
] as const

const buildDefaultValues = (): TradeFormValues => ({
  symbol: '',
  market: 'STOCK',
  direction: 'LONG',
  status: 'OPEN',
  openedAt: new Date().toISOString().slice(0, 16),
  closedAt: '',
  timeframe: '',
  quantity: 1,
  entryPrice: 0,
  exitPrice: undefined,
  stopLossPrice: undefined,
  takeProfitPrice: undefined,
  fees: 0,
  commission: 0,
  slippage: 0,
  riskAmount: undefined,
  capitalUsed: undefined,
  setup: '',
  strategyTag: '',
  catalystTag: '',
  strategyId: '',
  setupGrade: undefined,
  ruleBreaks: [],
  session: undefined,
  linkedContentIds: [],
  notes: '',
  accountId: ''
})

const defaultFilters = {
  openedAtFrom: '',
  openedAtTo: '',
  closedAtFrom: '',
  closedAtTo: '',
  closedDate: '',
  tz: '',
  symbol: '',
  direction: '',
  status: ''
}

const countActiveFilters = (filters: typeof defaultFilters) =>
  Object.values(filters).filter((value) => value !== '').length

const mapTradeToFormValues = (trade: TradeResponse): TradeFormValues => {
  const toInputDate = (value?: string | null) => {
    if (!value) return ''
    const d = new Date(value)
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }
  return {
    symbol: trade.symbol,
    market: trade.market,
    direction: trade.direction,
    status: trade.status,
    openedAt: toInputDate(trade.openedAt),
    closedAt: toInputDate(trade.closedAt),
    timeframe: trade.timeframe || '',
    quantity: trade.quantity ?? 0,
    entryPrice: trade.entryPrice ?? 0,
    exitPrice: trade.exitPrice ?? undefined,
    stopLossPrice: trade.stopLossPrice ?? undefined,
    takeProfitPrice: trade.takeProfitPrice ?? undefined,
    fees: trade.fees ?? 0,
    commission: trade.commission ?? 0,
    slippage: trade.slippage ?? 0,
    riskAmount: trade.riskAmount ?? undefined,
    capitalUsed: trade.capitalUsed ?? undefined,
    setup: trade.setup ?? '',
    strategyTag: trade.strategyTag ?? '',
    catalystTag: trade.catalystTag ?? '',
    strategyId: trade.strategyId ?? '',
    setupGrade: trade.setupGrade ?? undefined,
    ruleBreaks: trade.ruleBreaks ?? [],
    session: trade.session ?? undefined,
    linkedContentIds: trade.linkedContentIds ?? [],
    notes: trade.notes ?? '',
    accountId: trade.accountId ?? ''
  }
}

export default function TradesPage() {
  const { t } = useI18n()
  const [trades, setTrades] = useState<TradeResponse[]>([])
  const [totalRows, setTotalRows] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<string>('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [createError, setCreateError] = useState('')
  const [editError, setEditError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [noteNavError, setNoteNavError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout, user } = useAuth()
  const { refreshToken } = useDemoData()
  const baseCurrency = user?.baseCurrency || 'USD'
  const timezone = user?.timezone || 'Europe/Bucharest'
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'))

  const [viewMode, setViewMode] = useState<'list' | 'search'>('list')
  const [filters, setFilters] = useState(defaultFilters)
  const [activeFilters, setActiveFilters] = useState<typeof defaultFilters | null>(null)

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  })
  const [expandedTrade, setExpandedTrade] = useState<TradeResponse | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [quickLogDialogOpen, setQuickLogDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TradeResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TradeResponse | null>(null)
  const [createFormValues, setCreateFormValues] = useState<TradeFormValues>(buildDefaultValues())
  const [quickLogValues, setQuickLogValues] = useState<TradeFormValues>(() => ({
    ...buildDefaultValues(),
    market: 'FOREX',
    quantity: 1
  }))
  const [quickLogError, setQuickLogError] = useState('')
  const [optionsLoadError, setOptionsLoadError] = useState('')
  const [strategyOptions, setStrategyOptions] = useState<ContentOption[]>([])
  const [planOptions, setPlanOptions] = useState<ContentOption[]>([])
  const [importSummary, setImportSummary] = useState<TradeCsvImportSummary | null>(null)
  const [importError, setImportError] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [highlightTradeId, setHighlightTradeId] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const handleAuthFailure = useCallback((message?: string) => {
    setFetchError(message || t('trades.errors.loginRequired'))
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }, [location.pathname, logout, navigate, t])

  const handleEditClick = useCallback((trade: TradeResponse) => {
    setEditTarget(trade)
    setEditError('')
    setEditDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback((trade: TradeResponse) => {
    setDeleteTarget(trade)
    setDeleteError('')
  }, [])

  const strategyNameById = useMemo(() => {
    const map = new Map<string, string>()
    strategyOptions.forEach((item) => map.set(item.id, item.label))
    return map
  }, [strategyOptions])

  const hydrateStrategyTag = useCallback((values: TradeFormValues): TradeFormValues => {
    if (values.strategyTag || !values.strategyId) {
      return values
    }
    const strategyLabel = strategyNameById.get(values.strategyId)
    if (!strategyLabel) {
      return values
    }
    return {
      ...values,
      strategyTag: strategyLabel
    }
  }, [strategyNameById])

  const handleCreateTradeNote = useCallback(async (trade: TradeResponse) => {
    setNoteNavError('')
    try {
      const note = await createNotebookNote({
        type: 'TRADE_NOTE',
        title: `${trade.symbol} ${t('trades.tradeNoteSuffix')}`,
        relatedTradeId: trade.id
      })
      const noteId = (note as any)?.id
      if (!noteId) {
        setNoteNavError(t('trades.errors.noteMissingId'))
        return
      }
      const target = `/notebook?noteId=${noteId}`
      navigate(target)
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      const message = apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.createTradeNoteFailed') : t('trades.errors.createTradeNoteFailed')
      setEditError(message)
      setNoteNavError(message)
    }
  }, [handleAuthFailure, navigate, t])


  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'openedAt',
      headerName: t('trades.table.opened'),
      flex: 1.1,
      minWidth: 170,
      valueFormatter: (params) => formatDateTime(params.value),
      sortComparator: (a, b) => new Date(a as string).getTime() - new Date(b as string).getTime()
    },
    { field: 'symbol', headerName: t('trades.table.symbol'), flex: 1, minWidth: 110 },
    { field: 'market', headerName: t('trades.table.market'), flex: 1, minWidth: 110 },
    {
      field: 'direction',
      headerName: t('trades.table.direction'),
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          size="small"
          label={t(`trades.direction.${params.value}`)}
          color={params.value === 'LONG' ? 'success' : 'error'}
          variant="outlined"
        />
      )
    },
    {
      field: 'status',
      headerName: t('trades.table.status'),
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          size="small"
          label={t(`trades.status.${params.value}`)}
          color={params.value === 'CLOSED' ? 'primary' : 'warning'}
          variant="outlined"
        />
      )
    },
    { field: 'quantity', headerName: t('trades.table.qty'), flex: 0.9, valueFormatter: (params) => formatNumber(params.value, 2) },
    { field: 'entryPrice', headerName: t('trades.table.entry'), flex: 1, valueFormatter: (params) => formatCurrency(params.value, baseCurrency) },
    { field: 'exitPrice', headerName: t('trades.table.exit'), flex: 1, valueFormatter: (params) => formatCurrency(params.value, baseCurrency) },
    {
      field: 'pnlNet',
      headerName: t('trades.table.pnlNet'),
      flex: 1,
      valueFormatter: (params) => formatSignedCurrency(params.value, baseCurrency),
      cellClassName: (params) => (params.value || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'
    },
    { field: 'pnlPercent', headerName: t('trades.table.pnlPercent'), flex: 0.9, valueFormatter: (params) => formatPercent(params.value) },
    { field: 'rMultiple', headerName: t('trades.table.rMultiple'), flex: 0.9, valueFormatter: (params) => formatNumber(params.value, 2) },
    {
      field: 'notes',
      headerName: t('trades.table.notes'),
      flex: 1.4,
      renderCell: (params) => (
        <Tooltip title={params.value || t('trades.table.noNotes')}>
          <Typography variant="body2" noWrap>
            {params.value || t('common.na')}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: t('trades.table.actions'),
      sortable: false,
      filterable: false,
      align: 'center',
      headerAlign: 'center',
      minWidth: 150,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('trades.actions.createTradeNote')}>
            <IconButton
              size="small"
              aria-label={t('trades.actions.createTradeNote')}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                handleCreateTradeNote(params.row as TradeResponse)
              }}
            >
              <NoteAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" aria-label={t('trades.actions.editTrade')} onClick={() => handleEditClick(params.row as TradeResponse)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" aria-label={t('trades.actions.deleteTrade')} onClick={() => handleDeleteClick(params.row as TradeResponse)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      )
    }
  ], [baseCurrency, handleCreateTradeNote, handleDeleteClick, handleEditClick, t])

  const fetchTrades = useCallback(async () => {
    if (!isAuthenticated) {
      setTrades([])
      setTotalRows(0)
      setFetchError(t('trades.errors.loginRequired'))
      return
    }

    setLoading(true)
    setFetchError('')

    try {
      const response = viewMode === 'search' && activeFilters
        ? await searchTrades({
          ...activeFilters,
          direction: activeFilters.direction ? activeFilters.direction as 'LONG' | 'SHORT' : undefined,
          status: activeFilters.status ? activeFilters.status as 'OPEN' | 'CLOSED' : undefined,
          tz: activeFilters.closedDate ? (activeFilters.tz || timezone) : activeFilters.tz || undefined,
          page: paginationModel.page,
          size: paginationModel.pageSize,
        })
        : await listTrades({
          page: paginationModel.page,
          size: paginationModel.pageSize,
        })

      const rows = response.content || []
      setTrades(rows)
      setTotalRows(response.totalElements)
      setExpandedTrade((prev) => rows.find((t) => t.id === prev?.id) ?? null)
    } catch (err) {
      setTrades([])
      setExpandedTrade(null)
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setFetchError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.fetchFailed') : t('trades.errors.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeFilters, handleAuthFailure, isAuthenticated, paginationModel.page, paginationModel.pageSize, t, timezone, viewMode, refreshToken])

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    trackEvent('trade_import_start', {
      method: 'csv',
      success: true,
      feature_area: 'trades'
    })
    setImportLoading(true)
    setImportError('')
    try {
      const summary = await importTradesCsv(file)
      setImportSummary(summary)
      trackEvent('trade_import_success', {
        method: 'csv',
        success: true,
        total_rows: summary.totalRows,
        trades_created: summary.tradesCreated,
        trades_updated: summary.tradesUpdated,
        groups_skipped: summary.groupsSkipped,
        feature_area: 'trades'
      })
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      const errorCode = apiErr.code || (apiErr.status ? `HTTP_${apiErr.status}` : 'UNKNOWN')
      const errorMessage = apiErr.rawMessage || apiErr.message
      if (apiErr.status === 401 || apiErr.status === 403) {
        trackEvent('trade_import_fail', {
          method: 'csv',
          success: false,
          error_code: errorCode,
          error_message: errorMessage,
          feature_area: 'trades'
        })
        handleAuthFailure(apiErr.message)
        return
      }
      trackEvent('trade_import_fail', {
        method: 'csv',
        success: false,
        error_code: errorCode,
        error_message: errorMessage,
        feature_area: 'trades'
      })
      const message = apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.importFailed') : t('trades.errors.importFailed')
      setImportError(message)
    } finally {
      setImportLoading(false)
      event.target.value = ''
    }
  }, [fetchTrades, handleAuthFailure, t])

  const fetchContentOptions = useCallback(async () => {
    try {
      setOptionsLoadError('')
      const [strategies, dailyPlans, weeklyPlans] = await Promise.all([
        listPublishedContent({ type: 'STRATEGY', activeOnly: true }),
        listPublishedContent({ type: 'DAILY_PLAN', activeOnly: true }),
        listPublishedContent({ type: 'WEEKLY_PLAN', activeOnly: true })
      ])

      setStrategyOptions((strategies || []).map((item) => ({
        id: item.id,
        label: item.title
      })))

      const mappedPlans: ContentOption[] = []
      for (const item of [...(dailyPlans || []), ...(weeklyPlans || [])]) {
        const typeLabel = item.contentTypeDisplayName || item.contentTypeKey
        mappedPlans.push({
          id: item.id,
          label: `${item.title} (${typeLabel})`
        })
      }
      setPlanOptions(mappedPlans)
    } catch (err) {
      const apiErr = err as ApiError
      setOptionsLoadError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.loadOptionsFailed') : t('trades.errors.loadOptionsFailed'))
    }
  }, [t])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  useEffect(() => {
    fetchContentOptions()
  }, [fetchContentOptions])

  useEffect(() => {
    if (!location.search) return
    const params = new URLSearchParams(location.search)

    const shouldOpenQuickLog = params.get('quickLog') === '1'
    if (shouldOpenQuickLog) {
      const linkedRaw = params.get('linkedContentIds') || params.get('planId') || ''
      const linkedContentIds = linkedRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      const openedAt = new Date().toISOString().slice(0, 16)
      setQuickLogValues((prev) => ({
        ...prev,
        symbol: params.get('symbol') || prev.symbol,
        strategyTag: params.get('strategyTag') || prev.strategyTag,
        strategyId: params.get('strategyId') || prev.strategyId,
        linkedContentIds: linkedContentIds.length > 0 ? linkedContentIds : prev.linkedContentIds,
        openedAt
      }))
      setQuickLogError('')
      setQuickLogDialogOpen(true)
    }

    const tradeId = params.get('tradeId') || ''
    const closedDate = params.get('closedDate') || ''
    const nextFilters = {
      openedAtFrom: params.get('openedAtFrom') || '',
      openedAtTo: params.get('openedAtTo') || '',
      closedAtFrom: params.get('closedAtFrom') || '',
      closedAtTo: params.get('closedAtTo') || '',
      closedDate,
      tz: params.get('tz') || (closedDate ? timezone : ''),
      symbol: params.get('symbol') || '',
      direction: params.get('direction') || '',
      status: params.get('status') || '',
    }
    setHighlightTradeId(tradeId)
    const hasFilters = Object.values(nextFilters).some((value) => value !== '')
    if (!hasFilters) return
    setFilters(nextFilters)
    setActiveFilters(nextFilters)
    setViewMode('search')
    setPaginationModel((prev) => ({ ...prev, page: 0 }))
  }, [location.search, timezone])

  useEffect(() => {
    if (!highlightTradeId) return
    getTradeById(highlightTradeId)
      .then((trade) => setExpandedTrade(trade))
      .catch(() => {})
  }, [highlightTradeId])

  const handleCreate = async (values: TradeFormValues) => {
    setCreateSuccess('')
    setCreateError('')
    try {
      const payload = buildTradePayload(hydrateStrategyTag(values))
      await createTrade(payload)
      trackEvent('trade_create_submit', {
        method: 'manual_form',
        success: true,
        feature_area: 'trades'
      })
      setCreateSuccess(t('trades.messages.created'))
      const freshDefaults = buildDefaultValues()
      setCreateFormValues(freshDefaults)
      setCreateDialogOpen(false)
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      const errorCode = apiErr.code || (apiErr.status ? `HTTP_${apiErr.status}` : 'UNKNOWN')
      const errorMessage = apiErr.rawMessage || apiErr.message
      if (apiErr.status === 401 || apiErr.status === 403) {
        trackEvent('trade_create_submit', {
          method: 'manual_form',
          success: false,
          error_code: errorCode,
          error_message: errorMessage,
          feature_area: 'trades'
        })
        handleAuthFailure(apiErr.message)
        return
      }
      trackEvent('trade_create_submit', {
        method: 'manual_form',
        success: false,
        error_code: errorCode,
        error_message: errorMessage,
        feature_area: 'trades'
      })
      setCreateError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.createFailed') : t('trades.errors.createFailed'))
    }
  }

  const handleUpdateTrade = async (values: TradeFormValues) => {
    if (!editTarget) return
    setEditError('')
    try {
      const payload = buildTradePayload(hydrateStrategyTag(values))
      const updated = await updateTrade(editTarget.id, payload)
      setTrades((prev) => prev.map((t) => t.id === updated.id ? updated : t))
      setExpandedTrade((prev) => prev?.id === updated.id ? updated : prev)
      setEditDialogOpen(false)
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setEditError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.updateFailed') : t('trades.errors.updateFailed'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteError('')
    try {
      await deleteTrade(deleteTarget.id)
      setTrades((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setTotalRows((prev) => Math.max(prev - 1, 0))
      if (expandedTrade?.id === deleteTarget.id) {
        setExpandedTrade(null)
      }
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setDeleteError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.deleteFailed') : t('trades.errors.deleteFailed'))
    } finally {
      setDeleteTarget(null)
    }
  }

  const onSearch = () => {
    trackEvent('filter_apply', {
      method: 'manual_search',
      success: true,
      filter_count: countActiveFilters(filters),
      feature_area: 'trades'
    })
    setActiveFilters(filters)
    setViewMode('search')
    setPaginationModel((prev) => ({ ...prev, page: 0 }))
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
    setActiveFilters(null)
    setViewMode('list')
    setPaginationModel((prev) => ({ ...prev, page: 0 }))
  }

  const openCreateDialog = () => {
    setCreateError('')
    setCreateDialogOpen(true)
  }

  const openQuickLogDialog = () => {
    setQuickLogError('')
    setQuickLogDialogOpen(true)
  }

  const updateQuickLogValue = <K extends keyof TradeFormValues>(key: K, value: TradeFormValues[K]) => {
    setQuickLogValues((prev) => ({ ...prev, [key]: value }))
  }

  const submitQuickLog = async () => {
    setQuickLogError('')
    if (!quickLogValues.symbol.trim()) {
      setQuickLogError(t('trades.errors.symbolRequired'))
      return
    }
    if (!quickLogValues.openedAt) {
      setQuickLogError(t('trades.errors.openedAtRequired'))
      return
    }
    if (quickLogValues.status === 'CLOSED' && (quickLogValues.exitPrice === undefined || Number.isNaN(quickLogValues.exitPrice))) {
      setQuickLogError(t('trades.errors.exitPriceRequired'))
      return
    }
    try {
      const payload = buildTradePayload(hydrateStrategyTag(quickLogValues))
      await createTrade(payload)
      setQuickLogDialogOpen(false)
      setQuickLogValues({
        ...buildDefaultValues(),
        market: 'FOREX',
        quantity: 1,
        openedAt: new Date().toISOString().slice(0, 16)
      })
      setCreateSuccess(t('trades.messages.created'))
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setQuickLogError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.createFailed') : t('trades.errors.createFailed'))
    }
  }

  const renderTradesTable = () => (
    <Box sx={{ height: 520, width: '100%', position: 'relative', overflowX: 'auto' }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(theme.palette.background.default, 0.72),
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      <DataGrid
        rows={trades}
        columns={columns}
        rowCount={totalRows}
        loading={loading}
        density="compact"
        pageSizeOptions={[5, 10, 25]}
        paginationModel={paginationModel}
        paginationMode="server"
        onPaginationModelChange={setPaginationModel}
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        initialState={{
          sorting: {
            sortModel: [{ field: 'openedAt', sort: 'desc' }],
          },
        }}
        sx={{
          minWidth: 800,
          '& .pnl-positive': { color: 'success.main', fontWeight: 600 },
          '& .pnl-negative': { color: 'error.main', fontWeight: 600 },
          '& .trade-row-highlight': {
            backgroundColor: 'action.selected'
          }
        }}
        getRowClassName={(params) => (params.id === highlightTradeId ? 'trade-row-highlight' : '')}
        onRowClick={(params) => setExpandedTrade((prev) => prev?.id === params.id ? null : params.row as TradeResponse)}
      />
      {!loading && trades.length === 0 && (
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <EmptyState
            title={t('trades.empty.title')}
            description={t('trades.empty.body')}
          />
        </Box>
      )}
    </Box>
  )

  const renderTradeCards = () => (
    <Stack spacing={2}>
      {trades.map((trade) => (
        <Paper key={trade.id} sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6">{trade.symbol}</Typography>
                <Typography variant="body2" color="text.secondary">{formatDateTime(trade.openedAt)}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip size="small" label={t(`trades.direction.${trade.direction}`)} color={trade.direction === 'LONG' ? 'success' : 'error'} variant="outlined" />
                <Chip size="small" label={t(`trades.status.${trade.status}`)} color={trade.status === 'CLOSED' ? 'primary' : 'warning'} variant="outlined" />
              </Stack>
            </Stack>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2">{t('trades.card.entry')}: {formatCurrency(trade.entryPrice, baseCurrency)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">{t('trades.card.exit')}: {formatCurrency(trade.exitPrice, baseCurrency)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">{t('trades.card.pnl')}: {formatSignedCurrency(trade.pnlNet, baseCurrency)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">{t('trades.card.pnlPercent')}: {formatPercent(trade.pnlPercent)}</Typography>
              </Grid>
            </Grid>
            <Typography variant="body2" color="text.secondary">{t('trades.card.notes')}: {trade.notes || t('common.na')}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {trade.strategyId && (
                <Chip size="small" variant="outlined" label={strategyNameById.get(trade.strategyId) || trade.strategyTag || t('common.na')} />
              )}
              {trade.setupGrade && (
                <Chip size="small" variant="outlined" label={`${t('trades.form.setupGrade')}: ${trade.setupGrade}`} />
              )}
              {trade.session && (
                <Chip size="small" variant="outlined" label={`${t('trades.form.session')}: ${t(`trades.form.sessions.${trade.session}`)}`} />
              )}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditClick(trade)}>{t('common.edit')}</Button>
              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteClick(trade)}>{t('common.delete')}</Button>
            </Stack>
          </Stack>
        </Paper>
      ))}
      {!loading && trades.length === 0 && (
        <EmptyState
          title={t('trades.empty.title')}
          description={t('trades.empty.body')}
        />
      )}
    </Stack>
  )

  return (
    <Stack spacing={3} sx={{ pb: { xs: 'calc(84px + env(safe-area-inset-bottom))', md: 0 } }}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} mb={2} spacing={1.25}>
            <Typography variant="h6">{t('trades.list.title')}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              {viewMode === 'search' && <Alert severity="info" sx={{ m: 0, py: 0.5 }}>{t('trades.list.searchResults')}</Alert>}
              <Button
                variant="outlined"
                size="small"
                onClick={openQuickLogDialog}
              >
                {t('trades.quickLog.title')}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              >
                {t('trades.create.title')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={importLoading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                onClick={handleImportClick}
                disabled={importLoading}
              >
                {t('trades.list.importCsv')}
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv"
                hidden
                onChange={handleImportChange}
              />
            </Stack>
          </Stack>
          {createSuccess && <Alert severity="success" sx={{ mb: 2 }}>{createSuccess}</Alert>}
          {fetchError && <ErrorBanner message={fetchError} />}
          {noteNavError && <ErrorBanner message={noteNavError} />}
          {optionsLoadError && <Alert severity="warning" sx={{ mb: 2 }}>{optionsLoadError}</Alert>}
          {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}
          {importSummary && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                {t('trades.import.summary', { rows: importSummary.totalRows, groups: importSummary.isinGroups })}
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.tradesCreated')}</Typography>
                  <Typography>{importSummary.tradesCreated}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.tradesUpdated')}</Typography>
                  <Typography>{importSummary.tradesUpdated}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.groupsSkipped')}</Typography>
                  <Typography>{importSummary.groupsSkipped}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.isinGroups')}</Typography>
                  <Typography>{importSummary.isinGroups}</Typography>
                </Grid>
              </Grid>
              {importSummary.groupResults?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>{t('trades.import.perIsinResults')}</Typography>
                  <Stack spacing={1}>
                    {importSummary.groupResults.map((result) => (
                      <Alert
                        key={`${result.isin}-${result.status}`}
                        severity={result.status === 'SKIPPED' ? 'warning' : 'success'}
                      >
                        <strong>{result.isin}</strong>: {result.status === 'SKIPPED' ? t('trades.import.status.SKIPPED') : t('trades.import.status.IMPORTED')}
                        {result.reason ? ` — ${result.reason}` : ''}
                      </Alert>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          )}
          {isSmallScreen ? renderTradeCards() : renderTradesTable()}
          {expandedTrade && !isSmallScreen && (
            <Box sx={{ mt: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>{t('trades.details.title')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" gutterBottom>{t('trades.details.stopsAndTargets')}</Typography>
                  <Typography variant="body2">{t('trades.details.stopLoss')}: {formatCurrency(expandedTrade.stopLossPrice, baseCurrency)}</Typography>
                  <Typography variant="body2">{t('trades.details.takeProfit')}: {formatCurrency(expandedTrade.takeProfitPrice, baseCurrency)}</Typography>
                  <Typography variant="body2">{t('trades.details.timeframe')}: {expandedTrade.timeframe || t('common.na')}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" gutterBottom>{t('trades.details.costsAndRisk')}</Typography>
                  <Typography variant="body2">{t('trades.form.fees')}: {formatCurrency(expandedTrade.fees, baseCurrency)}</Typography>
                  <Typography variant="body2">{t('trades.form.commission')}: {formatCurrency(expandedTrade.commission, baseCurrency)}</Typography>
                  <Typography variant="body2">{t('trades.form.slippage')}: {formatCurrency(expandedTrade.slippage, baseCurrency)}</Typography>
                  <Typography variant="body2">{t('trades.details.risk')}: {formatCurrency(expandedTrade.riskAmount, baseCurrency)} ({formatPercent(expandedTrade.riskPercent)})</Typography>
                  <Typography variant="body2">{t('trades.form.rMultiple')}: {formatNumber(expandedTrade.rMultiple)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" gutterBottom>{t('trades.details.setup')}</Typography>
                  <Typography variant="body2">{t('trades.form.setup')}: {expandedTrade.setup || t('common.na')}</Typography>
                  <Typography variant="body2">{t('trades.form.strategy')}: {(expandedTrade.strategyId ? strategyNameById.get(expandedTrade.strategyId) : expandedTrade.strategyTag) || t('common.na')}</Typography>
                  <Typography variant="body2">{t('trades.form.strategyTag')}: {expandedTrade.strategyTag || t('common.na')}</Typography>
                  <Typography variant="body2">{t('trades.form.catalystTag')}: {expandedTrade.catalystTag || t('common.na')}</Typography>
                  <Typography variant="body2">{t('trades.form.setupGrade')}: {expandedTrade.setupGrade || t('common.na')}</Typography>
                  <Typography variant="body2">{t('trades.form.session')}: {expandedTrade.session ? t(`trades.form.sessions.${expandedTrade.session}`) : t('common.na')}</Typography>
                  <Typography variant="body2">{t('trades.form.linkedPlans')}: {(expandedTrade.linkedContentIds || []).length}</Typography>
                  <Typography variant="body2">{t('trades.form.capitalUsed')}: {formatCurrency(expandedTrade.capitalUsed, baseCurrency)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>{t('trades.details.notesAndTags')}</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>{expandedTrade.notes || t('common.na')}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(expandedTrade.tags || []).map((tag: string) => (
                      <Chip key={tag} label={tag} size="small" color="info" variant="outlined" />
                    ))}
                    {(expandedTrade.ruleBreaks || []).map((rule) => (
                      <Chip key={rule} label={t(`trades.form.ruleBreakOptions.${rule}`)} size="small" color="warning" variant="outlined" />
                    ))}
                    {((expandedTrade.tags?.length || 0) + (expandedTrade.ruleBreaks?.length || 0)) === 0 && (
                      <Typography variant="body2" color="text.secondary">{t('trades.details.noTags')}</Typography>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Accordion defaultExpanded={!isSmallScreen}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('trades.filters.title')}</AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.openedFrom')} type="datetime-local" value={filters.openedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField size="small" label={t('trades.filters.openedTo')} type="datetime-local" value={filters.openedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.closedFrom')} type="datetime-local" value={filters.closedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField size="small" label={t('trades.filters.closedTo')} type="datetime-local" value={filters.closedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.symbol')} value={filters.symbol} onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))} fullWidth />
                    <TextField size="small" label={t('trades.filters.direction')} select value={filters.direction} onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value }))} fullWidth>
                      <MenuItem value="">{t('trades.filters.any')}</MenuItem>
                      <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                      <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.status')} select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} fullWidth>
                      <MenuItem value="">{t('trades.filters.any')}</MenuItem>
                      <MenuItem value="OPEN">{t('trades.status.OPEN')}</MenuItem>
                      <MenuItem value="CLOSED">{t('trades.status.CLOSED')}</MenuItem>
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button variant="contained" onClick={onSearch} fullWidth={isSmallScreen}>{t('common.search')}</Button>
                    <Button variant="outlined" onClick={clearFilters} fullWidth={isSmallScreen}>{t('trades.filters.clear')}</Button>
                  </Stack>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('trades.help.title')}</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('trades.help.sections.corePricing')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.entryExit')}</strong>: {t('trades.help.corePricing.entryExitBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.directionMarket')}</strong>: {t('trades.help.corePricing.directionMarketBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.status')}</strong>: {t('trades.help.corePricing.statusBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.capitalUsed')}</strong>: {t('trades.help.corePricing.capitalUsedBody')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('trades.help.sections.pnlAndRisk')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.feesCosts')}</strong>: {t('trades.help.pnlAndRisk.feesCostsBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.pnlGross')}</strong>: {t('trades.help.pnlAndRisk.pnlGrossBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.pnlNet')}</strong>: {t('trades.help.pnlAndRisk.pnlNetBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.pnlPercent')}</strong>: {t('trades.help.pnlAndRisk.pnlPercentBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.riskAmountPercent')}</strong>: {t('trades.help.pnlAndRisk.riskAmountPercentBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.rMultiple')}</strong>: {t('trades.help.pnlAndRisk.rMultipleBody')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('trades.help.sections.context')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('trades.help.context.timeframe')}</strong>: {t('trades.help.context.timeframeBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.context.setupStrategyCatalyst')}</strong>: {t('trades.help.context.setupStrategyCatalystBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.context.statusDirection')}</strong>: {t('trades.help.context.statusDirectionBody')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      <Box
        sx={(theme) => ({
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 'calc(10px + env(safe-area-inset-bottom))',
          zIndex: theme.zIndex.appBar + 1,
          display: { xs: 'block', md: 'none' }
        })}
      >
        <Button fullWidth variant="contained" size="large" startIcon={<AddIcon />} onClick={openCreateDialog}>
          {t('trades.create.title')}
        </Button>
      </Box>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isSmallScreen}
        keepMounted
      >
        <DialogTitle>{t('trades.create.title')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TradeForm
            initialValues={createFormValues}
            submitLabel={t('trades.create.save')}
            onSubmit={handleCreate}
            onCancel={() => setCreateDialogOpen(false)}
            error={createError}
            stickyActions={isSmallScreen}
            strategyOptions={strategyOptions}
            planOptions={planOptions}
            ruleBreakOptions={[...ruleBreakOptions]}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('trades.actions.editTrade')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {editTarget && (
            <TradeForm
              initialValues={mapTradeToFormValues(editTarget)}
              submitLabel={t('trades.actions.updateTrade')}
              onSubmit={handleUpdateTrade}
              onCancel={() => setEditDialogOpen(false)}
              error={editError}
              computedValues={{
                pnlGross: editTarget.pnlGross,
                pnlNet: editTarget.pnlNet,
                pnlPercent: editTarget.pnlPercent,
                riskPercent: editTarget.riskPercent,
                rMultiple: editTarget.rMultiple,
              }}
              strategyOptions={strategyOptions}
              planOptions={planOptions}
              ruleBreakOptions={[...ruleBreakOptions]}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={quickLogDialogOpen}
        onClose={() => setQuickLogDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isSmallScreen}
      >
        <DialogTitle>{t('trades.quickLog.title')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            {quickLogError && <Alert severity="error">{quickLogError}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.symbol')}
                  value={quickLogValues.symbol}
                  onChange={(event) => updateQuickLogValue('symbol', event.target.value)}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.market')}
                  select
                  value={quickLogValues.market}
                  onChange={(event) => updateQuickLogValue('market', event.target.value as TradeFormValues['market'])}
                  fullWidth
                >
                  <MenuItem value="STOCK">{t('trades.market.STOCK')}</MenuItem>
                  <MenuItem value="CFD">{t('trades.market.CFD')}</MenuItem>
                  <MenuItem value="FOREX">{t('trades.market.FOREX')}</MenuItem>
                  <MenuItem value="CRYPTO">{t('trades.market.CRYPTO')}</MenuItem>
                  <MenuItem value="FUTURES">{t('trades.market.FUTURES')}</MenuItem>
                  <MenuItem value="OPTIONS">{t('trades.market.OPTIONS')}</MenuItem>
                  <MenuItem value="OTHER">{t('trades.market.OTHER')}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.direction')}
                  select
                  value={quickLogValues.direction}
                  onChange={(event) => updateQuickLogValue('direction', event.target.value as TradeFormValues['direction'])}
                  fullWidth
                >
                  <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                  <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.status')}
                  select
                  value={quickLogValues.status}
                  onChange={(event) => updateQuickLogValue('status', event.target.value as TradeFormValues['status'])}
                  fullWidth
                >
                  <MenuItem value="OPEN">{t('trades.status.OPEN')}</MenuItem>
                  <MenuItem value="CLOSED">{t('trades.status.CLOSED')}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.openedAt')}
                  type="datetime-local"
                  value={quickLogValues.openedAt}
                  onChange={(event) => updateQuickLogValue('openedAt', event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                />
              </Grid>
              {quickLogValues.status === 'CLOSED' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('trades.form.closedAt')}
                    type="datetime-local"
                    value={quickLogValues.closedAt || ''}
                    onChange={(event) => updateQuickLogValue('closedAt', event.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={4}>
                <TextField
                  label={t('trades.form.quantity')}
                  type="number"
                  value={quickLogValues.quantity}
                  onChange={(event) => updateQuickLogValue('quantity', Number(event.target.value))}
                  inputProps={{ step: '0.01' }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={t('trades.form.entryPrice')}
                  type="number"
                  value={quickLogValues.entryPrice}
                  onChange={(event) => updateQuickLogValue('entryPrice', Number(event.target.value))}
                  inputProps={{ step: '0.000001' }}
                  fullWidth
                />
              </Grid>
              {quickLogValues.status === 'CLOSED' && (
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('trades.form.exitPrice')}
                    type="number"
                    value={quickLogValues.exitPrice ?? ''}
                    onChange={(event) => updateQuickLogValue('exitPrice', Number(event.target.value))}
                    inputProps={{ step: '0.000001' }}
                    fullWidth
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.strategy')}
                  select
                  value={quickLogValues.strategyId || ''}
                  onChange={(event) => updateQuickLogValue('strategyId', event.target.value)}
                  fullWidth
                >
                  <MenuItem value="">{t('trades.form.none')}</MenuItem>
                  {strategyOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.linkedPlans')}
                  select
                  value={quickLogValues.linkedContentIds || []}
                  onChange={(event) => {
                    const value = event.target.value
                    updateQuickLogValue('linkedContentIds', typeof value === 'string' ? value.split(',') : value)
                  }}
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) => {
                      const selectedIds = selected as string[]
                      if (selectedIds.length === 0) {
                        return t('trades.form.none')
                      }
                      return selectedIds
                        .map((id) => planOptions.find((option) => option.id === id)?.label || id)
                        .slice(0, 2)
                        .join(', ')
                    }
                  }}
                  fullWidth
                >
                  {planOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.setupGrade')}
                  select
                  value={quickLogValues.setupGrade || ''}
                  onChange={(event) => updateQuickLogValue('setupGrade', (event.target.value || undefined) as TradeFormValues['setupGrade'])}
                  fullWidth
                >
                  <MenuItem value="">{t('trades.form.none')}</MenuItem>
                  <MenuItem value="A">A</MenuItem>
                  <MenuItem value="B">B</MenuItem>
                  <MenuItem value="C">C</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('trades.form.session')}
                  select
                  value={quickLogValues.session || ''}
                  onChange={(event) => updateQuickLogValue('session', (event.target.value || undefined) as TradeFormValues['session'])}
                  fullWidth
                >
                  <MenuItem value="">{t('trades.form.none')}</MenuItem>
                  <MenuItem value="ASIA">{t('trades.form.sessions.ASIA')}</MenuItem>
                  <MenuItem value="LONDON">{t('trades.form.sessions.LONDON')}</MenuItem>
                  <MenuItem value="NY">{t('trades.form.sessions.NY')}</MenuItem>
                  <MenuItem value="CUSTOM">{t('trades.form.sessions.CUSTOM')}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={t('trades.form.notes')}
                  value={quickLogValues.notes || ''}
                  onChange={(event) => updateQuickLogValue('notes', event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickLogDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={submitQuickLog}>{t('trades.quickLog.submit')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('trades.actions.deleteTrade')}</DialogTitle>
        <DialogContent>
          <Typography>{t('trades.deleteConfirm', { symbol: deleteTarget?.symbol || '' })}</Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

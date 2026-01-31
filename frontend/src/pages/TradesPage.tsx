import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
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
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import { useLocation, useNavigate } from 'react-router-dom'
import { TradeResponse, createTrade, deleteTrade, listTrades, searchTrades, updateTrade } from '../api/trades'
import { createNotebookNote } from '../api/notebook'
import { TradeFormValues, buildTradePayload } from '../utils/tradePayload'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatSignedCurrency } from '../utils/format'
import { TradeForm } from '../components/trades/TradeForm'

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
  pnlGross: undefined,
  pnlNet: undefined,
  pnlPercent: undefined,
  riskAmount: undefined,
  riskPercent: undefined,
  rMultiple: undefined,
  capitalUsed: undefined,
  setup: '',
  strategyTag: '',
  catalystTag: '',
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
    pnlGross: trade.pnlGross ?? undefined,
    pnlNet: trade.pnlNet ?? undefined,
    pnlPercent: trade.pnlPercent ?? undefined,
    riskAmount: trade.riskAmount ?? undefined,
    riskPercent: trade.riskPercent ?? undefined,
    rMultiple: trade.rMultiple ?? undefined,
    capitalUsed: trade.capitalUsed ?? undefined,
    setup: trade.setup ?? '',
    strategyTag: trade.strategyTag ?? '',
    catalystTag: trade.catalystTag ?? '',
    notes: trade.notes ?? '',
    accountId: trade.accountId ?? ''
  }
}

export default function TradesPage() {
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
  const baseCurrency = user?.baseCurrency || 'USD'
  const timezone = user?.timezone || 'Europe/Bucharest'
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'))

  useEffect(() => {
    console.log('[TradesPage] render', new Date().toISOString())
  })

  const [viewMode, setViewMode] = useState<'list' | 'search'>('list')
  const [filters, setFilters] = useState(defaultFilters)
  const [activeFilters, setActiveFilters] = useState<typeof defaultFilters | null>(null)

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  })
  const [expandedTrade, setExpandedTrade] = useState<TradeResponse | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TradeResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TradeResponse | null>(null)
  const [createFormValues, setCreateFormValues] = useState<TradeFormValues>(buildDefaultValues())

  const handleAuthFailure = useCallback((message?: string) => {
    setFetchError(message || 'Please login to view trades')
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }, [location.pathname, logout, navigate])

  const handleEditClick = useCallback((trade: TradeResponse) => {
    setEditTarget(trade)
    setEditError('')
    setEditDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback((trade: TradeResponse) => {
    setDeleteTarget(trade)
    setDeleteError('')
  }, [])

  const handleCreateTradeNote = useCallback(async (trade: TradeResponse) => {
    console.log('[TradesPage] handleCreateTradeNote START', { tradeId: trade.id, symbol: trade.symbol })
    setNoteNavError('')
    try {
      console.log('[TradesPage] Calling createNotebookNote...')
      const note = await createNotebookNote({
        type: 'TRADE_NOTE',
        title: `${trade.symbol} trade note`,
        relatedTradeId: trade.id
      })
      console.log('[TradesPage] createNotebookNote response', note)
      const noteId = (note as any)?.id
      if (!noteId) {
        console.error('[TradesPage] Missing note.id in response')
        setNoteNavError('Note was created but response did not include an id. Please refresh the page and open the note manually.')
        return
      }
      const target = `/notebook?noteId=${noteId}`
      console.log('[TradesPage] Navigating to', target)
      navigate(target)
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      const message = apiErr instanceof Error ? apiErr.message : 'Failed to create trade note'
      setEditError(message)
      setNoteNavError(message)
      console.error('[TradesPage] Error creating note', apiErr)
    }
  }, [handleAuthFailure, navigate])

  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'openedAt',
      headerName: 'Opened',
      flex: 1.1,
      minWidth: 170,
      valueFormatter: (params) => formatDateTime(params.value),
      sortComparator: (a, b) => new Date(a as string).getTime() - new Date(b as string).getTime()
    },
    { field: 'symbol', headerName: 'Symbol', flex: 1, minWidth: 110 },
    { field: 'market', headerName: 'Market', flex: 1, minWidth: 110 },
    {
      field: 'direction',
      headerName: 'Direction',
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value}
          color={params.value === 'LONG' ? 'success' : 'error'}
          variant="outlined"
        />
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value}
          color={params.value === 'CLOSED' ? 'primary' : 'warning'}
          variant="outlined"
        />
      )
    },
    { field: 'quantity', headerName: 'Qty', flex: 0.9, valueFormatter: (params) => formatNumber(params.value, 2) },
    { field: 'entryPrice', headerName: 'Entry', flex: 1, valueFormatter: (params) => formatCurrency(params.value, baseCurrency) },
    { field: 'exitPrice', headerName: 'Exit', flex: 1, valueFormatter: (params) => formatCurrency(params.value, baseCurrency) },
    {
      field: 'pnlNet',
      headerName: 'PnL (net)',
      flex: 1,
      valueFormatter: (params) => formatSignedCurrency(params.value, baseCurrency),
      cellClassName: (params) => (params.value || 0) >= 0 ? 'pnl-positive' : 'pnl-negative'
    },
    { field: 'pnlPercent', headerName: 'PnL %', flex: 0.9, valueFormatter: (params) => formatPercent(params.value) },
    { field: 'rMultiple', headerName: 'R multiple', flex: 0.9, valueFormatter: (params) => formatNumber(params.value, 2) },
    {
      field: 'notes',
      headerName: 'Notes',
      flex: 1.4,
      renderCell: (params) => (
        <Tooltip title={params.value || 'No notes'}>
          <Typography variant="body2" noWrap>
            {params.value || '—'}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      filterable: false,
      align: 'center',
      headerAlign: 'center',
      minWidth: 150,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Create trade note">
            <IconButton
              size="small"
              aria-label="Create trade note"
              type="button"
              onClick={(e) => {
                e.preventDefault()
                handleCreateTradeNote(params.row as TradeResponse)
              }}
            >
              <NoteAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" aria-label="Edit trade" onClick={() => handleEditClick(params.row as TradeResponse)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" aria-label="Delete trade" onClick={() => handleDeleteClick(params.row as TradeResponse)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      )
    }
  ], [baseCurrency, handleCreateTradeNote, handleDeleteClick, handleEditClick])

  const fetchTrades = useCallback(async () => {
    if (!isAuthenticated) {
      setTrades([])
      setTotalRows(0)
      setFetchError('Please login to view trades')
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
      setFetchError(apiErr instanceof Error ? apiErr.message : 'Failed to fetch trades')
    } finally {
      setLoading(false)
    }
  }, [activeFilters, handleAuthFailure, isAuthenticated, paginationModel.page, paginationModel.pageSize, timezone, viewMode])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  useEffect(() => {
    if (!location.search) return
    const params = new URLSearchParams(location.search)
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
    const hasFilters = Object.values(nextFilters).some((value) => value !== '')
    if (!hasFilters) return
    setFilters(nextFilters)
    setActiveFilters(nextFilters)
    setViewMode('search')
    setPaginationModel((prev) => ({ ...prev, page: 0 }))
  }, [location.search, timezone])

  const handleCreate = async (values: TradeFormValues) => {
    setCreateSuccess('')
    setCreateError('')
    try {
      const payload = buildTradePayload(values)
      await createTrade(payload)
      setCreateSuccess('Trade created successfully')
      const freshDefaults = buildDefaultValues()
      setCreateFormValues(freshDefaults)
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setCreateError(apiErr instanceof Error ? apiErr.message : 'Failed to create trade')
    }
  }

  const handleUpdateTrade = async (values: TradeFormValues) => {
    if (!editTarget) return
    setEditError('')
    try {
      const payload = buildTradePayload(values)
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
      setEditError(apiErr instanceof Error ? apiErr.message : 'Failed to update trade')
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
      setDeleteError(apiErr instanceof Error ? apiErr.message : 'Failed to delete trade')
    } finally {
      setDeleteTarget(null)
    }
  }

  const onSearch = () => {
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
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
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
          '& .pnl-positive': { color: 'success.main' },
          '& .pnl-negative': { color: 'error.main' },
        }}
        onRowClick={(params) => setExpandedTrade((prev) => prev?.id === params.id ? null : params.row as TradeResponse)}
      />
      {!loading && trades.length === 0 && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">No trades to display</Typography>
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
                <Chip size="small" label={trade.direction} color={trade.direction === 'LONG' ? 'success' : 'error'} variant="outlined" />
                <Chip size="small" label={trade.status} color={trade.status === 'CLOSED' ? 'primary' : 'warning'} variant="outlined" />
              </Stack>
            </Stack>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2">Entry: {formatCurrency(trade.entryPrice, baseCurrency)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">Exit: {formatCurrency(trade.exitPrice, baseCurrency)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">PnL: {formatSignedCurrency(trade.pnlNet, baseCurrency)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">PnL %: {formatPercent(trade.pnlPercent)}</Typography>
              </Grid>
            </Grid>
            <Typography variant="body2" color="text.secondary">Notes: {trade.notes || '—'}</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditClick(trade)}>Edit</Button>
              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteClick(trade)}>Delete</Button>
            </Stack>
          </Stack>
        </Paper>
      ))}
      {!loading && trades.length === 0 && (
        <Typography color="text.secondary" textAlign="center">No trades to display</Typography>
      )}
    </Stack>
  )

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} mb={2}>
        <Box>
          <Typography variant="h5">Trades</Typography>
          <Typography variant="subtitle1" color="text.secondary">Log new trades, edit history, and review details inline.</Typography>
        </Box>
      </Stack>

      <Stack spacing={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Create Trade
          </Typography>
          {createSuccess && <Alert severity="success" sx={{ mb: 2 }}>{createSuccess}</Alert>}
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <TradeForm
            initialValues={createFormValues}
            submitLabel="Save trade"
            onSubmit={handleCreate}
          />
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Filters</AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField label="Opened From" type="datetime-local" value={filters.openedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField label="Opened To" type="datetime-local" value={filters.openedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField label="Closed From" type="datetime-local" value={filters.closedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField label="Closed To" type="datetime-local" value={filters.closedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField label="Symbol" value={filters.symbol} onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))} fullWidth />
                    <TextField label="Direction" select value={filters.direction} onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value }))} fullWidth>
                      <MenuItem value="">Any</MenuItem>
                      <MenuItem value="LONG">Long</MenuItem>
                      <MenuItem value="SHORT">Short</MenuItem>
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField label="Status" select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} fullWidth>
                      <MenuItem value="">Any</MenuItem>
                      <MenuItem value="OPEN">Open</MenuItem>
                      <MenuItem value="CLOSED">Closed</MenuItem>
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button variant="contained" onClick={onSearch} fullWidth={isSmallScreen}>Search</Button>
                    <Button variant="outlined" onClick={clearFilters} fullWidth={isSmallScreen}>Clear filters</Button>
                  </Stack>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={2} spacing={1}>
            <Typography variant="h6">Trades List</Typography>
            {viewMode === 'search' && <Alert severity="info" sx={{ m: 0, py: 0.5 }}>Showing search results</Alert>}
          </Stack>
          {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}
          {noteNavError && <Alert severity="error" sx={{ mb: 2 }}>{noteNavError}</Alert>}
          {isSmallScreen ? renderTradeCards() : renderTradesTable()}
          {expandedTrade && !isSmallScreen && (
            <Box sx={{ mt: 2, bgcolor: 'grey.50', borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Trade details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" gutterBottom>Stops & targets</Typography>
                  <Typography variant="body2">Stop loss: {formatCurrency(expandedTrade.stopLossPrice, baseCurrency)}</Typography>
                  <Typography variant="body2">Take profit: {formatCurrency(expandedTrade.takeProfitPrice, baseCurrency)}</Typography>
                  <Typography variant="body2">Timeframe: {expandedTrade.timeframe || '—'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" gutterBottom>Costs & risk</Typography>
                  <Typography variant="body2">Fees: {formatCurrency(expandedTrade.fees, baseCurrency)}</Typography>
                  <Typography variant="body2">Commission: {formatCurrency(expandedTrade.commission, baseCurrency)}</Typography>
                  <Typography variant="body2">Slippage: {formatCurrency(expandedTrade.slippage, baseCurrency)}</Typography>
                  <Typography variant="body2">Risk: {formatCurrency(expandedTrade.riskAmount, baseCurrency)} ({formatPercent(expandedTrade.riskPercent)})</Typography>
                  <Typography variant="body2">R multiple: {formatNumber(expandedTrade.rMultiple)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" gutterBottom>Setup</Typography>
                  <Typography variant="body2">Setup: {expandedTrade.setup || '—'}</Typography>
                  <Typography variant="body2">Strategy: {expandedTrade.strategyTag || '—'}</Typography>
                  <Typography variant="body2">Catalyst: {expandedTrade.catalystTag || '—'}</Typography>
                  <Typography variant="body2">Capital used: {formatCurrency(expandedTrade.capitalUsed, baseCurrency)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Notes & tags</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>{expandedTrade.notes || '—'}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(expandedTrade.tags || []).map((tag: string) => (
                      <Chip key={tag} label={tag} size="small" color="info" variant="outlined" />
                    ))}
                    {(expandedTrade.tags?.length || 0) === 0 && <Typography variant="body2" color="text.secondary">No tags</Typography>}
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Trade field explanations</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Core pricing & execution</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Entry / Exit / SL / TP</strong>: Prices for entering and exiting the trade plus optional stop loss and take profit anchors.</Typography>
                <Typography variant="body2"><strong>Direction & Market</strong>: Whether the position is LONG or SHORT and the instrument type (stock, forex, crypto, etc.).</Typography>
                <Typography variant="body2"><strong>Status</strong>: OPEN or CLOSED. OpenedAt marks when the position was opened; ClosedAt is set when it is closed.</Typography>
                <Typography variant="body2"><strong>Capital Used</strong>: Cash or margin allocated to this trade.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>P&L and risk</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Fees / Commission / Slippage</strong>: All trading costs deducted from gross PnL.</Typography>
                <Typography variant="body2"><strong>PnL Gross</strong>: (Exit − Entry) × Quantity (flipped for SHORT) before costs.</Typography>
                <Typography variant="body2"><strong>PnL Net</strong>: PnL Gross minus fees, commission, and slippage.</Typography>
                <Typography variant="body2"><strong>PnL Percent</strong>: PnL Net divided by capital used (or risk amount when provided), expressed as a percentage.</Typography>
                <Typography variant="body2"><strong>Risk Amount / Risk Percent</strong>: Monetary and percentage distance between entry and stop loss multiplied by quantity.</Typography>
                <Typography variant="body2"><strong>R Multiple</strong>: PnL Net divided by Risk Amount. 1R equals the initial risk.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Context</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Timeframe</strong>: Chart timeframe or holding period reference.</Typography>
                <Typography variant="body2"><strong>Setup / Strategy / Catalyst</strong>: Qualitative tags describing why the trade was taken.</Typography>
                <Typography variant="body2"><strong>Status & Direction</strong>: Quick at-a-glance orientation for dashboards and filters.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Stack>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit trade</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {editTarget && (
            <TradeForm
              initialValues={mapTradeToFormValues(editTarget)}
              submitLabel="Update trade"
              onSubmit={handleUpdateTrade}
              onCancel={() => setEditDialogOpen(false)}
              error={editError}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete trade</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete trade <strong>{deleteTarget?.symbol}</strong>?</Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

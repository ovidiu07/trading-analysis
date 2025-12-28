import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataGrid, GridColDef, GridPaginationModel, GridRowParams } from '@mui/x-data-grid'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { TradeResponse, createTrade, listTrades, searchTrades } from '../api/trades'
import { TradeFormValues, buildTradePayload } from '../utils/tradePayload'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatSignedCurrency } from '../utils/format'

const defaultValues: TradeFormValues = {
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
}

const defaultFilters = {
  openedAtFrom: '',
  openedAtTo: '',
  closedAtFrom: '',
  closedAtTo: '',
  symbol: '',
  direction: ''
}

export default function TradesPage() {
  const [trades, setTrades] = useState<TradeResponse[]>([])
  const [totalRows, setTotalRows] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<string>('')
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()

  const [viewMode, setViewMode] = useState<'list' | 'search'>('list')
  const [filters, setFilters] = useState(defaultFilters)
  const [activeFilters, setActiveFilters] = useState<typeof defaultFilters | null>(null)

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  })
  const [expandedTrade, setExpandedTrade] = useState<TradeResponse | null>(null)

  const handleAuthFailure = useCallback((message?: string) => {
    setFetchError(message || 'Please login to view trades')
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }, [location.pathname, logout, navigate])

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
    { field: 'quantity', headerName: 'Quantity', flex: 0.9, valueFormatter: (params) => formatNumber(params.value, 4) },
    { field: 'entryPrice', headerName: 'Entry', flex: 1, valueFormatter: (params) => formatCurrency(params.value) },
    { field: 'exitPrice', headerName: 'Exit', flex: 1, valueFormatter: (params) => formatCurrency(params.value) },
    {
      field: 'pnlNet',
      headerName: 'PnL (net)',
      flex: 1,
      valueFormatter: (params) => formatSignedCurrency(params.value),
      cellClassName: (params) => (params.value ?? 0) >= 0 ? 'pnl-positive' : 'pnl-negative'
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
  ], [])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TradeFormValues>({ defaultValues })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

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
  }, [activeFilters, handleAuthFailure, isAuthenticated, paginationModel.page, paginationModel.pageSize, viewMode])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  const onSubmit = async (values: TradeFormValues) => {
    setSuccess('')
    setError('')
    try {
      const payload = buildTradePayload(values)
      await createTrade(payload)
      setSuccess('Trade created successfully')
      reset({
        ...defaultValues,
        openedAt: new Date().toISOString().slice(0, 16),
      })
      // Refresh current view
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setError(apiErr instanceof Error ? apiErr.message : 'Failed to create trade')
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

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5">Trades</Typography>
          <Typography variant="subtitle1" color="text.secondary">Log new trades, search history, and review details inline.</Typography>
        </Box>
      </Stack>

      <Stack spacing={3}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Create Trade
          </Typography>
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <TextField label="Symbol" required defaultValue={defaultValues.symbol} error={!!errors.symbol} helperText={errors.symbol?.message} {...register('symbol', { required: 'Symbol is required' })} />
            <TextField label="Market" select required defaultValue={defaultValues.market} {...register('market', { required: true })}>
              <MenuItem value="STOCK">Stock</MenuItem>
              <MenuItem value="CFD">CFD</MenuItem>
              <MenuItem value="FOREX">Forex</MenuItem>
              <MenuItem value="CRYPTO">Crypto</MenuItem>
              <MenuItem value="FUTURES">Futures</MenuItem>
              <MenuItem value="OPTIONS">Options</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </TextField>
            <TextField label="Direction" select required defaultValue={defaultValues.direction} {...register('direction', { required: true })}>
              <MenuItem value="LONG">Long</MenuItem>
              <MenuItem value="SHORT">Short</MenuItem>
            </TextField>
            <TextField label="Status" select required defaultValue={defaultValues.status} {...register('status', { required: true })}>
              <MenuItem value="OPEN">Open</MenuItem>
              <MenuItem value="CLOSED">Closed</MenuItem>
            </TextField>
            <TextField label="Opened At" type="datetime-local" required defaultValue={defaultValues.openedAt} {...register('openedAt', { required: true })} InputLabelProps={{ shrink: true }} />
            <TextField label="Closed At" type="datetime-local" defaultValue={defaultValues.closedAt} {...register('closedAt')} InputLabelProps={{ shrink: true }} />
            <TextField label="Timeframe" defaultValue={defaultValues.timeframe} {...register('timeframe')} />
            <TextField label="Quantity" type="number" inputProps={{ step: '0.01' }} required defaultValue={defaultValues.quantity} {...register('quantity', { valueAsNumber: true, required: true })} />
            <TextField label="Entry Price" type="number" inputProps={{ step: '0.0001' }} required defaultValue={defaultValues.entryPrice} {...register('entryPrice', { valueAsNumber: true, required: true })} />
            <TextField label="Exit Price" type="number" inputProps={{ step: '0.0001' }} {...register('exitPrice', { valueAsNumber: true })} />
            <TextField label="Stop Loss Price" type="number" inputProps={{ step: '0.0001' }} {...register('stopLossPrice', { valueAsNumber: true })} />
            <TextField label="Take Profit Price" type="number" inputProps={{ step: '0.0001' }} {...register('takeProfitPrice', { valueAsNumber: true })} />
            <TextField label="Fees" type="number" inputProps={{ step: '0.0001' }} defaultValue={defaultValues.fees} {...register('fees', { valueAsNumber: true })} />
            <TextField label="Commission" type="number" inputProps={{ step: '0.0001' }} defaultValue={defaultValues.commission} {...register('commission', { valueAsNumber: true })} />
            <TextField label="Slippage" type="number" inputProps={{ step: '0.0001' }} defaultValue={defaultValues.slippage} {...register('slippage', { valueAsNumber: true })} />
            <TextField label="PnL Gross" type="number" inputProps={{ step: '0.0001' }} {...register('pnlGross', { valueAsNumber: true })} />
            <TextField label="PnL Net" type="number" inputProps={{ step: '0.0001' }} {...register('pnlNet', { valueAsNumber: true })} />
            <TextField label="PnL Percent" type="number" inputProps={{ step: '0.0001' }} {...register('pnlPercent', { valueAsNumber: true })} />
            <TextField label="Risk Amount" type="number" inputProps={{ step: '0.0001' }} {...register('riskAmount', { valueAsNumber: true })} />
            <TextField label="Risk Percent" type="number" inputProps={{ step: '0.0001' }} {...register('riskPercent', { valueAsNumber: true })} />
            <TextField label="R Multiple" type="number" inputProps={{ step: '0.0001' }} {...register('rMultiple', { valueAsNumber: true })} />
            <TextField label="Capital Used" type="number" inputProps={{ step: '0.0001' }} {...register('capitalUsed', { valueAsNumber: true })} />
            <TextField label="Setup" defaultValue={defaultValues.setup} {...register('setup')} />
            <TextField label="Strategy Tag" defaultValue={defaultValues.strategyTag} {...register('strategyTag')} />
            <TextField label="Catalyst Tag" defaultValue={defaultValues.catalystTag} {...register('catalystTag')} />
            <TextField label="Account ID" defaultValue={defaultValues.accountId} {...register('accountId')} />
            <TextField label="Notes" multiline minRows={2} sx={{ gridColumn: '1 / -1' }} {...register('notes')} />
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 2 }}>
              <Button type="submit" variant="contained">Save trade</Button>
              {error && <Typography color="error">{error}</Typography>}
            </Box>
          </Box>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-end' }} spacing={2} divider={<Divider flexItem orientation="vertical" />}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>Search</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                <TextField label="Opened From" type="datetime-local" value={filters.openedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Opened To" type="datetime-local" value={filters.openedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                <TextField label="Closed From" type="datetime-local" value={filters.closedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Closed To" type="datetime-local" value={filters.closedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Symbol" value={filters.symbol} onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))} fullWidth />
                <TextField label="Direction" select value={filters.direction} onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value }))} fullWidth>
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="LONG">Long</MenuItem>
                  <MenuItem value="SHORT">Short</MenuItem>
                </TextField>
              </Stack>
            </Box>
            <Stack direction="row" spacing={2} sx={{ pt: { xs: 0, md: 4 } }}>
              <Button variant="contained" onClick={onSearch}>Search</Button>
              <Button variant="outlined" onClick={clearFilters}>Clear filters</Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Trades List</Typography>
            {viewMode === 'search' && <Alert severity="info" sx={{ m: 0, py: 0.5 }}>Showing search results</Alert>}
          </Stack>
          {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}
          <Box sx={{ height: 500, width: '100%', position: 'relative' }}>
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
                '& .pnl-positive': { color: 'success.main' },
                '& .pnl-negative': { color: 'error.main' },
              }}
              onRowClick={(params: GridRowParams) => setExpandedTrade((prev) => prev?.id === params.id ? null : params.row as TradeResponse)}
            />
            {!loading && trades.length === 0 && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No trades to display</Typography>
              </Box>
            )}
            {expandedTrade && (
              <Box sx={{ mt: 2, bgcolor: 'grey.50', borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>Trade details</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="subtitle2" gutterBottom>Stops & targets</Typography>
                    <Typography variant="body2">Stop loss: {formatCurrency(expandedTrade.stopLossPrice)}</Typography>
                    <Typography variant="body2">Take profit: {formatCurrency(expandedTrade.takeProfitPrice)}</Typography>
                    <Typography variant="body2">Timeframe: {expandedTrade.timeframe || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="subtitle2" gutterBottom>Costs & risk</Typography>
                    <Typography variant="body2">Fees: {formatCurrency(expandedTrade.fees)}</Typography>
                    <Typography variant="body2">Commission: {formatCurrency(expandedTrade.commission)}</Typography>
                    <Typography variant="body2">Slippage: {formatCurrency(expandedTrade.slippage)}</Typography>
                    <Typography variant="body2">Risk: {formatCurrency(expandedTrade.riskAmount)} ({formatPercent(expandedTrade.riskPercent)})</Typography>
                    <Typography variant="body2">R multiple: {formatNumber(expandedTrade.rMultiple)}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="subtitle2" gutterBottom>Setup</Typography>
                    <Typography variant="body2">Setup: {expandedTrade.setup || '—'}</Typography>
                    <Typography variant="body2">Strategy: {expandedTrade.strategyTag || '—'}</Typography>
                    <Typography variant="body2">Catalyst: {expandedTrade.catalystTag || '—'}</Typography>
                    <Typography variant="body2">Capital used: {formatCurrency(expandedTrade.capitalUsed)}</Typography>
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
          </Box>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Field explanations</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Table columns</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Opened</strong>: When the position was opened (newest first by default).</Typography>
                <Typography variant="body2"><strong>Direction/Status</strong>: Long vs Short and whether the trade is still open or closed.</Typography>
                <Typography variant="body2"><strong>PnL (net)</strong>: Profit or loss after fees, commission, and slippage.</Typography>
                <Typography variant="body2"><strong>PnL %</strong>: Net PnL expressed as a percentage of risk or capital used.</Typography>
                <Typography variant="body2"><strong>R multiple</strong>: Net PnL divided by the amount risked (1R equals your initial risk).</Typography>
                <Typography variant="body2"><strong>Notes</strong>: Quick context for the setup; hover to read full text.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Detail panel</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Stops & targets</strong>: Stop loss / take profit anchors and timeframe.</Typography>
                <Typography variant="body2"><strong>Costs & risk</strong>: Fees, commission, slippage plus risk amount and percentage.</Typography>
                <Typography variant="body2"><strong>Setup</strong>: Strategy tag, catalyst, setup description, and capital used.</Typography>
                <Typography variant="body2"><strong>Tags</strong>: Any labels applied to the trade for filtering and review.</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Stack>
    </Box>
  )
}

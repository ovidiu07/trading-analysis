import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { TradeResponse, createTrade, listTrades, searchTrades } from '../api/trades'
import { TradeFormValues, buildTradePayload } from '../utils/tradePayload'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'

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

// Helper function to format dates safely
const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    return date.toLocaleString()
  } catch (e) {
    return dateString
  }
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

  const handleAuthFailure = useCallback((message?: string) => {
    setFetchError(message || 'Please login to view trades')
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }, [location.pathname, logout, navigate])

  const columns = useMemo<GridColDef[]>(() => [
    { field: 'symbol', headerName: 'Symbol', flex: 1 },
    { field: 'market', headerName: 'Market', flex: 1 },
    { field: 'direction', headerName: 'Direction', flex: 1 },
    { field: 'status', headerName: 'Status', flex: 1 },
    { field: 'timeframe', headerName: 'Timeframe', flex: 1 },
    {
      field: 'openedAt',
      headerName: 'Opened At',
      flex: 1,
      valueFormatter: (params) => formatDate(params.value)
    },
    {
      field: 'closedAt',
      headerName: 'Closed At',
      flex: 1,
      valueFormatter: (params) => formatDate(params.value)
    },
    { field: 'quantity', headerName: 'Quantity', flex: 1 },
    { field: 'entryPrice', headerName: 'Entry Price', flex: 1 },
    { field: 'exitPrice', headerName: 'Exit Price', flex: 1 },
    { field: 'stopLossPrice', headerName: 'Stop Loss', flex: 1 },
    { field: 'takeProfitPrice', headerName: 'Take Profit', flex: 1 },
    { field: 'fees', headerName: 'Fees', flex: 1 },
    { field: 'commission', headerName: 'Commission', flex: 1 },
    { field: 'slippage', headerName: 'Slippage', flex: 1 },
    { field: 'pnlNet', headerName: 'PnL Net', flex: 1 },
    { field: 'rMultiple', headerName: 'R Multiple', flex: 1 },
    { field: 'notes', headerName: 'Notes', flex: 1 },
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
          page: paginationModel.page,
          size: paginationModel.pageSize,
        })
        : await listTrades({
          page: paginationModel.page,
          size: paginationModel.pageSize,
        })

      setTrades(response.content || [])
      setTotalRows(response.totalElements)
    } catch (err) {
      setTrades([])
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
        <Typography variant="h5">Trades</Typography>
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
            />
            {!loading && trades.length === 0 && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No trades to display</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Stack>
    </Box>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { TradeResponse, createTrade, searchTrades } from '../api/trades'
import { TradeFormValues, buildTradePayload } from '../utils/tradePayload'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'

const defaultValues: TradeFormValues = {
  symbol: '',
  market: 'STOCK',
  direction: 'LONG',
  status: 'OPEN',
  openedAt: new Date().toISOString().slice(0, 16),
  quantity: 1,
  entryPrice: 0
}

// Helper function to format dates safely
const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch (e) {
    return dateString;
  }
};

export default function TradesPage() {
  // State for trades data
  const [trades, setTrades] = useState<TradeResponse[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 5,
  });

  const handleAuthFailure = useCallback((message?: string) => {
    setFetchError(message || 'Please login to view trades');
    logout();
    navigate('/login', { replace: true, state: { from: location.pathname } });
  }, [location.pathname, logout, navigate]);

  // Define columns based on TradeResponse fields
  const columns = useMemo<GridColDef[]>(() => [
    { field: 'symbol', headerName: 'Symbol', flex: 1 },
    { field: 'market', headerName: 'Market', flex: 1 },
    { field: 'direction', headerName: 'Direction', flex: 1 },
    { field: 'status', headerName: 'Status', flex: 1 },
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
    { field: 'notes', headerName: 'Notes', flex: 1 },
  ], []);

  // Form handling
  const { register, handleSubmit, reset } = useForm<TradeFormValues>({ defaultValues });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Function to fetch trades
  const fetchTrades = useCallback(async () => {
    if (!isAuthenticated) {
      setTrades([]);
      setTotalRows(0);
      setFetchError('Please login to view trades');
      return;
    }

    setLoading(true);
    setFetchError('');

    try {
      const response = await searchTrades({
        page: paginationModel.page,
        size: paginationModel.pageSize
      });

      // Ensure we have an array even if the API returns null/undefined
      setTrades(response.content || []);
      setTotalRows(response.totalElements);
    } catch (err) {
      setTrades([]);
      const apiErr = err as ApiError;
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message);
        return;
      }
      setFetchError(apiErr instanceof Error ? apiErr.message : 'Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure, isAuthenticated, paginationModel.page, paginationModel.pageSize]);

  // Fetch trades when pagination changes
  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Handle form submission
  const onSubmit = async (values: TradeFormValues) => {
    setSuccess('');
    setError('');
    try {
      const payload = buildTradePayload(values);
      await createTrade(payload);
      setSuccess('Trade created successfully');
      reset({ ...defaultValues, openedAt: new Date().toISOString().slice(0, 16) });

      // Refresh the grid data after creating a trade
      fetchTrades();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message);
        return;
      }
      setError(apiErr instanceof Error ? apiErr.message : 'Failed to create trade');
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Trades</Typography>
      </Stack>

      <Box component="form" onSubmit={handleSubmit(onSubmit)} mb={3} sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {success && <Alert severity="success">{success}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Symbol" required {...register('symbol')} />
        <TextField label="Market" select {...register('market')}>
          <MenuItem value="STOCK">Stock</MenuItem>
          <MenuItem value="CFD">CFD</MenuItem>
          <MenuItem value="FOREX">Forex</MenuItem>
          <MenuItem value="CRYPTO">Crypto</MenuItem>
          <MenuItem value="FUTURES">Futures</MenuItem>
          <MenuItem value="OPTIONS">Options</MenuItem>
          <MenuItem value="OTHER">Other</MenuItem>
        </TextField>
        <TextField label="Direction" select {...register('direction')}>
          <MenuItem value="LONG">Long</MenuItem>
          <MenuItem value="SHORT">Short</MenuItem>
        </TextField>
        <TextField label="Status" select {...register('status')}>
          <MenuItem value="OPEN">Open</MenuItem>
          <MenuItem value="CLOSED">Closed</MenuItem>
        </TextField>
        <TextField label="Opened At" type="datetime-local" required {...register('openedAt')} InputLabelProps={{ shrink: true }} />
        <TextField label="Closed At" type="datetime-local" {...register('closedAt')} InputLabelProps={{ shrink: true }} />
        <TextField label="Quantity" type="number" inputProps={{ step: '0.01' }} required {...register('quantity', { valueAsNumber: true })} />
        <TextField label="Entry Price" type="number" inputProps={{ step: '0.01' }} required {...register('entryPrice', { valueAsNumber: true })} />
        <TextField label="Exit Price" type="number" inputProps={{ step: '0.01' }} {...register('exitPrice', { valueAsNumber: true })} />
        <TextField label="Notes" multiline minRows={2} {...register('notes')} />
        <Button type="submit" variant="contained">Save trade</Button>
      </Box>

      {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}

      <div style={{ height: 400, width: '100%', position: 'relative' }}>
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
      </div>
    </Box>
  )
}

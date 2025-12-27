import { useMemo, useState } from 'react'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import { createTrade } from '../api/trades'
import { TradeFormValues, buildTradePayload } from '../utils/tradePayload'

const rows = [
  { id: 1, symbol: 'AAPL', direction: 'LONG', pnl: 120, strategy: 'Breakout', date: '2024-05-02' },
  { id: 2, symbol: 'TSLA', direction: 'SHORT', pnl: -50, strategy: 'Reversal', date: '2024-05-03' }
]

const defaultValues: TradeFormValues = {
  symbol: '',
  market: 'STOCK',
  direction: 'LONG',
  status: 'OPEN',
  openedAt: new Date().toISOString().slice(0, 16),
  quantity: 1,
  entryPrice: 0
}

export default function TradesPage() {
  const columns = useMemo<GridColDef[]>(() => [
    { field: 'symbol', headerName: 'Symbol', flex: 1 },
    { field: 'direction', headerName: 'Direction', flex: 1 },
    { field: 'pnl', headerName: 'P&L', flex: 1 },
    { field: 'strategy', headerName: 'Strategy', flex: 1 },
    { field: 'date', headerName: 'Date', flex: 1 }
  ], [])

  const { register, handleSubmit, reset } = useForm<TradeFormValues>({ defaultValues })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async (values: TradeFormValues) => {
    setSuccess('')
    setError('')
    try {
      const payload = buildTradePayload(values)
      await createTrade(payload)
      setSuccess('Trade created successfully')
      reset({ ...defaultValues, openedAt: new Date().toISOString().slice(0, 16) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trade')
    }
  }

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

      <div style={{ height: 400, width: '100%' }}>
        <DataGrid rows={rows} columns={columns} pageSizeOptions={[5]} />
      </div>
    </Box>
  )
}

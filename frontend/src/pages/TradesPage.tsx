import { useMemo } from 'react'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Box, Button, Stack, Typography } from '@mui/material'

const rows = [
  { id: 1, symbol: 'AAPL', direction: 'LONG', pnl: 120, strategy: 'Breakout', date: '2024-05-02' },
  { id: 2, symbol: 'TSLA', direction: 'SHORT', pnl: -50, strategy: 'Reversal', date: '2024-05-03' }
]

export default function TradesPage() {
  const columns = useMemo<GridColDef[]>(() => [
    { field: 'symbol', headerName: 'Symbol', flex: 1 },
    { field: 'direction', headerName: 'Direction', flex: 1 },
    { field: 'pnl', headerName: 'P&L', flex: 1 },
    { field: 'strategy', headerName: 'Strategy', flex: 1 },
    { field: 'date', headerName: 'Date', flex: 1 }
  ], [])

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Trades</Typography>
        <Button variant="contained">Add trade</Button>
      </Stack>
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid rows={rows} columns={columns} pageSizeOptions={[5]} />
      </div>
    </Box>
  )
}

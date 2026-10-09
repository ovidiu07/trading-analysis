import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { BacktestingImportResponse, BacktestingWorkspace, importBacktestingTrades } from '../../api/backtesting'
import { useI18n } from '../../i18n'

export default function ImportTradesDialog({ workspace, onClose, onImported }: {
  workspace: BacktestingWorkspace; onClose: () => void; onImported: () => Promise<void>
}) {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [instrument, setInstrument] = useState('')
  const [timezone, setTimezone] = useState('')
  const [result, setResult] = useState<BacktestingImportResponse | null>(null)
  const [completed, setCompleted] = useState(false)
  const mutation = useMutation({
    mutationFn: (preview: boolean) => importBacktestingTrades(workspace.id, file!, { instrument, timezone, preview }),
    onSuccess: async (data, preview) => {
      setResult(data)
      if (!preview) { setCompleted(true); await onImported() }
    }
  })
  const reset = () => { setResult(null); setCompleted(false); mutation.reset() }
  const choose = (next: File | null) => {
    setFile(next); reset()
    const match = next?.name.match(/^Replay_Trading_(.+?)_\d{4}-\d{2}-\d{2}(?:_.*)?\.csv$/i)
    setInstrument(match ? match[1].replace('_', ':').toUpperCase() : '')
  }
  return <Dialog open onClose={mutation.isLoading ? undefined : onClose} fullWidth maxWidth="md" aria-labelledby="backtesting-import-dialog-title">
    <DialogTitle id="backtesting-import-dialog-title">{t('backtesting.dialogs.importTrades')}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Alert severity="info">{t('backtesting.replay.importDescription')}</Alert>
      <Typography variant="body2">{t('backtesting.replay.destination', { name: workspace.title || workspace.symbol, symbol: workspace.symbol })}</Typography>
      <Button component="label" variant="outlined" disabled={mutation.isLoading}>{file?.name || t('backtesting.actions.chooseCsv')}<input aria-label={t('backtesting.actions.chooseCsv')} hidden type="file" accept=".csv,text/csv" onChange={event => { choose(event.target.files?.[0] || null); event.target.value = '' }} /></Button>
      <TextField label={t('backtesting.replay.instrument')} value={instrument} disabled={mutation.isLoading || completed} inputProps={{ maxLength: 64 }} helperText={t(file && !instrument.trim() ? 'backtesting.replay.instrumentNotDetected' : 'backtesting.replay.instrumentHelp')} onChange={event => { setInstrument(event.target.value.toUpperCase()); reset() }} />
      {instrument && instrument !== workspace.symbol && <Alert severity="warning">{t('backtesting.replay.symbolMismatch', { instrument, workspace: workspace.symbol })}</Alert>}
      <TextField label={t('backtesting.replay.timezone')} value={timezone} disabled={mutation.isLoading || completed} placeholder="Europe/Bucharest" helperText={t('backtesting.replay.timezoneHelp')} onChange={event => { setTimezone(event.target.value); reset() }} />
      {mutation.isError && <Alert severity="error">{mutation.error instanceof Error ? mutation.error.message : t('backtesting.errors.import')}</Alert>}
      {result && <Stack spacing={1} aria-live="polite">
        <Alert severity={result.invalid ? 'warning' : 'success'}>{t(completed ? 'backtesting.replay.imported' : 'backtesting.replay.previewResult', { count: result.imported, rows: result.rowCount || 0, duplicates: result.duplicates || 0, invalid: result.invalid })}</Alert>
        {result.format === 'TRADINGVIEW_REPLAY' && <Alert severity="info">{t('backtesting.replay.importCaveats')}</Alert>}
        {result.errors.length > 0 && <Alert severity="warning"><Typography variant="subtitle2">{t('backtesting.replay.rowErrors')}</Typography>{result.errors.map((error, i) => <Typography variant="body2" key={i}>{error}</Typography>)}</Alert>}
        {result.trades.length > 0 && <TableContainer><Table size="small" aria-label={t('backtesting.replay.previewTrades')}><TableHead><TableRow>{['instrument', 'entry', 'exit', 'netPnl', 'exitSignal'].map(key => <TableCell key={key}>{t(`backtesting.replay.${key}`)}</TableCell>)}</TableRow></TableHead><TableBody>{result.trades.slice(0, 5).map((trade, i) => <TableRow key={i}><TableCell>{trade.instrument}</TableCell><TableCell>{trade.date} {trade.entryTime}</TableCell><TableCell>{trade.exitDate} {trade.exitTime}</TableCell><TableCell>{trade.netPnl != null ? `${trade.netPnl} ${trade.currency}` : trade.pnlR != null ? `${trade.pnlR}R` : '—'}</TableCell><TableCell>{trade.exitSignal || '—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
      </Stack>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={mutation.isLoading} onClick={onClose}>{t(completed ? 'backtesting.replay.done' : 'backtesting.actions.cancel')}</Button>
      {!completed && (!result ? <Button variant="contained" disabled={!file || mutation.isLoading} onClick={() => mutation.mutate(true)}>{t(mutation.isLoading ? 'backtesting.replay.previewing' : 'backtesting.replay.preview')}</Button>
        : <Button variant="contained" disabled={!result.imported || mutation.isLoading} onClick={() => mutation.mutate(false)}>{t(mutation.isLoading ? 'backtesting.actions.importing' : 'backtesting.replay.importValid', { count: result.imported })}</Button>)}
    </DialogActions>
  </Dialog>
}

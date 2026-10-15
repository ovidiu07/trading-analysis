import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useMediaQuery, useTheme } from '@mui/material'
import { BacktestingImportResponse, BacktestingTrade, BacktestingWorkspace, importBacktestingTrades } from '../../api/backtesting'
import { useI18n } from '../../i18n'
import { replayInstrumentFromFilename } from './importFilename'

const previewPnl = (trade: BacktestingTrade) => trade.netPnl != null ? `${trade.netPnl} ${trade.currency || ''}` : trade.pnlR != null ? `${trade.pnlR}R` : '—'

export default function ImportTradesDialog({ workspace, onClose, onImported }: {
  workspace: BacktestingWorkspace; onClose: () => void; onImported: () => Promise<void>
}) {
  const { t } = useI18n()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('sm'))
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
    setInstrument(next ? replayInstrumentFromFilename(next.name) : '')
  }
  return <Dialog open onClose={mutation.isLoading ? undefined : onClose} fullScreen={mobile} fullWidth maxWidth="md" aria-labelledby="backtesting-import-dialog-title"
    PaperProps={{ sx: { bgcolor: theme.palette.mode === 'light' ? 'common.white' : 'background.default' } }}>
    <DialogTitle id="backtesting-import-dialog-title">{t('backtesting.dialogs.importTrades')}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Alert severity="info">{t('backtesting.replay.importDescription')}</Alert>
      <Typography variant="body2">{t('backtesting.replay.destination', { name: workspace.title || workspace.symbol || t('backtesting.workspace.anyInstrument') })}</Typography>
      <Button component="label" variant="outlined" disabled={mutation.isLoading} sx={{ overflowWrap: 'anywhere' }}>{file?.name || t('backtesting.actions.chooseCsv')}<input aria-label={t('backtesting.actions.chooseCsv')} hidden type="file" accept=".csv,text/csv" onChange={event => { choose(event.target.files?.[0] || null); event.target.value = '' }} /></Button>
      <TextField label={t('backtesting.replay.instrument')} value={instrument} disabled={mutation.isLoading || completed} inputProps={{ maxLength: 64 }} helperText={t(file && !instrument.trim() ? 'backtesting.replay.instrumentNotDetected' : 'backtesting.replay.instrumentHelp')} onChange={event => { setInstrument(event.target.value.toUpperCase()); reset() }} />
      <TextField label={t('backtesting.replay.timezone')} value={timezone} disabled={mutation.isLoading || completed} placeholder="Europe/Bucharest" helperText={t('backtesting.replay.timezoneHelp')} onChange={event => { setTimezone(event.target.value); reset() }} />
      {mutation.isError && <Alert severity="error">{mutation.error instanceof Error ? mutation.error.message : t('backtesting.errors.import')}</Alert>}
      {result && <Stack spacing={1} aria-live="polite">
        <Alert severity={result.invalid ? 'warning' : 'success'}>{t(completed ? 'backtesting.replay.imported' : 'backtesting.replay.previewResult', { count: result.imported, rows: result.rowCount || 0, duplicates: result.duplicates || 0, invalid: result.invalid })}</Alert>
        {Boolean(result.metadataUpdated) && <Alert severity="info">{t(completed ? 'backtesting.replay.fvgUpdated' : 'backtesting.replay.fvgUpdatePreview', { count: result.metadataUpdated! })}</Alert>}
        {result.format === 'TRADINGVIEW_REPLAY' && <Alert severity="info">{t('backtesting.replay.importCaveats')}</Alert>}
        {result.errors.length > 0 && <Alert severity="warning"><Typography variant="subtitle2">{t('backtesting.replay.rowErrors')}</Typography>{result.errors.map((error, i) => <Typography variant="body2" key={i}>{error}</Typography>)}</Alert>}
        {result.trades.length > 0 && (mobile
          ? <Stack component="ul" spacing={1} aria-label={t('backtesting.replay.previewTrades')} sx={{ p: 0, m: 0 }}>
            {result.trades.slice(0, 5).map((trade, i) => <Paper component="li" variant="outlined" key={i} sx={{ p: 1.5, listStyle: 'none', overflowWrap: 'anywhere' }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">{trade.instrument}</Typography>
                <Typography variant="body2">{t('backtesting.replay.entry')}: {trade.date} {trade.entryTime}
                  {trade.entryPrice != null && <Typography component="span" variant="body2" sx={{ display: 'block' }}>{trade.entryPrice} {trade.priceCurrency || ''}</Typography>}
                </Typography>
                <Typography variant="body2">{t('backtesting.replay.exit')}: {trade.exitDate} {trade.exitTime}
                  {trade.exitPrice != null && <Typography component="span" variant="body2" sx={{ display: 'block' }}>{trade.exitPrice} {trade.priceCurrency || ''}</Typography>}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>{t('backtesting.replay.netPnl')}: {previewPnl(trade)}</Typography>
                <Typography variant="body2">{t('backtesting.replay.exitSignal')}: {trade.exitSignal || '—'}</Typography>
              </Stack>
            </Paper>)}
          </Stack>
          : <TableContainer><Table size="small" aria-label={t('backtesting.replay.previewTrades')}><TableHead><TableRow>{['instrument', 'entry', 'exit', 'netPnl', 'exitSignal'].map(key => <TableCell key={key}>{t(`backtesting.replay.${key}`)}</TableCell>)}</TableRow></TableHead><TableBody>{result.trades.slice(0, 5).map((trade, i) => <TableRow key={i}><TableCell>{trade.instrument}</TableCell><TableCell>{trade.date} {trade.entryTime}{trade.entryPrice != null && <Typography variant="caption" component="div">{trade.entryPrice} {trade.priceCurrency || ''}</Typography>}</TableCell><TableCell>{trade.exitDate} {trade.exitTime}{trade.exitPrice != null && <Typography variant="caption" component="div">{trade.exitPrice} {trade.priceCurrency || ''}</Typography>}</TableCell><TableCell>{previewPnl(trade)}</TableCell><TableCell>{trade.exitSignal || '—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>)}
      </Stack>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={mutation.isLoading} onClick={onClose}>{t(completed ? 'backtesting.replay.done' : 'backtesting.actions.cancel')}</Button>
      {!completed && (!result ? <Button variant="contained" disabled={!file || mutation.isLoading} onClick={() => mutation.mutate(true)}>{t(mutation.isLoading ? 'backtesting.replay.previewing' : 'backtesting.replay.preview')}</Button>
        : <Button variant="contained" disabled={(!result.imported && !result.metadataUpdated) || mutation.isLoading} onClick={() => mutation.mutate(false)}>{t(mutation.isLoading ? 'backtesting.actions.importing' : result.metadataUpdated ? 'backtesting.replay.applyImport' : 'backtesting.replay.importValid', { count: result.imported })}</Button>)}
    </DialogActions>
  </Dialog>
}
